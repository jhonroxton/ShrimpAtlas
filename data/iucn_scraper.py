"""
IUCN Red List Data Scraper for ShrimpAtlas
需要 IUCN API Token，详见 IUCN_TOKEN_申请流程.md
"""

import os
import json
import time
import requests
from pathlib import Path

# 从 WoRMS 数据中读取已抓取的物种
DATA_DIR = Path(__file__).parent
IUCN_OUTPUT_DIR = DATA_DIR / "iucn"
IUCN_OUTPUT_DIR.mkdir(exist_ok=True)

TOKEN = os.getenv("IUCN_API_TOKEN", "")
BASE_URL = "https://apiv3.iucnredlist.org/api/v3"


def get_iucn_species_id(scientific_name: str) -> int | None:
    """通过学名搜索 IUCN Species ID"""
    if not TOKEN:
        print("❌ 未设置 IUCN_API_TOKEN，请查看 IUCN_TOKEN_申请流程.md")
        return None

    url = f"{BASE_URL}/species/id/{requests.utils.quote(scientific_name)}"
    params = {"token": TOKEN}
    try:
        resp = requests.get(url, params=params, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            result = data.get("result")
            if result:
                return result[0]["taxonid"] if isinstance(result, list) else result.get("taxonid")
        elif resp.status_code == 404:
            return None
        else:
            print(f"  API错误 {resp.status_code}: {resp.text[:100]}")
    except Exception as e:
        print(f"  请求异常: {e}")
    return None


def get_iucn_detail(taxon_id: int) -> dict | None:
    """获取物种详细信息（濒危等级、威胁因素等）"""
    if not TOKEN:
        return None
    url = f"{BASE_URL}/species/id/{taxon_id}"
    params = {"token": TOKEN}
    try:
        resp = requests.get(url, params=params, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("result", [{}])[0]
    except Exception as e:
        print(f"  请求异常: {e}")
    return None


def extract_iucn_fields(record: dict) -> dict:
    """提取 IUCN 数据"""
    return {
        "iucn_id": record.get("taxonid"),
        "scientific_name": record.get("scientific_name"),
        "common_name": record.get("common_name"),
        "category": record.get("category"),  # CR/EN/VU/NT/LC/DD
        "taxonid": record.get("taxonid"),
        "kingdom": record.get("kingdom"),
        "phylum": record.get("phylum"),
        "class": record.get("class"),
        "order": record.get("order"),
        "family": record.get("family"),
        "genus": record.get("genus"),
        "main_common_name": record.get("main_common_name"),
        "authority": record.get("authority"),
    }


def scrape_from_worms():
    """从 WoRMS 数据中读取物种，逐个查询 IUCN"""
    worms_file = DATA_DIR / "worms" / "species" / "_all_species.json"
    if not worms_file.exists():
        print("❌ 未找到 WoRMS 数据，先运行 scraper.py")
        return

    with open(worms_file, encoding="utf-8") as f:
        species_list = json.load(f)

    results = []
    for sp in species_list:
        name = sp.get("scientific_name")
        print(f"查询 IUCN: {name}", end=" ")
        taxon_id = get_iucn_species_id(name)
        if taxon_id:
            time.sleep(0.5)
            detail = get_iucn_detail(taxon_id)
            if detail:
                data = extract_iucn_fields(detail)
                results.append(data)
                safe = name.replace(" ", "_").lower()
                with open(IUCN_OUTPUT_DIR / f"{safe}.json", "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"✓ {data.get('category', '?')} (ID={taxon_id})")
            else:
                print("✓ 找到ID但无法获取详情")
        else:
            print("✗ 未在 IUCN 中找到")
        time.sleep(0.5)

    with open(IUCN_OUTPUT_DIR / "_all_iucn.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n共获取 {len(results)} 条 IUCN 数据")


if __name__ == "__main__":
    if not TOKEN:
        print("⚠️ 未设置 IUCN_API_TOKEN 环境变量")
        print("请查看 IUCN_TOKEN_申请流程.md 获取 token，然后运行：")
        print("  IUCN_API_TOKEN=你的token python iucn_scraper.py")
    else:
        print(f"Token 已配置: {TOKEN[:8]}...")
        scrape_from_worms()
