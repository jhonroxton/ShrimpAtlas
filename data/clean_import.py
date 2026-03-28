"""
Clean import: remove duplicates and non-shrimp entries from scraped data,
then merge into DB without duplicating existing records.
"""
import json
import subprocess
import sys

SCRAPED = '/home/jhonroxton/code/ShrimpAtlas/data/worms/species/_more_species.json'
ALL_SP   = '/home/jhonroxton/code/ShrimpAtlas/data/worms/species/_all_species.json'
OUTPUT   = '/tmp/shrimp_species_final.json'

# ── 1. Load & merge ──────────────────────────────────────────────────────────
more = json.load(open(SCRAPED))
all_ = json.load(open(ALL_SP))

by_name = {}
for sp in more: by_name[sp['scientific_name']] = sp
for sp in all_: by_name[sp['scientific_name']] = sp

print(f"Raw: {len(more)} + {len(all_)} = {len(more)+len(all_)} records")
print(f"After dedup: {len(by_name)} unique names")

# ── 2. Filter to true shrimp families ────────────────────────────────────────
# (exclude crabs, lobsters, hermit crabs)
SHRIMP_FAMILIES = {
    'Penaeidae','Crangonidae','Pandalidae','Pasiphaeidae','Atyidae',
    'Palaemonidae','Alpheidae','Sergestidae','Hippolytidae','Lysmatidae',
    'Scyllaridae','Palinuridae','Nephropidae','Enoplometopodidae','Galatheidae',
    'Potamidae','Thoridae','Campylonotidae','Rhynchocinetidae','Aristeidae',
    'Euryrhynchidae','Bresiliidae','Stylodactylidae','Sicyoniidae','Processidae',
    'Solenoceridae','Cambaridae','Astacidae','Cambaroididae',
}

clean = [sp for sp in by_name.values() if sp.get('family','') in SHRIMP_FAMILIES]
print(f"After removing non-shrimp: {len(clean)} shrimp species")

non_shrimp = [sp['scientific_name'] for sp in by_name.values() if sp.get('family','') not in SHRIMP_FAMILIES]
if non_shrimp:
    print(f"  Removed (non-shrimp): {non_shrimp}")

# ── 3. Save cleaned data ──────────────────────────────────────────────────────
with open(OUTPUT, 'w') as f:
    json.dump({'species': clean, 'count': len(clean)}, f, indent=2, ensure_ascii=False)
print(f"Saved → {OUTPUT}")

# ── 4. Check DB overlap ───────────────────────────────────────────────────────
result = subprocess.run(
    ['docker', 'exec', 'shrimpatlas-db', 'psql', '-U', 'shrimpatlas', '-d', 'shrimpatlas',
     '-t', '-c', 'SELECT scientific_name FROM shrimp_species;'],
    capture_output=True, text=True
)
db_names = set(line.strip() for line in result.stdout.strip().split('\n') if line.strip())
print(f"\nDB has {len(db_names)} species")

new_species = [sp for sp in clean if sp['scientific_name'] not in db_names]
print(f"NEW to import: {len(new_species)}")
print(f"Already in DB: {len(clean) - len(new_species)}")

if not new_species:
    print("Nothing new to import.")
    sys.exit(0)

# ── 5. Import new species via fast_bulk_import.py ─────────────────────────────
# Write new species to temp file for import
import_file = '/tmp/new_species_to_import.json'
with open(import_file, 'w') as f:
    json.dump({'species': new_species}, f, indent=2, ensure_ascii=False)

print(f"\nNew species written to {import_file}")
print("Run: python fast_bulk_import.py to complete import")
