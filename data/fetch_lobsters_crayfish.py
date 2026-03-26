"""
Fetch lobsters, crayfish, and other decapods.
Strategy: known species list → GBIF for taxonomy/distributions → iNaturalist for images
"""

import requests, json, time, random

HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0 (non-commercial)"}

# Comprehensive list of lobsters, crayfish, and other interesting species
LOBSTERS_CRAYFISH = [
    # True lobsters (Palinuridae - spiny lobsters)
    ("Panulirus argus", "龙虾科", "Panulirus", "Lobster"),
    ("Panulirus interruptus", "龙虾科", "Panulirus", "Lobster"),
    ("Panulirus versicolor", "龙虾科", "Panulirus", "Lobster"),
    ("Panulirus homarus", "龙虾科", "Panulirus", "Lobster"),
    ("Panulirus polyphagus", "龙虾科", "Panulirus", "Lobster"),
    ("Panulirus ornatus", "龙虾科", "Panulirus", "Lobster"),
    ("Jasus lalandii", "龙虾科", "Jasus", "Lobster"),
    ("Jasus edwardsii", "龙虾科", "Jasus", "Lobster"),
    ("Sagmariasus verreauxi", "龙虾科", "Sagmariasus", "Lobster"),
    ("Linuparus trigonus", "龙虾科", "Linuparus", "Lobster"),
    ("Justita劳", "龙虾科", "Justita", "Lobster"),
    
    # Nephropidae (clawed lobsters)
    ("Homarus americanus", "螯龙虾科", "Homarus", "Lobster"),
    ("Homarus gammarus", "螯龙虾科", "Homarus", "Lobster"),
    ("Nephrops norvegicus", "螯龙虾科", "Nephrops", "Lobster"),
    ("Metanephrops norvegicus", "螯龙虾科", "Metanephrops", "Lobster"),
    
    # Scyllaridae (slipper lobsters)
    ("Thenus orientalis", "扇虾科", "Thenus", "Lobster"),
    ("Ibacus ciliatus", "扇虾科", "Ibacus", "Lobster"),
    ("Parribacus antarcticus", "扇虾科", "Parribacus", "Lobster"),
    ("Scyllarides latus", "扇虾科", "Scyllarides", "Lobster"),
    
    # Enoplometopodidae (reef lobsters)
    ("Enoplometopus antillensis", "礁龙虾科", "Enoplometopus", "Lobster"),
    
    # Cambaridae (crayfish - freshwater)
    ("Procambarus clarkii", "鳌虾科", "Procambarus", "Crayfish"),
    ("Procambarus alleni", "鳌虾科", "Procambarus", "Crayfish"),
    ("Procambarus nigricans", "鳌虾科", "Procambarus", "Crayfish"),
    ("Cherax quadricarinatus", "鳌虾科", "Cherax", "Crayfish"),
    ("Cherax destructor", "鳌虾科", "Cherax", "Crayfish"),
    ("Cherax cainii", "鳌虾科", "Cherax", "Crayfish"),
    ("Cherax papuanus", "鳌虾科", "Cherax", "Crayfish"),
    
    # Astacidae (European/North American crayfish)
    ("Astacus astacus", "淡水鳌虾科", "Astacus", "Crayfish"),
    ("Pacifastacus leniusculus", "淡水鳌虾科", "Pacifastacus", "Crayfish"),
    ("Austropotamobius pallipes", "淡水鳌虾科", "Austropotamobius", "Crayfish"),
    
    # Galatheidae (squat lobsters)
    ("Munida rugosa", "铠甲虾科", "Munida", "Lobster"),
    ("Galathea strigosa", "铠甲虾科", "Galathea", "Lobster"),
    ("Lauria tormentosa", "铠甲虾科", "Lauria", "Lobster"),
]

def get_gbif_key(name):
    """Get GBIF species key"""
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
                return d.get('usageKey'), d.get('family'), d.get('genus')
    except:
        pass
    return None, None, None

def get_distributions(gbif_key):
    """Get up to 20 occurrence points from GBIF"""
    if not gbif_key:
        return []
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

def get_images(gbif_key):
    """Get iNaturalist original images from GBIF"""
    if not gbif_key:
        return []
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

# Main processing
results = []
print(f"Processing {len(LOBSTERS_CRAYFISH)} species...")

for name, family_cn, genus, category in LOBSTERS_CRAYFISH:
    gbif_key, family, genus_found = get_gbif_key(name)
    dists = get_distributions(gbif_key) if gbif_key else []
    imgs = get_images(gbif_key) if gbif_key else []
    
    genus_cn_map = {
        'Panulirus': '龙螯虾属', 'Jasus': '贾苏虾属', 'Sagmariasus': '萨格虾属',
        'Linuparus': '螯龙虾属', 'Homarus': '螯龙虾属', 'Nephrops': '挪威龙虾属',
        'Metanephrops': '后螯虾属', 'Thenus': '扇虾属', 'Ibacus': '伊巴克斯虾属',
        'Parribacus': '拟扇虾属', 'Scyllarides': '拟扇虾属', 'Enoplometopus': '礁虾属',
        'Procambarus': '原螯虾属', 'Cherax': 'cherax螯虾属', 'Astacus': '螯虾属',
        'Pacifastacus': '太平洋螯虾属', 'Austropotamobius': '奥地利螯虾属',
        'Munida': '刺螯虾属', 'Galathea': '铠甲虾属', 'Lauria': '罗瑞亚虾属',
    }
    
    genus_cn = genus_cn_map.get(genus, genus + '属')
    epithet = name.split()[1] if ' ' in name else name
    cn_name = f"{genus_cn}({epithet})"
    
    results.append({
        'scientific_name': name,
        'cn_name': cn_name,
        'family_cn': family_cn,
        'family': family or '',
        'genus': genus_found or genus,
        'category': category,
        'gbif_key': gbif_key,
        'distributions': dists,
        'images': imgs,
    })
    
    dist_count = len(dists)
    img_count = len(imgs)
    print(f"  {name}: gbif_key={gbif_key}, dist={dist_count}, imgs={img_count}")
    time.sleep(random.uniform(0.3, 0.6))

print(f"\nTotal processed: {len(results)}")
with_dist = sum(1 for r in results if r['distributions'])
with_imgs = sum(1 for r in results if r['images'])
print(f"With distributions: {with_dist}")
print(f"With images: {with_imgs}")

with open('/tmp/lobsters_crayfish.json', 'w') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print("Saved to /tmp/lobsters_crayfish.json")
