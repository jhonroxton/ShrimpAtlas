"""
Fast bulk import of 388 new shrimp species.
Strategy:
1. Insert all species into DB first (fast, no external API calls)
2. Then parallel-fetch distributions + images 
3. Then fetch SeaLifeBase characteristics
"""

import requests
import json
import time
import random
import concurrent.futures
import subprocess
from pathlib import Path

DATA_DIR = Path(__file__).parent
TMP = Path('/tmp')
HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0 (non-commercial)"}

# Load all new decapods from GBIF search
with open('/tmp/shrimp_species.json') as f:
    data = json.load(f)
decapods = data['decapods']  # 411 total

# Get current DB species
current_names = set()
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
print(f"NEW species: {len(new_species)}")

# Chinese name mapping for genera
GENERA_CHINESE = {
    'Penaeus': '对虾属', 'Metapenaeus': '中肌对虾属', 'Trachysalambria': '鹰爪虾属',
    'Macrobrachium': '沼虾属', 'Neocaridina': '新米虾属', 'Crangon': '褐虾属',
    'Pandalus': '长额虾属', 'Hippolyte': '梁虾属', 'Lysmata': '鞭藻虾属',
    'Pasiphaea': '滑虾属', 'Acetes': '樱虾属', 'Plesiopenaeus': '拟对虾属',
    'Benthesicymus': '深海匙虾属', 'Gennadas': '正虾属', 'Alpheus': '鼓虾属',
    'Stenopus': '猥虾属', 'Processa': '红虾属',
    # New
    'Betaeus': '贝塔虾属', 'Tozeuma': '托虾属', 'Leptalpheus': '细螯虾属',
    'Thor': '托尔虾属', 'Sicyonia': '礁虾属', 'Periclimenes': '小虾属',
    'Cinetorhynchus': '动眼虾属', 'Solenocera': '管鞭虾属', 'Nematopalaemon': '线肢虾属',
    'Palaemon': '白虾属', 'Leptocarpus': '窄节虾属', 'Campylonotus': '弯背虾属',
    'Arachnochium': '奇虾属', 'Crangon': '褐虾属', 'Parhippolyte': '副霞虾属',
    'Acetes': '樱虾属', 'Systellaspis': '固虾属', 'Oplophorus': '武装虾属',
    'Nematocarcinus': '线虾属', 'Ephyrina': '附椰虾属', 'Bentheogennema': '深海米虾属',
    'Sergia': '塞尔虾属', 'Allosyllates': '异虾属', 'Plesiopenaeus': '拟对虾属',
}

def genus_to_chinese(genus):
    if not genus:
        return '虾属'
    return GENERA_CHINESE.get(genus, genus + '属')

def make_cn_name(genus, canonical):
    genus_cn = genus_to_chinese(genus)
    epithet = canonical.replace(genus + ' ', '') if genus and canonical.startswith(genus) else canonical
    return f'{genus_cn}({epithet})'

# ── Step 1: Generate bulk INSERT SQL ─────────────────────────────────────────
print("\nGenerating bulk INSERT SQL...")
sql_lines = []
for sp in new_species:
    name = sp['canonicalName']
    genus = sp.get('genus', name.split()[0] if ' ' in name else name)
    cn = make_cn_name(genus, name)
    family = (sp.get('family') or '').replace("'", "''")
    genus_clean = (genus or name.split()[0] if ' ' in name else name).replace("'", "''")
    cn_clean = cn.replace("'", "''")
    name_escaped = name.replace("'", "''")
    sql = f"INSERT INTO shrimp_species (id, scientific_name, cn_name, en_name, family, genus, images) VALUES (gen_random_uuid(), E'{name_escaped}', E'{cn_clean}', E'{name_escaped}', E'{family}', E'{genus_clean}', NULL::TEXT[]);"
    sql_lines.append(sql)

sql_file = TMP / 'bulk_insert.sql'
sql_file.write_text('\n'.join(sql_lines), encoding='utf-8')
print(f"Generated {len(sql_lines)} INSERT statements → {sql_file}")

# ── Step 2: Execute bulk INSERT ─────────────────────────────────────────────
print("\nInserting into DB...")
r = subprocess.run(
    ['docker', 'exec', '-i', 'shrimpatlas-db', 'psql', '-U', 'shrimpatlas', '-d', 'shrimpatlas'],
    input=sql_file.read_text(encoding='utf-8'),
    capture_output=True, text=True
)
if r.returncode == 0:
    print(f"✓ Inserted {len(sql_lines)} species")
else:
    print(f"ERROR: {r.stderr[-300:]}")

# Verify count
r2 = subprocess.run(
    ['docker', 'exec', 'shrimpatlas-db', 'psql', '-U', 'shrimpatlas', '-d', 'shrimpatlas', '-t', '-c', 'SELECT COUNT(*) FROM shrimp_species;'],
    capture_output=True, text=True
)
print(f"Total species in DB: {r2.stdout.strip()}")

# Save the list of newly added species for later processing
new_list_file = TMP / 'new_species_list.json'
new_list_file.write_text(json.dumps(new_species, indent=2, ensure_ascii=False))
print(f"Saved new species list to {new_list_file}")
