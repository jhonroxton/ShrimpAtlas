"""
Batch import more shrimp species from GBIF
388 new species to add. Process in batches.
"""

import requests
import json
import time
import random
from pathlib import Path

DATA_DIR = Path(__file__).parent
OUTPUT = DATA_DIR / "worms" / "species" / "_more_species.json"
HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0 (non-commercial)"}

# Load all decapods
with open('/tmp/shrimp_species.json') as f:
    data = json.load(f)
decapods = data['decapods']

# Current DB species
current_names = set()
import subprocess
result = subprocess.run(
    ['docker', 'exec', 'shrimpatlas-db', 'psql', '-U', 'shrimpatlas', '-d', 'shrimpatlas', '-t', '-c',
     'SELECT scientific_name FROM shrimp_species;'],
    capture_output=True, text=True
)
for line in result.stdout.strip().split('\n'):
    name = line.strip()
    if name:
        current_names.add(name)

new_species = [sp for sp in decapods if sp['canonicalName'] not in current_names]
print(f"New species to process: {len(new_species)}")

# Chinese name mapping for common genera (compiled from existing DB)
GENERA_CHINESE = {
    # From existing DB
    'Penaeus': '对虾属', 'Metapenaeus': '中了对虾属', 'Trachysalambria': '鹰爪虾属',
    'Macrobrachium': '沼虾属', 'Neocaridina': '新米虾属', 'Crangon': '褐虾属',
    'Pandalus': '长额虾属', 'Hippolyte': '梁虾属', 'Lysmata': '鞭藻虾属',
    'Pasiphaea': '滑虾属', 'Acetes': '樱虾属', 'Plesiopenaeus': '拟熊猫虾属',
    'Benthesicymus': '深海匙虾属', 'Gennadas': '正虾属', 'Alpheus': '鼓虾属',
    'Stenopus': '猥虾属', 'Processa': '红虾属',
    # New genera
    'Betaeus': '贝塔虾属', 'Tozeuma': '托虾属', 'Leptalpheus': '细螯虾属',
    'Thor': '托尔虾属', 'Sicyonia': '礁虾属', 'Periclimenes': '清虾属',
    'Cinetorhynchus': '动眼虾属', 'Solenocera': '管鞭虾属', 'Nematopalaemon': '线肢虾属',
    'Palaemon': '白虾属', 'Leptocarpus': '窄节虾属', 'Campylonotus': '弯背虾属',
    'Arachnochium': '奇虾属', 'Macrobrachium': '沼虾属',
}

def get_chinese_name(genus: str, species: str, gbif_key: int) -> str:
    """Get Chinese name - try cached, then generate"""
    genus_clean = genus or (species.split()[0] if species and ' ' in species else '虾')
    genus_cn = GENERA_CHINESE.get(genus_clean, genus_clean)
    epithet = species.replace(f'{genus_clean} ', '') if species and species.startswith(genus_clean) else (species or '')
    # Try GBIF vernacular names first
    try:
        r = requests.get(
            f'https://api.gbif.org/v1/species/{gbif_key}',
            headers=HEADERS,
            timeout=10,
        )
        if r.status_code == 200:
            d = r.json()
            vernacular = d.get('vernacularName')
            if vernacular:
                return vernacular
    except:
        pass
    return f'{genus_cn}({epithet})'

def get_distribution(gbif_key: int, scientific_name: str) -> list:
    """Get up to 10 occurrence records with coordinates"""
    try:
        r = requests.get(
            'https://api.gbif.org/v1/occurrence/search',
            params={
                'speciesKey': gbif_key,
                'limit': 10,
                'hasGeospatialIssue': 'false',
            },
            headers=HEADERS,
            timeout=15,
        )
        if r.status_code == 200:
            d = r.json()
            points = []
            for occ in d.get('results', []):
                lat = occ.get('decimalLatitude')
                lng = occ.get('decimalLongitude')
                country = occ.get('country')
                if lat and lng:
                    points.append({
                        'lat': lat,
                        'lng': lng,
                        'country': country or '',
                    })
            return points[:10]
    except:
        pass
    return []

def get_images(gbif_key: int, scientific_name: str) -> list:
    """Get iNaturalist original images"""
    try:
        r = requests.get(
            'https://api.gbif.org/v1/occurrence/search',
            params={
                'speciesKey': gbif_key,
                'mediaType': 'StillImage',
                'limit': 10,
            },
            headers=HEADERS,
            timeout=15,
        )
        if r.status_code == 200:
            d = r.json()
            seen = set()
            urls = []
            for occ in d.get('results', []):
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

def get_worms_aphia_id(scientific_name: str) -> int | None:
    """Try to get WoRMS AphiaID via GBIF synonyms"""
    try:
        r = requests.get(
            f'https://api.gbif.org/v1/species/{scientific_name}',
            headers=HEADERS,
            timeout=10,
        )
        if r.status_code == 200:
            d = r.json()
            # Try to find WoRMS in external keys
            for key in d.get('synonym', d.get('species', {})).get('keys', []):
                pass  # skip
            # Look for taxa match
            return d.get('speciesKey')  # use gbif key as fallback
    except:
        pass
    return None

# Process all new species
results = []
total = len(new_species)

for i, sp in enumerate(new_species):
    name = sp['canonicalName']
    genus = sp.get('genus', name.split()[0] if ' ' in name else name)
    gbif_key = sp['gbif_key']
    
    if i % 20 == 0:
        print(f"\nProgress: {i}/{total}")
    
    cn_name = get_chinese_name(genus, name, gbif_key)
    
    # Get distributions
    dists = get_distribution(gbif_key, name)
    
    # Get images
    imgs = get_images(gbif_key, name)
    
    result_sp = {
        'scientific_name': name,
        'cn_name': cn_name,
        'family': sp.get('family', ''),
        'genus': genus,
        'gbif_key': gbif_key,
        'images': imgs,
        'distributions': dists,
    }
    results.append(result_sp)
    
    # Progress
    dist_count = len(dists)
    img_count = len(imgs)
    if i % 10 == 0:
        print(f"  {name}: {cn_name} | dist={dist_count} | imgs={img_count}")
    
    # Rate limit
    time.sleep(random.uniform(0.3, 0.7))

print(f"\n\nDone! Processed {len(results)} species")

# Save
with open(OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print(f"Saved to {OUTPUT}")

# Summary
with_dist = sum(1 for r in results if r['distributions'])
with_imgs = sum(1 for r in results if r['images'])
print(f"With distributions: {with_dist}")
print(f"With images: {with_imgs}")
