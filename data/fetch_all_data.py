"""
Fetch distributions + images + SeaLifeBase traits for all 228 species.
Parallel execution with ThreadPoolExecutor.
"""

import requests
import json
import time
import random
import re
import concurrent.futures
import subprocess
from pathlib import Path

TMP = Path('/tmp')
HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0 (non-commercial)"}
SLB_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

# Get all species from DB
result = subprocess.run(
    ['docker', 'exec', 'shrimpatlas-db', 'psql', '-U', 'shrimpatlas', '-d', 'shrimpatlas', '-t', '-c',
     "SELECT id::text, scientific_name FROM shrimp_species;"],
    capture_output=True, text=True
)
species_list = []
for line in result.stdout.strip().split('\n'):
    if '|' not in line:
        continue
    parts = line.split('|')
    if len(parts) >= 2:
        sid = parts[0].strip()
        name = parts[1].strip()
        if sid and name:
            species_list.append({'id': sid, 'scientific_name': name})

print(f"Species in DB: {len(species_list)}")

# ── GBIF helpers ────────────────────────────────────────────────────────────────
def get_gbif_key(name: str) -> int | None:
    try:
        r = requests.get(
            'https://api.gbif.org/v1/species/match',
            params={'name': name},
            headers=HEADERS,
            timeout=10,
        )
        if r.status_code == 200:
            d = r.json()
            if d.get('confidence', 0) >= 85:
                return d.get('usageKey')
    except:
        pass
    return None

def get_distributions(gbif_key: int) -> list:
    try:
        r = requests.get(
            'https://api.gbif.org/v1/occurrence/search',
            params={'speciesKey': gbif_key, 'limit': 20, 'hasGeospatialIssue': 'false'},
            headers=HEADERS,
            timeout=15,
        )
        if r.status_code == 200:
            points = []
            for occ in r.json().get('results', []):
                lat = occ.get('decimalLatitude')
                lng = occ.get('decimalLongitude')
                country = occ.get('country', '')
                if lat and lng:
                    points.append({'lat': lat, 'lng': lng, 'country': country or ''})
            return points[:20]
    except:
        pass
    return []

def get_images(gbif_key: int) -> list:
    try:
        r = requests.get(
            'https://api.gbif.org/v1/occurrence/search',
            params={'speciesKey': gbif_key, 'mediaType': 'StillImage', 'limit': 10},
            headers=HEADERS,
            timeout=15,
        )
        if r.status_code == 200:
            seen = set()
            urls = []
            for occ in r.json().get('results', []):
                for m in occ.get('media', []):
                    identifier = m.get('identifier', '')
                    if 'inaturalist' in identifier.lower() and 'original' in identifier:
                        if identifier not in seen:
                            seen.add(identifier)
                            urls.append(identifier)
            return urls[:3]
    except:
        pass
    return []

# ── SeaLifeBase helper ─────────────────────────────────────────────────────────
def get_sealifebase_traits(name: str) -> dict:
    """Extract max_length from SeaLifeBase summary page"""
    url_name = name.replace(' ', '-')
    try:
        r = requests.get(
            f'https://www.sealifebase.ca/summary/{url_name}.html',
            headers=SLB_HEADERS,
            timeout=15,
        )
        if r.status_code != 200:
            return {}
        text = r.text
        # Extract max length: "Max length : 23.0 cm TL"
        size_match = re.search(r'Max length\s*:\s*([\d.,]+)\s*cm', text)
        max_len = float(size_match.group(1).replace(',', '.')) if size_match else None
        return {'max_length_cm': max_len}
    except:
        return {}

# ── Process one species ────────────────────────────────────────────────────────
def process_one(sp):
    name = sp['scientific_name']
    sid = sp['id']
    try:
        # Get GBIF key first
        gbif_key = get_gbif_key(name)
        dists = get_distributions(gbif_key) if gbif_key else []
        imgs = get_images(gbif_key) if gbif_key else []
        slb = get_sealifebase_traits(name)
        return sid, {
            'gbif_key': gbif_key,
            'distributions': dists,
            'images': imgs,
            'max_length_cm': slb.get('max_length_cm'),
        }
    except Exception as e:
        return sid, {'error': str(e)}

# ── Run with thread pool ───────────────────────────────────────────────────────
print("Fetching all data...")
results = {}
done = 0

with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
    futures = {executor.submit(process_one, sp): sp for sp in species_list}
    for future in concurrent.futures.as_completed(futures):
        sid, data = future.result()
        results[sid] = data
        done += 1
        if done % 30 == 0:
            print(f"  {done}/{len(species_list)} done...")

print(f"\nProcessed {len(results)} species")

# Save
output_file = TMP / 'all_species_data.json'
with open(output_file, 'w') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

# Stats
with_dist = sum(1 for v in results.values() if v.get('distributions'))
with_imgs = sum(1 for v in results.values() if v.get('images'))
with_len = sum(1 for v in results.values() if v.get('max_length_cm'))
total_dist = sum(len(v.get('distributions', [])) for v in results.values())
print(f"With distributions: {with_dist} (total {total_dist} points)")
print(f"With images: {with_imgs}")
print(f"With length: {with_len}")
print(f"Saved to {output_file}")
