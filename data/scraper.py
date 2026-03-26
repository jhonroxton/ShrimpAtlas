"""
WoRMS Data Scraper for ShrimpAtlas
Usage: python scraper.py

Priority species for Phase 1 MVP - 13 commercially important shrimp species.
"""

import requests
import json
import time
import os
from typing import Optional

BASE_URL = "https://www.marinespecies.org/rest/"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "worms", "species")


def search_species(name: str) -> Optional[dict]:
    """Search WoRMS by scientific name"""
    url = f"{BASE_URL}AphiaRecordsByName/{requests.utils.quote(name)}"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        records = resp.json()
        # Handle both list and dict responses
        if isinstance(records, dict):
            records = [records]
        # Filter for valid marine species (AphiaID > 0)
        records = [r for r in records if r.get("AphiaID", 0) > 0]
        return records[0] if records else None
    except Exception as e:
        print(f"  Error searching {name}: {e}")
        return None


def get_record_by_id(aphia_id: int) -> Optional[dict]:
    """Get full record by WoRMS AphiaID"""
    url = f"{BASE_URL}AphiaRecordByAphiaID/{aphia_id}"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"  Error fetching ID {aphia_id}: {e}")
        return None


def extract_species_data(record: dict) -> dict:
    """Extract relevant fields for ShrimpAtlas shrimp_species table"""
    return {
        "worms_aphia_id": record.get("AphiaID"),
        "valid_aphia_id": record.get("valid_AphiaID"),
        "scientific_name": record.get("scientificname"),
        "valid_name": record.get("valid_name"),
        "authority": record.get("authority"),
        "family": record.get("family"),
        "genus": record.get("genus"),
        "order": record.get("order"),
        "class": record.get("class"),
        "status": record.get("status"),
        "is_marine": record.get("isMarine"),
        "habitat": record.get("habitat"),
        "taxon_rank": record.get("rank"),
        "kingdom": record.get("kingdom"),
        "phylum": record.get("phylum"),
        "url": record.get("url"),
    }


SCRAPE_LIST = [
    # === 对虾科 Penaeidae (最重要的商业虾类) ===
    "Penaeus vannamei",       # 南美白对虾/白对虾
    "Penaeus monodon",        # 斑节对虾/黑虎虾
    "Penaeus chinensis",      # 中国对虾/东方对虾
    "Penaeus japonicus",      # 日本对虾/车虾
    "Penaeus merguiensis",    # 墨吉对虾
    "Penaeus indicus",        # 印度对虾
    "Penaeus subtilis",       # 巴西对虾
    "Penaeus setiferus",      # 美洲白对虾
    "Penaeus aztecus",        # 褐色对虾
    "Penaeus duorarum",       # 粉红对虾
    "Metapenaeus ensis",      # 短沟对虾/绿尾须虾
    "Metapenaeus bennettae",  # 澳洲草虾
    "Metapenaeus monocerus",  # 须虾
    "Metapenaeus mastersii",  # 棕色虎虾
    "Metapenaeus moyobi",     # 蓝脚虾
    "Trachysalambria curvirostris",  # 竹节虾/竹虾
    "Trachysalambria asprica", # 东南亚竹虾
    # === 匙指虾科/Atyidae (淡水/观赏虾) ===
    "Macrobrachium rosenbergii",  # 罗氏沼虾/淡水长臂虾
    "Macrobrachium nipponense",   # 日本沼虾
    "Macrobrachium carcinus",      # 美洲大沼虾
    "Macrobrachium rosenbergii",  # (dup)
    "Neocaridina denticulata",   # 樱桃虾
    "Neocaridina davidi",        # 极火虾
    "Caridina multidentata",     # 蜜蜂虾
    # === 褐虾科 Crangonidae ===
    "Crangon crangon",           # 欧洲褐虾/沙虾
    "Crangon南海",               # (可能不存在)
    # === 长额虾科 Pandalidae ===
    "Pandalus borealis",         # 北极甜虾/北方明虾
    "Pandalus montagui",         # 粉红虾
    "Pandalus jordani",          # 太平洋粉红虾
    "Pandalus platyeros",        # 宽礁虾
    # === 活额虾科 Hippolytidae ===
    "Hippolyte inermis",         # 海草虾
    "Lysmata seticaudata",       # 清洁虾
    "Lysmata debelius",          # 火焰清洁虾
    "Lysmata amboinensis",       # 白纹清洁虾
    # === 玻璃虾科 Pasiphaeidae ===
    "Pasiphaea japonica",        # 日本玻璃虾
    "Pasiphaea sivado",          # 普通玻璃虾
    # === 桃虾科/Sergestidae ===
    "Acetes japonicus",          # 樱花虾/小白虾
    "Acetes intermedius",        # 中型樱虾
    # === 深海虾类 ===
    "Plesiopenaeus edwardsianus", # 深红虾
    "Benthesicymus tanneri",     # 深海底虾
    "Gennadas valens",           # 深海总科虾
    # === 其他著名虾类 ===
    "Alpheus heterochaelis",     # 枪虾/鼓虾
    "Alpheus bellimanus",        # 壮美枪虾
    "Stenopus hispidus",         # 毛刷清洁虾
    "Heterocarpus relictus",     # 岩礁虾
    "Processa edulis",           # 荷兰虾
    # === 河虾/淡水虾 ===
    "Astacus leptodactylus",      # 土耳其淡水螯虾
    "Pacifastacus leniusculus",  # 信号小龙虾
    "Cherax quadricarinatus",    # 蓝龙虾/红爪虾
]


def scrape_all():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    results = []

    for name in SCRAPE_LIST:
        print(f"Searching: {name}", end=" ")
        try:
            records = search_species(name)
            if not records:
                print("✗ not found")
                continue

            aphia_id = records["AphiaID"]
            time.sleep(0.5)  # Be polite to the API

            full_record = get_record_by_id(aphia_id)
            if not full_record:
                print(f"✗ could not fetch full record for AphiaID={aphia_id}")
                continue

            data = extract_species_data(full_record)
            results.append(data)

            # Save individual file
            safe_name = name.replace(" ", "_").lower()
            with open(f"{OUTPUT_DIR}/{safe_name}.json", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"✓ AphiaID={aphia_id} [{data.get('status', 'unknown')}]")
        except Exception as e:
            print(f"✗ error: {e}")

        time.sleep(0.3)

    # Save combined results
    with open(f"{OUTPUT_DIR}/_all_species.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nTotal species scraped: {len(results)}")
    return results


if __name__ == "__main__":
    print("ShrimpAtlas WoRMS Data Scraper")
    print("=" * 40)
    scrape_all()
