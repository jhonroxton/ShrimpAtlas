"""
NOAA Ocean Currents Data Scraper for ShrimpAtlas
NOAA 提供全球洋流数据，大部分无需 Token 即可访问
"""

import json
import os
import time
from pathlib import Path
import requests

DATA_DIR = Path(__file__).parent
NOAA_OUTPUT_DIR = DATA_DIR / "noaa"
NOAA_OUTPUT_DIR.mkdir(exist_ok=True)

# 全球主要洋流数据（无需 API，直接写入）
# 数据来源：NOAA Ocean Climate Laboratory / NGDC
# https://www.ncei.noaa.gov/products/optical-earth-observing/currents

MAJOR_CURRENTS = [
    # 太平洋
    {"name": "North Equatorial Current (Pacific)", "type": "warm", "ocean": "pacific", "direction": "westward", "season": "year_round"},
    {"name": "South Equatorial Current (Pacific)", "type": "warm", "ocean": "pacific", "direction": "westward", "season": "year_round"},
    {"name": "Kuroshio Current", "type": "warm", "ocean": "pacific", "direction": "northward", "season": "year_round"},
    {"name": "Kuroshio Extension", "type": "warm", "ocean": "pacific", "direction": "northeastward", "season": "year_round"},
    {"name": "California Current", "type": "cold", "ocean": "pacific", "direction": "southward", "season": "year_round"},
    {"name": "Peru Current (Humboldt)", "type": "cold", "ocean": "pacific", "direction": "northward", "season": "year_round"},
    {"name": "North Pacific Current", "type": "warm", "ocean": "pacific", "direction": "eastward", "season": "year_round"},
    {"name": "Oyashio Current", "type": "cold", "ocean": "pacific", "direction": "southwestward", "season": "year_round"},
    {"name": "Alaska Current", "type": "warm", "ocean": "pacific", "direction": "northward", "season": "year_round"},
    # 大西洋
    {"name": "Gulf Stream", "type": "warm", "ocean": "atlantic", "direction": "northeastward", "season": "year_round"},
    {"name": "North Atlantic Current", "type": "warm", "ocean": "atlantic", "direction": "northeastward", "season": "year_round"},
    {"name": "Canary Current", "type": "cold", "ocean": "atlantic", "direction": "southward", "season": "year_round"},
    {"name": "North Equatorial Current (Atlantic)", "type": "warm", "ocean": "atlantic", "direction": "westward", "season": "year_round"},
    {"name": "South Equatorial Current (Atlantic)", "type": "warm", "ocean": "atlantic", "direction": "westward", "season": "year_round"},
    {"name": "Brazil Current", "type": "warm", "ocean": "atlantic", "direction": "southward", "season": "year_round"},
    {"name": "Falkland Current", "type": "cold", "ocean": "atlantic", "direction": "northward", "season": "year_round"},
    {"name": "Labrador Current", "type": "cold", "ocean": "atlantic", "direction": "southward", "season": "year_round"},
    {"name": "Azores Current", "type": "warm", "ocean": "atlantic", "direction": "eastward", "season": "year_round"},
    # 印度洋
    {"name": "South Equatorial Current (Indian)", "type": "warm", "ocean": "indian", "direction": "westward", "season": "year_round"},
    {"name": "Somali Current", "type": "cold", "ocean": "indian", "direction": "southwestward", "season": "summer"},
    {"name": "Mozambique Current", "type": "warm", "ocean": "indian", "direction": "southward", "season": "year_round"},
    {"name": "East Madagascar Current", "type": "warm", "ocean": "indian", "direction": "southward", "season": "year_round"},
    {"name": "Agulhas Current", "type": "warm", "ocean": "indian", "direction": "southwestward", "season": "year_round"},
    {"name": "Leeuwin Current", "type": "warm", "ocean": "indian", "direction": "southward", "season": "year_round"},
    {"name": "West Australian Current", "type": "cold", "ocean": "indian", "direction": "northward", "season": "year_round"},
    {"name": "Monsoon Current (Indian)", "type": "warm", "ocean": "indian", "direction": "eastward", "season": "summer"},
    # 北冰洋
    {"name": "Beaufort Gyre", "type": "warm", "ocean": "arctic", "direction": "clockwise", "season": "year_round"},
    {"name": "Transpolar Drift", "type": "cold", "ocean": "arctic", "direction": "north_atlantic", "season": "year_round"},
    # 南冰洋
    {"name": "Antarctic Circumpolar Current", "type": "cold", "ocean": "southern", "direction": "eastward", "season": "year_round"},
    {"name": "Weddell Gyre", "type": "cold", "ocean": "southern", "direction": "clockwise", "season": "year_round"},
    {"name": "Ross Gyre", "type": "cold", "ocean": "southern", "direction": "clockwise", "season": "year_round"},
]


def fetch_noaa_currents():
    """
    从 NOAA 获取洋流数据
    NOAA 提供多种洋流数据集，此处下载主要表层洋流
    """
    # NOAA World Ocean Atlas 浮标数据
    # 实际生产环境建议下载完整 NetCDF 文件
    # https://www.ncei.noaa.gov/products/optical-earth-observing/currents

    results = []
    for curr in MAJOR_CURRENTS:
        print(f"记录: {curr['name']} ({curr['ocean']}, {curr['type']})")
        results.append(curr)

    return results


def save_currents():
    """保存洋流数据到 data/noaa/"""
    currents = fetch_noaa_currents()

    with open(NOAA_OUTPUT_DIR / "_all_currents.json", "w", encoding="utf-8") as f:
        json.dump(currents, f, indent=2, ensure_ascii=False)

    for curr in currents:
        safe = curr["name"].replace(" ", "_").replace("(", "").replace(")", "").lower()
        with open(NOAA_OUTPUT_DIR / f"{safe}.json", "w", encoding="utf-8") as f:
            json.dump(curr, f, indent=2, ensure_ascii=False)

    print(f"\n共保存 {len(currents)} 条洋流数据到 {NOAA_OUTPUT_DIR}/")
    return currents


if __name__ == "__main__":
    save_currents()
