"""
scrape_worms_families.py
从 WoRMS REST API 按科获取所有物种列表
然后从 GBIF 获取分布数据，从多图源补充图片

WoRMS REST base: https://www.marinespecies.org/rest/
"""

import requests
import json
import time
import random
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0 (non-commercial)"}
TIMEOUT = 15
PAUSE = 0.5

DATA_DIR = Path("/home/jhonroxton/code/ShrimpAtlas/data")
WORMS_SPECIES_DIR = DATA_DIR / "worms" / "species"

# 所有目标科（虾类）
DECAPOD_FAMILIES = [
    # 常见经济虾类
    "Penaeidae",      # 对虾科
    "Pandalidae",     # 褐虾科  
    "Crangonidae",    # 褐虾科
    "Palinuridae",    # 龙虾科
    "Nephropidae",    # 螯龙虾科
    "Scyllaridae",    # 蝉虾科
    "Galatheidae",    # 铠甲虾科
    "Hippolytidae",   # 藻虾科
    "Alpheidae",      # 鼓虾科
    "Lysmatidae",     # 鞭藻虾科
    "Sergestidae",    # 萤虾科
    "Pasiphaeidae",   # 滑虾科
    "Atyidae",        # 阿地虾科（淡水虾）
    "Palaemonidae",   # 草虾科
    "Cambaridae",     # 蝲蛄科（淡水螯虾）
    "Astacidae",     # 螯虾科
    "Processidae",    # 红虾科
    "Crangonidae",    # 玉筋鱼科
    "Sicyoniidae",   # # 蝉虾科
    "Aristeidae",     # 须虾科
    "Solenoceridae",  # 硬壳虾科
    "Bresiliidae",   # 深海虾科
    "Stylodactylidae",# 柱虾科
    "Rhynchocinetidae",# 壁虾科
    "Thoridae",      # 托虾科
    "Campylonotidae",# 卡帕虾科
    "Euryrhynchidae",# 淡水虾科
]

# 已知非虾类（排除）
NON_SHRIMP_FAMILIES = {
    "Paguridae", "Ethusidae", "Grapsidae", "Menippidae",
    "Gecarcinidae", "Ocypodidae", "Portunidae", "Majidae",
    "Mithracidae", "Calappidae", "Matutidae", "Cancridae",
    "Xanthidae", "Pilumnidae", "Oziidae", "Epialtidae",
    "Mithracidae", "Anchistioididae", "Oplophoridae",
    "Benthesicymidae", "Nematocarcinidae", "Acanthephyridae",
}

def worms_aphia_by_family(family: str) -> list[dict]:
    """从 WoRMS REST 获取某科所有物种"""
    url = f"https://www.marinespecies.org/rest/AphiaRecordsByFamily/{requests.utils.quote(family)}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code == 200:
            records = r.json()
            return [rec for rec in records if isinstance(rec, dict)]
        elif r.status_code == 204:
            return []
        else:
            print(f"  [{family}] HTTP {r.status_code}")
    except Exception as e:
        print(f"  [{family}] Error: {e}")
    return []

def worms_aphia_by_name(name: str) -> list[dict]:
    """从 WoRMS REST 按名字搜索"""
    url = f"https://www.marinespecies.org/rest/AphiaRecordsByName/{requests.utils.quote(name)}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code == 200:
            records = r.json()
            return [rec for rec in records if isinstance(rec, dict)]
    except Exception as e:
        print(f"  [{name}] Error: {e}")
    return []

def get_gbif_key(sciname: str) -> int | None:
    """GBIF 物种匹配"""
    try:
        r = requests.get("https://api.gbif.org/v1/species/match",
            params={"name": sciname}, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code == 200:
            d = r.json()
            if d.get("confidence", 0) >= 85:
                return d.get("speciesKey")
    except:
        pass
    return None

def get_gbif_distributions(gbif_key: int, limit=30) -> list[dict]:
    """从 GBIF 获取物种分布点"""
    try:
        r = requests.get(f"https://api.gbif.org/v1/occurrence/search",
            params={"speciesKey": gbif_key, "limit": limit, "hasGeospatialIssue": "false"},
            headers=HEADERS, timeout=TIMEOUT)
        if r.status_code == 200:
            data = r.json()
            results = data.get("results", [])
            dists = []
            for occ in results:
                coords = occ.get("decimalLatitude"), occ.get("decimalLongitude")
                if coords[0] and coords[1]:
                    dists.append({
                        "lat": coords[0],
                        "lng": coords[1],
                        "country": occ.get("country", ""),
                        "depth": occ.get("depth"),
                        "year": occ.get("year"),
                    })
            return dists
    except:
        pass
    return []

def get_wikimedia_image(sciname: str) -> str | None:
    """从 Wikimedia Commons 搜图"""
    try:
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "list": "search",
            "srsearch": f"{sciname} shrimp",
            "format": "json",
            "srlimit": 3,
        }
        r = requests.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code == 200:
            results = r.json().get("query", {}).get("search", [])
            # Try first result for image
            if results:
                title = results[0]["title"]
                img_params = {
                    "action": "query",
                    "titles": title,
                    "prop": "pageimages",
                    "format": "json",
                    "pithumbsize": 400,
                }
                img_r = requests.get(url, params=img_params, headers=HEADERS, timeout=TIMEOUT)
                if img_r.status_code == 200:
                    pages = img_r.json().get("query", {}).get("pages", {})
                    for page in pages.values():
                        if "thumbnail" in page:
                            return page["thumbnail"]["source"]
    except:
        pass
    return None

def process_family(family: str) -> list[dict]:
    """处理一个科：获取物种列表 + 分布"""
    print(f"[Family] {family}...", end=" ", flush=True)
    records = worms_aphia_by_family(family)
    
    species_records = []
    for rec in records:
        rank = rec.get("rank", "")
        status = rec.get("status", "")
        aphiaid = rec.get("AphiaID", 0)
        
        # 只要有效accepted的物种
        if rank != "Species":
            continue
        if status not in ("accepted", ""):
            continue
        if aphiaid <= 0:
            continue
        
        sciname = rec.get("scientificname", "")
        if not sciname or " " not in sciname:
            continue  # 跳过属级
        
        valid_name = rec.get("valid_name", "")
        valid_aphia = rec.get("valid_AphiaID", 0)
        
        time.sleep(PAUSE)
        
        # 获取 GBIF key 和分布
        gbif_key = get_gbif_key(sciname)
        dists = []
        if gbif_key:
            dists = get_gbif_distributions(gbif_key)
            time.sleep(PAUSE)
        
        # 尝试 Wikimedia 图片
        img_url = get_wikimedia_image(sciname)
        
        species_records.append({
            "scientific_name": sciname,
            "family": family,
            "genus": sciname.split()[0] if sciname else "",
            "worms_aphia_id": aphiaid,
            "valid_name": valid_name,
            "valid_aphia_id": valid_aphia,
            "gbif_key": gbif_key,
            "rank": rank,
            "status": status,
            "distributions": dists,
            "images": [img_url] if img_url else [],
        })
        print(f"  ✓ {sciname} ({len(dists)} pts)", flush=True)
    
    print(f"  → {len(species_records)} species")
    return species_records

def main():
    print(f"WoRMS family scraper — {len(DECAPOD_FAMILIES)} families")
    print(f"Non-shrimp families to exclude: {NON_SHRIMP_FAMILIES}")
    
    all_species = []
    family_results = {}
    
    # 并行处理（3个线程）
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(process_family, fam): fam for fam in DECAPOD_FAMILIES}
        for future in as_completed(futures):
            fam = futures[future]
            try:
                results = future.result()
                family_results[fam] = results
                all_species.extend(results)
            except Exception as e:
                print(f"[Family {fam}] Exception: {e}")
    
    print(f"\nTotal species found: {len(all_species)}")
    
    # 去重（同一物种可能出现在多科）
    seen = set()
    unique = []
    for sp in all_species:
        name = sp["scientific_name"]
        if name not in seen:
            seen.add(name)
            unique.append(sp)
    print(f"After dedup: {len(unique)} unique species")
    
    # 过滤非虾类
    clean = [sp for sp in unique if sp.get("family", "") not in NON_SHRIMP_FAMILIES]
    print(f"After removing non-shrimp: {len(clean)} shrimp species")
    
    # 保存
    out_file = WORMS_SPECIES_DIR / "_worms_species.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"species": clean, "count": len(clean)}, f, indent=2, ensure_ascii=False)
    print(f"Saved → {out_file}")
    
    # 家族统计
    from collections import Counter
    fams = Counter(sp["family"] for sp in clean)
    print("Family distribution:")
    for fam, cnt in fams.most_common():
        print(f"  {fam}: {cnt}")

if __name__ == "__main__":
    main()
