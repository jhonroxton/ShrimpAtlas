"""
===================================================================
ShrimpAtlas 系统化物种抓取脚本 v2
===================================================================
策略：
  ① 已知各科核心属 (从小到大逐步扩展)
  ② 用 WoRMS AphiaRecordsByName 查每个属的所有种
  ③ 多源图片（WoRMS → GBIF → iNaturalist → Wikimedia）
  ④ 每个种必须有图才标记完成

用法:
  python3 scrape_taxonomy.py --all        # 全部科系统抓取
  python3 scrape_taxonomy.py --test      # 快速测试（3个科）
  python3 scrape_taxonomy.py --family Penaeidae  # 指定科
  python3 scrape_taxonomy.py --resume     # 断点续传
===================================================================
"""

import os, json, time, requests, argparse
from pathlib import Path
from typing import Optional

# ── Config ─────────────────────────────────────────────────────────────────────
DATA_DIR   = Path(__file__).parent / "worms" / "species"
IMG_DIR    = Path("/home/jhonroxton/code/ShrimpAtlas/frontend/dist/species-images")
STATE_FILE = DATA_DIR / "_scrape_state_v2.json"

HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0 (non-commercial)"}
TIMEOUT = 15
PAUSE   = 0.4   # polite delay between requests

WORMS_BASE = "https://www.marinespecies.org/rest/"

# ── 科 & 属 映射（系统化扩展）
# Key = family name, Value = list of genera (core genera in that family)
FAMILY_GENERA: dict[str, list[str]] = {
    # 对虾类 — 全球最重要的商业虾类
    "Penaeidae": [
        "Penaeus", "Metapenaeus", "Trachysalambria", "Melicertus",
        "Fenneropenaeus", "Litopenaeus", "Farfantepenaeus", "Marsupenaeus",
    ],
    # 长臂虾类（淡水/观赏虾）
    "Palaemonidae": [
        "Macrobrachium", "Palaemon", "Leander", "Nematonotus",
    ],
    # 匙指虾类（淡水观赏虾）
    "Atyidae": [
        "Neocaridina", "Caridina", "Paratya", "Atya",
    ],
    # 褐虾类（沙虾）
    "Crangonidae": [
        "Crangon", "Crangon", "Paracrangon",
    ],
    # 长额虾类（北极甜虾等）
    "Pandalidae": [
        "Pandalus", "Pandalopsis", "Parapandalus", "Stylopandalus",
    ],
    # 玻璃虾类
    "Pasiphaeidae": [
        "Pasiphaea", "Glyphus",
    ],
    # 枪虾类（鼓虾）
    "Alpheidae": [
        "Alpheus", "Synalpheus", "Athanas", "Betaeus",
    ],
    # 清洁虾类
    "Hippolytidae": [
        "Hippolyte", "Lysmata", "Exhippolysmata", "Thor",
    ],
    # Lysmatidae
    "Lysmatidae": [
        "Lysmata", "Ancylomenes", "Periclimenes",
    ],
    # 油虾类
    "Sergestidae": [
        "Acetes", "Sergestes", "Lucaios",
    ],
    # 深虾类
    "Benthesicymidae": [
        "Benthesicymus", "Bentheogennema",
    ],
    "Aristeidae": [
        "Aristaeomorpha", "Aristeus", "Plesiopenaeus", "Gennadas",
    ],
    # 铠甲虾类（squat lobsters）
    "Galatheidae": [
        "Munida", "Galathea", "Lauria", "Phylladiorhynchus",
    ],
    "Porcellanidae": [
        "Porcellana", "Neopetrolisthes", "Mithrax",
    ],
    # 龙虾类（spiny lobsters）
    "Palinuridae": [
        "Panulirus", "Jasus", "Sagmariasus", "Linuparus",
        "Palinurus", "Justita", "Numoto", "Stomatopora",
    ],
    # 螯龙虾类（clawed lobsters）
    "Nephropidae": [
        "Homarus", "Nephrops", "Metanephrops", "Thymopides",
    ],
    # 扇虾类（slipper lobsters）
    "Scyllaridae": [
        "Thenus", "Ibacus", "Parribacus", "Scyllarides", "Arctides",
    ],
    # 礁龙虾类
    "Enoplometopodidae": [
        "Enoplometopus",
    ],
    # 淡水螯虾类（美国小龙虾）
    "Cambaridae": [
        "Procambarus", "Orconectes", "Faxonius", "Cambarus", "Cherax",
    ],
    # 欧洲淡水螯虾类
    "Astacidae": [
        "Astacus", "Pacifastacus", "Austropotamobius",
    ],
    # 淡水蟹类
    "Potamidae": [
        "Geothelphusa", "Nanhaipotamon", "Somanniathelphusa",
    ],
    "Grapsidae": [
        "Hemigrapsus", "Grapsus", "Cyclograpsus", "Gaetice",
    ],
    # 梭子蟹类
    "Portunidae": [
        "Portunus", "Callinectes", "Scylla", "Charybdis", "Arenaeus",
    ],
    # 蟚蛄类（crayfish）
    "Cambaroididae": [
        "Cambaroides",
    ],
}

# ── API helpers ────────────────────────────────────────────────────────────────

def worms_get(path: str) -> Optional[dict | list]:
    url = WORMS_BASE + path
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code in (204, 404): return None
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return None


def worms_records_by_name(name: str, like: bool = False) -> list[dict]:
    """Return all AphiaRecords matching a name (genus or species)."""
    encoded = requests.utils.quote(name)
    data = worms_get(f"AphiaRecordsByName/{encoded}")
    if not data:
        return []
    if isinstance(data, dict):
        data = [data]
    # Filter valid marine taxa
    result = []
    for rec in data:
        if rec.get("status") in ("accepted", "unaccepted") and rec.get("AphiaID", 0) > 0:
            result.append(rec)
    return result


def worms_record_by_id(aphia_id: int) -> Optional[dict]:
    data = worms_get(f"AphiaRecordByAphiaID/{aphia_id}")
    return data


def get_genera_in_family_via_worms(family: str) -> list[str]:
    """
    Use WoRMS species-match to discover genera in a family.
    Strategy: get the family record, then search for genus-level matches
    within that family by searching common genus name patterns.
    """
    # Try to get family record first
    family_recs = worms_records_by_name(family)
    family_id   = None
    for rec in family_recs:
        if rec.get("rank") == "Family":
            family_id = rec.get("AphiaID")
            break

    # Then search for genus-level records within this family
    if not family_id:
        return []

    # Use the family AphiaID to filter genus searches
    # WoRMS doesn't give a direct children API, but we can:
    # Search each common decapod genus name and check if it belongs to this family
    return []  # Will be filled by FAMILY_GENERA below


def gbif_species_key(name: str) -> Optional[int]:
    try:
        r = requests.get(
            "https://api.gbif.org/v1/species/match",
            params={"name": name},
            headers=HEADERS, timeout=TIMEOUT,
        )
        if r.status_code == 200:
            d = r.json()
            return d.get("speciesKey") if d.get("confidence", 0) >= 85 else None
    except:
        pass
    return None


def gbif_images(species_key: int, limit: int = 5) -> list[dict]:
    try:
        r = requests.get(
            f"https://api.gbif.org/v1/species/{species_key}/media",
            headers=HEADERS, timeout=TIMEOUT,
        )
        if r.status_code == 200:
            out = []
            for item in r.json().get("results", [])[:limit]:
                if "StillImage" in str(item.get("format", "")):
                    url = item.get("identifier", "")
                    if url:
                        out.append({"url": url, "license": item.get("license", ""), "source": "GBIF"})
            return out
    except:
        pass
    return []


def gbifVernacularImages(name: str, limit: int = 3) -> list[dict]:
    """Search GBIF by vernacular/english name for species with images."""
    # Try searching with common shrimp name patterns
    genus = name.split()[0] if name else ""
    species = name.split()[1] if len(name.split()) > 1 else ""
    queries = [
        f"{genus} {species} shrimp",
        f"{genus} prawn",
        name,
    ]
    for q in queries[:2]:
        try:
            r = requests.get(
                "https://api.gbif.org/v1/species/search",
                params={"q": q, "rank": "SPECIES", "limit": 10, "media": "IMAGE"},
                headers=HEADERS, timeout=TIMEOUT,
            )
            if r.status_code == 200:
                results = r.json().get("results", [])
                out = []
                for sp in results[:limit]:
                    for med in sp.get("mediatype", []):
                        pass
                    # Try to get thumbnail from the species
                    sk = sp.get("key")
                    if sk:
                        imgs = gbif_images(sk, 1)
                        if imgs:
                            return imgs
            time.sleep(PAUSE)
        except:
            pass
    return []


def iNaturalist_images(name: str, limit: int = 4) -> list[dict]:
    try:
        r = requests.get(
            "https://api.inaturalist.org/v1/search",
            params={"q": name, "sources": "taxon", "per_page": limit},
            headers=HEADERS, timeout=TIMEOUT,
        )
        if r.status_code == 200:
            out = []
            for item in r.json().get("results", [])[:limit]:
                photo = item.get("taxon", {}).get("default_photo", {})
                if photo:
                    url = photo.get("medium_url", "").replace("/medium/", "/original/")
                    if url:
                        out.append({
                            "url": url,
                            "license": photo.get("license_code", "CC-BY-NC"),
                            "source": "iNaturalist",
                        })
            return out
    except:
        pass
    return []


def fishbase_images(name: str, limit: int = 3) -> list[dict]:
    """Search FishBase/SeaLifeBase for species images (good for aquatic species)."""
    try:
        # Try SeaLifeBase first (more marine invertebrates)
        r = requests.get(
            "https://www.sealifebase.ca/Photos/Summary/SpeciesSummary.php",
            params={"GenusName": name.split()[0], "SpeciesName": name.split()[1] if len(name.split()) > 1 else ""},
            headers=HEADERS, timeout=TIMEOUT,
        )
        if r.status_code == 200 and "jpg" in r.text.lower():
            # Look for image URLs in the response
            import re
            imgs = re.findall(r'https?://[^"\'>\s]+\.(?:jpg|jpeg|png)', r.text, re.I)
            out = []
            for url in imgs[:limit]:
                if "thumb" not in url.lower() and "small" not in url.lower():
                    out.append({"url": url, "source": "SeaLifeBase", "license": "CC-BY-NC"})
            if out:
                return out
        time.sleep(PAUSE)
    except:
        pass
    return []


def fao_images(name: str) -> list[dict]:
    """Search FAO Figis (Fisheries and Aquaculture) for species images."""
    try:
        # FAO species fact sheets often have images
        r = requests.get(
            "https://www.fao.org/fishery/species/search/en",
            params={"q": name},
            headers=HEADERS, timeout=TIMEOUT,
        )
        if r.status_code == 200:
            import re
            imgs = re.findall(r'https?://[^"\'>\s]+\.(?:jpg|jpeg|png)', r.text, re.I)
            out = []
            for url in imgs[:2]:
                if any(kw in url.lower() for kw in ["species", "fish", "shrimp", "aquaculture"]):
                    out.append({"url": url, "source": "FAO", "license": "FAO"})
            return out
    except:
        pass
    return []


def worms_taxonpage_images(sciname: str) -> list[dict]:
    """Scrape image URLs from the official WoRMS taxon page."""
    try:
        # WoRMS taxon pages have thumbnail images
        url = f"https://www.marinespecies.org/aphia.php?p=taxdetails&id={0}"
        # Try searching for the species first
        r = requests.get(
            "https://www.marinespecies.org/rest/AphiaRecordsByName/" + requests.utils.quote(sciname),
            headers=HEADERS, timeout=TIMEOUT,
        )
        if r.status_code == 200:
            records = r.json()
            if isinstance(records, dict):
                records = [records]
            for rec in records:
                if rec.get("scientificname", "").lower() == sciname.lower():
                    aphiaid = rec.get("AphiaID")
                    if aphiaid:
                        page_url = f"https://www.marinespecies.org/aphia.php?p=taxdetails&id={aphiaid}"
                        try:
                            pr = requests.get(page_url, headers=HEADERS, timeout=TIMEOUT)
                            if pr.status_code == 200:
                                import re
                                imgs = re.findall(r'https://images\.marinespecies\.org/thumbs/[^\s"\'<>]+\.jpg', pr.text)
                                out = [{"url": url, "source": "WoRMS", "license": "CC-BY"} for url in imgs[:3]]
                                if out:
                                    return out
                        except:
                            pass
        time.sleep(PAUSE)
    except:
        pass
    return []


WIKIMEDIA_SKIP = {
    "Panulirus interruptus",  # no good CC images
}

def wikimedia_images(name: str, limit: int = 3) -> list[dict]:
    if name in WIKIMEDIA_SKIP:
        return []
    queries = [f"{name} shrimp", name, name.replace(" ", "_")]
    for query in queries:
        imgs = _wikimedia_search(query, limit)
        if imgs:
            return imgs
        time.sleep(0.15)
    return []


def _wikimedia_search(query: str, limit: int) -> list[dict]:
    try:
        r = requests.get(
            "https://commons.wikimedia.org/w/api.php",
            params={
                "action": "query", "list": "search",
                "srsearch": query, "srnamespace": 6,
                "srlimit": limit, "format": "json",
            },
            headers=HEADERS, timeout=TIMEOUT,
        )
        if r.status_code != 200:
            return []
        titles = [item["title"] for item in r.json().get("query", {}).get("search", [])]
        out = []
        for title in titles:
            time.sleep(0.1)
            fr = requests.get(
                "https://commons.wikimedia.org/w/api.php",
                params={
                    "action": "query", "titles": title,
                    "prop": "imageinfo",
                    "iiprop": "url|mime|extmetadata",
                    "iiurlwidth": 1200, "format": "json",
                },
                headers=HEADERS, timeout=TIMEOUT,
            )
            if fr.status_code != 200:
                continue
            for page in fr.json().get("query", {}).get("pages", {}).values():
                info = page.get("imageinfo", [{}])[0]
                url  = info.get("url", "")
                mime = info.get("mime", "")
                if url and "image" in str(mime):
                    lic = (info.get("extmetadata", {}).get("LicenseShortName", {}) or {}).get("value", "CC-BY-SA")
                    out.append({"url": url, "license": lic, "source": "Wikimedia Commons"})
        return out
    except:
        return []


def worms_thumbnail(aphia_id: int) -> Optional[str]:
    url = f"https://images.marinespecies.org/thumbs/{aphia_id}_.jpg"
    try:
        r = requests.head(url, headers=HEADERS, timeout=8, allow_redirects=True)
        if r.status_code == 200 and "image" in r.headers.get("content-type", ""):
            return url
    except:
        pass
    return None


# ── Image fetching pipeline (try until we get ≥1 image) ───────────────────────

def fetch_images(sciname: str, aphia_id: int) -> tuple[list[dict], str]:
    """
    Try image sources in order; return (images, best_source).
    Tries: WoRMS thumbnail → GBIF → iNaturalist → FishBase/SeaLifeBase → WoRMS taxon page → Wikimedia
    """
    all_urls: set = set()
    best_source = "none"
    images: list[dict] = []

    # 1. WoRMS thumbnail
    thumb = worms_thumbnail(aphia_id)
    if thumb:
        images.append({"url": thumb, "source": "WoRMS", "license": "CC-BY"})
        all_urls.add(thumb)
        best_source = "WoRMS"

    time.sleep(PAUSE)

    # 2. GBIF
    if not images:
        key = gbif_species_key(sciname)
        if key:
            imgs = gbif_images(key)
            for img in imgs:
                if img["url"] not in all_urls:
                    images.append(img); all_urls.add(img["url"])
            if imgs: best_source = "GBIF"
        time.sleep(PAUSE)

    # 3. iNaturalist
    if not images:
        imgs = iNaturalist_images(sciname)
        for img in imgs:
            if img["url"] not in all_urls:
                images.append(img); all_urls.add(img["url"])
        if imgs: best_source = "iNaturalist"
        time.sleep(PAUSE)

    # 4. SeaLifeBase (best for marine invertebrates)
    if not images:
        imgs = fishbase_images(sciname)
        for img in imgs:
            if img["url"] not in all_urls:
                images.append(img); all_urls.add(img["url"])
        if imgs: best_source = "SeaLifeBase"
        time.sleep(PAUSE)

    # 5. WoRMS taxon page (scraped)
    if not images:
        imgs = worms_taxonpage_images(sciname)
        for img in imgs:
            if img["url"] not in all_urls:
                images.append(img); all_urls.add(img["url"])
        if imgs: best_source = "WoRMS-page"
        time.sleep(PAUSE)

    # 6. Wikimedia
    if not images:
        imgs = wikimedia_images(sciname)
        for img in imgs:
            if img["url"] not in all_urls:
                images.append(img); all_urls.add(img["url"])
        if imgs: best_source = "Wikimedia"

    return images, best_source


# ── Taxonomy pipeline ───────────────────────────────────────────────────────────

def scrape_genus(genus: str, family: str) -> list[dict]:
    """
    Get all valid species in a genus via WoRMS AphiaRecordsByName.
    Returns list of species taxonomy dicts.
    """
    records = worms_records_by_name(genus)
    species = []
    for rec in records:
        rank    = rec.get("rank", "")
        status  = rec.get("status", "")
        aphiaid = rec.get("AphiaID", 0)
        if aphiaid <= 0:
            continue
        # Accept: species-level accepted OR synonyms with valid_AphiaID
        if rank == "Species":
            # Get full record
            full = worms_record_by_id(aphiaid)
            if full:
                species.append({
                    "worms_aphia_id": aphiaid,
                    "valid_aphia_id": full.get("valid_AphiaID"),
                    "scientific_name": full.get("scientificname", genus),
                    "valid_name": full.get("valid_name"),
                    "family": family,
                    "genus": genus,
                    "order": full.get("order"),
                    "class": full.get("class"),
                    "rank": rank,
                    "status": status,
                    "habitat": full.get("habitat"),
                    "is_marine": full.get("isMarine"),
                    "url": full.get("url"),
                })
        time.sleep(PAUSE)
    return species


def download_first_image(sciname: str, images: list[dict], img_dir: Path) -> bool:
    """Download the best image for a species into img_dir/Genus_species/1.jpg"""
    folder = img_dir / sciname.replace(" ", "_")
    folder.mkdir(parents=True, exist_ok=True)

    # Already has an image
    if any(folder.glob("*.[jJ][pP][gG]")) or any(folder.glob("*.[pP][nN][gG]")):
        return True

    for img in images:
        url = img.get("url", "")
        if not url:
            continue
        try:
            r = requests.get(url, headers=HEADERS, timeout=20, stream=True)
            if r.status_code == 200:
                ct = r.headers.get("content-type", "image/jpeg")
                ext = "png" if "png" in ct else "jpg"
                path = folder / f"1.{ext}"
                with open(path, "wb") as f:
                    for chunk in r.iter_content(65536):
                        f.write(chunk)
                return True
        except:
            pass
    return False


# ── State ─────────────────────────────────────────────────────────────────────

def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"results": {}, "families": {}}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False))


# ── Main ───────────────────────────────────────────────────────────────────────

def run_family(family: str, state: dict, resume: bool, max_species: int) -> dict:
    genera = FAMILY_GENERA.get(family, [])
    if not genera:
        return {}

    all_species = []
    for genus in genera:
        print(f"  属 [{genus}]: ", end="", flush=True)
        if resume and genus in state.get("genera_done", []):
            print("跳过（已有数据）")
            all_species.extend(state["genera_done"][genus])
            continue

        species_list = scrape_genus(genus, family)
        print(f"{len(species_list)} species")

        if max_species > 0 and len(all_species) + len(species_list) > max_species:
            species_list = species_list[:max_species - len(all_species)]

        all_species.extend(species_list)

        # Mark progress
        state.setdefault("genera_done", {})[genus] = species_list
        save_state(state)
        time.sleep(PAUSE)

    return {s["scientific_name"]: s for s in all_species}


def main():
    parser = argparse.ArgumentParser(description="ShrimpAtlas 系统化物种抓取 v2")
    parser.add_argument("--family", help="指定科")
    parser.add_argument("--all",    action="store_true", help="全部科")
    parser.add_argument("--test",   action="store_true", help="快速测试（3个科）")
    parser.add_argument("--resume", action="store_true", help="断点续传")
    parser.add_argument("--max-species", type=int, default=0, help="每科最多物种数（0=不限）")
    args = parser.parse_args()

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()

    families = []
    if args.family:
        families = [args.family]
    elif args.all:
        families = list(FAMILY_GENERA.keys())
    elif args.test:
        families = ["Penaeidae", "Palinuridae", "Cambaridae"]

    print(f"待处理 {len(families)} 个科: {families}")

    for family in families:
        print(f"\n{'='*60}")
        print(f"科: {family}  ({len(FAMILY_GENERA.get(family, []))} 个属)")
        print("=" * 60)

        family_state = state["results"].get(family, {})

        # Skip if already fully scraped (has images for all species)
        if args.resume and family_state and all(
            v.get("images") for v in family_state.values()
        ):
            print(f"  [{family}] 已有完整数据（含图片），跳过。")
            continue

        species_dict = run_family(family, state, args.resume, args.max_species)

        # Fetch images for each species
        done = 0
        missing_img = []
        for sciname, taxon in species_dict.items():
            existing = family_state.get(sciname, {}).get("images", [])
            if existing:
                images = existing
                source = "cached"
            else:
                aphia_id = taxon.get("worms_aphia_id", 0)
                images, source = fetch_images(sciname, aphia_id)
                print(f"    {sciname}: {source or 'no image'}")

            family_state[sciname] = {
                "taxonomy": taxon,
                "images": images,
            }

            # Download image
            if images:
                ok = download_first_image(sciname, images, IMG_DIR)
                if ok:
                    done += 1
                print(f"      → {'保存成功' if ok else '保存失败'}")
            else:
                missing_img.append(sciname)

            state["results"][family] = family_state
            save_state(state)
            time.sleep(PAUSE * 2)

        total = len(species_dict)
        print(f"\n  📊 {family}: {total} species, {done} 有图", end="")
        if missing_img:
            print(f", ⚠ {len(missing_img)} 缺图: {', '.join(missing_img[:3])}...")
        else:
            print()

    # Summary
    total_sp  = sum(len(v) for v in state["results"].values())
    total_img = sum(
        1 for fam in state["results"].values()
        for v in fam.values() if v.get("images")
    )
    img_count = len(list(IMG_DIR.glob("*/*.[jJ][pP][gG]"))) + len(list(IMG_DIR.glob("*/*.[pP][nN][gG]")))
    print(f"\n{'='*60}")
    print(f"抓取完成！")
    print(f"总物种 : {total_sp}")
    print(f"有图片 : {total_img} ({total_img*100//max(total_sp,1)}%)")
    print(f"已下载图片文件: {img_count} 张")
    print(f"状态文件: {STATE_FILE}")
    print(f"图片目录: {IMG_DIR}")


if __name__ == "__main__":
    main()
