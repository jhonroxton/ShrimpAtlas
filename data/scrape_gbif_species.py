#!/usr/bin/env python3
"""
scrape_gbif_species.py — GBIF 全科属物种爬虫（字母前缀搜索版）

策略：
1. 对每个属，用 A-Z 字母前缀搜索（如 "Alpheus a", "Alpheus b"...）
   GBIF suggest 每次最多返回 20 条，26个字母 × 20 ≈ 500+ 物种/属
2. 去重 + 验证 ACCEPTED 状态
3. 并行获取分布数据（GBIF Occurrence API）
4. 搜图（Wikimedia）
5. 追加到数据库
"""

import requests
import json
import time
import random
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter

HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0 (non-commercial)"}
PAUSE = 0.35
TIMEOUT = 15
OUT_FILE = Path("/home/jhonroxton/code/ShrimpAtlas/data/worms/species/_gbif_species.json")
STATE_FILE = Path("/home/jhonroxton/code/ShrimpAtlas/data/worms/species/_gbif_state.json")

# ── 目标属 ──────────────────────────────────────────────────────────────────
TARGET_GENERA = sorted(set([
    # Penaeidae
    "Penaeus", "Litopenaeus", "Marsupenaeus", "Fenneropenaeus",
    "Melicertus", "Protrachypene", "Trachysalambria", "Plesiopenaeus",
    # Pandalidae
    "Pandalus", "Plesionika", "Heterocarpus", "Parapandalus", "Pandalopsis",
    # Alpheidae
    "Alpheus", "Synalpheus",
    # Palaemonidae
    "Palaemon", "Macrobrachium", "Nematopalaemon", "Leander",
    "Brachycarpus", "Periclimenes",
    # Hippolytidae
    "Hippolyte", "Lysmata", "Exhippolysma", "Thor",
    # Crangonidae
    "Crangon", "Pontophilus", "Sclerocrangon",
    # Palaemonidae + Atyidae overlap
    "Caridina", "Neocaridina",
    # Scyllaridae
    "Scyllarus", "Parribacus", "Ibacus", "Thenus",
    # Palinuridae
    "Panulirus", "Jasus", "Sagmariasus", "Palinurus", "Projasus",
    # Nephropidae
    "Homarus", "Nephrops", "Metanephrops",
    # Galatheidae
    "Galathea", "Munida", "Munidopsis",
    # Sergestidae
    "Sergestes", "Sergia", "Lucifer",
    # Pasiphaeidae
    "Pasiphaea", "Leptochela",
    # Processidae
    "Processa", "Nikoides",
    # Solenoceridae
    "Solenocera", "Hepomadus",
    # Aristeidae
    "Aristaeomorpha", "Aristaeopsis",
    # Sicyoniidae
    "Sicyonia",
    # Thoridae
    "Hippolyte",
    # Cambaridae (淡水螯虾)
    "Procambarus", "Orconectes", "Faxonius", "Cambarus",
    # Astacidae
    "Astacus", "Austropotamobius", "Pacifastacus",
]))

NON_SHRIMP_FAMILIES = {
    # Crab families
    "Paguridae", "Ethusidae", "Grapsidae", "Menippidae",
    "Gecarcinidae", "Ocypodidae", "Portunidae", "Majidae",
    "Mithracidae", "Calappidae", "Matutidae", "Cancridae",
    "Xanthidae", "Pilumnidae", "Oziidae", "Epialtidae",
    "Diogenidae", "Coenobitidae",
    # Squat lobster / anomaly families
    "Galatheidae", "Munidopsidae", "Munididae",
    # Other non-shrimp decapods
    "Bresiliidae", "Campylonotidae", "Lauriidae",
}

ALPHABET = list("abcdefghijklmnopqrstuvwxyz")

# ── API 函数 ──────────────────────────────────────────────────────────────────

def gbif_search_prefix(genus: str, prefix: str) -> list[dict]:
    """搜索 "Genus prefix*" 组合，返回所有匹配物种"""
    q = f"{genus} {prefix}"
    try:
        r = requests.get(
            "https://api.gbif.org/v1/species/suggest",
            params={"q": q, "rank": "SPECIES"},
            headers=HEADERS, timeout=TIMEOUT
        )
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list):
                return [rec for rec in data
                         if rec.get("rank") == "SPECIES"
                         and rec.get("status") != "SYNONYM"
                         and rec.get("genus", "").strip().lower() == genus.lower()]
        time.sleep(PAUSE + random.uniform(0, 0.15))
    except Exception as e:
        pass
    return []

def gbif_suggest_all(genus: str) -> list[dict]:
    """对某属，用 A-Z 前缀全面搜索所有物种"""
    seen = set()
    results = []
    for letter in ALPHABET:
        recs = gbif_search_prefix(genus, letter)
        for rec in recs:
            key = rec.get("canonicalName") or rec.get("scientificName", "")
            if key and key not in seen:
                seen.add(key)
                results.append(rec)
    return results

def get_gbif_distributions(gbif_key: int, limit=30) -> list[dict]:
    """从 GBIF 获取物种分布点"""
    try:
        r = requests.get(
            "https://api.gbif.org/v1/occurrence/search",
            params={"speciesKey": gbif_key, "limit": limit,
                    "hasGeospatialIssue": "false"},
            headers=HEADERS, timeout=TIMEOUT
        )
        if r.status_code == 200:
            data = r.json()
            dists = []
            for occ in data.get("results", []):
                lat = occ.get("decimalLatitude")
                lon = occ.get("decimalLongitude")
                if lat and lon:
                    dists.append({
                        "lat": lat, "lng": lon,
                        "country": occ.get("country", ""),
                        "depth": occ.get("depth"),
                        "year": occ.get("year"),
                    })
            time.sleep(PAUSE * 0.5)
            return dists
    except:
        pass
    return []

def get_wikimedia_image(sciname: str) -> str | None:
    """从 Wikimedia Commons 搜图"""
    try:
        params = {
            "action": "query", "list": "search",
            "srsearch": f'"{sciname}" OR "{sciname.split()[0]} shrimp"',
            "format": "json", "srlimit": 3,
        }
        r = requests.get("https://en.wikipedia.org/w/api.php",
                        params=params, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code == 200:
            results = r.json().get("query", {}).get("search", [])
            if results:
                title = results[0]["title"]
                img_params = {
                    "action": "query", "titles": title,
                    "prop": "pageimages", "format": "json", "pithumbsize": 500,
                }
                img_r = requests.get("https://en.wikipedia.org/w/api.php",
                                    params=img_params, headers=HEADERS, timeout=TIMEOUT)
                if img_r.status_code == 200:
                    pages = img_r.json().get("query", {}).get("pages", {})
                    for page in pages.values():
                        if "thumbnail" in page:
                            return page["thumbnail"]["source"]
        time.sleep(PAUSE * 0.5)
    except:
        pass
    return None

# ── 主逻辑 ─────────────────────────────────────────────────────────────────────

def process_genus(genus: str) -> list[dict]:
    print(f"[{genus}] searching... ", end="", flush=True)
    recs = gbif_suggest_all(genus)
    print(f"found {len(recs)} species", flush=True)

    species_list = []
    for rec in recs:
        fam = rec.get("family", "")
        if fam in NON_SHRIMP_FAMILIES:
            continue

        sciname = rec.get("canonicalName") or rec.get("scientificName", "")
        if not sciname or " " not in sciname:
            continue

        gbif_key = rec.get("key") or rec.get("speciesKey")
        dists = get_gbif_distributions(gbif_key) if gbif_key else []
        img = get_wikimedia_image(sciname)

        species_list.append({
            "scientific_name": sciname,
            "family": fam,
            "genus": genus,
            "gbif_key": gbif_key,
            "rank": "Species",
            "status": "accepted",
            "distributions": dists,
            "images": [img] if img else [],
        })
        print(f"  ✓ {sciname} ({len(dists)} pts){' 🖼️' if img else ''}")

    print(f"  → {len(species_list)} shrimp species")
    return species_list

def main():
    # 加载已爬取状态（断点续爬）
    state = {}
    if STATE_FILE.exists():
        state = json.loads(STATE_FILE.read_text())
    scraped = set(state.get("done", []))
    all_species = state.get("species", [])

    pending = [g for g in TARGET_GENERA if g not in scraped]
    print(f"GBIF Species Scraper — {len(TARGET_GENERA)} genera total, {len(pending)} remaining")
    print("=" * 60)

    for genus in pending:
        try:
            results = process_genus(genus)
            all_species.extend(results)
            scraped.add(genus)
            state = {"done": list(scraped), "species": all_species}
            STATE_FILE.write_text(json.dumps(state, ensure_ascii=False))
        except KeyboardInterrupt:
            print(f"\nInterrupted, saving state...")
            STATE_FILE.write_text(json.dumps({"done": list(scraped), "species": all_species}, ensure_ascii=False))
            break
        except Exception as e:
            print(f"[{genus}] Error: {e}, skipping...")

    # 去重
    seen = set()
    unique = []
    for sp in all_species:
        name = sp["scientific_name"]
        if name not in seen:
            seen.add(name)
            unique.append(sp)

    print(f"\nTotal: {len(all_species)} raw, {len(unique)} unique species")

    fams = Counter(sp["family"] for sp in unique)
    print("Family distribution:")
    for fam, cnt in fams.most_common(15):
        print(f"  {fam}: {cnt}")

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"species": unique, "count": len(unique)}, f, indent=2, ensure_ascii=False)
    print(f"\nSaved → {OUT_FILE}")

if __name__ == "__main__":
    main()
