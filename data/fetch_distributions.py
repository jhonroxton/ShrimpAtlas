"""
GBIF Occurrence / Distribution Data Fetcher
Gets actual geographic occurrence records from GBIF for each species.
These become the species distribution points shown on the 3D globe.
"""

import requests
import json
import time
from pathlib import Path
import uuid

DATA_DIR = Path(__file__).parent
SPECIES_FILE = DATA_DIR / "worms" / "species" / "_all_species.json"
OUTPUT_FILE = DATA_DIR / "worms" / "species" / "_all_distributions.json"

HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0 (non-commercial research)"}

def get_gbif_species_key(scientific_name: str) -> int | None:
    r = requests.get(
        "https://api.gbif.org/v1/species/match",
        params={"name": scientific_name},
        headers=HEADERS,
        timeout=10,
    )
    if r.status_code == 200:
        d = r.json()
        return d.get("usageKey")
    return None

def fetch_occurrences(scientific_name: str, limit: int = 20) -> list[dict]:
    """Fetch occurrence records with coordinates"""
    records = []
    try:
        r = requests.get(
            "https://api.gbif.org/v1/occurrence/search",
            params={
                "scientificName": scientific_name,
                "limit": limit,
                "hasCoordinate": True,
            },
            headers=HEADERS,
            timeout=15,
        )
        if r.status_code == 200:
            d = r.json()
            for occ in d.get("results", []):
                if occ.get("decimalLatitude") and occ.get("decimalLongitude"):
                    records.append({
                        "lat": occ.get("decimalLatitude"),
                        "lng": occ.get("decimalLongitude"),
                        "depth": occ.get("depth"),
                        "country": occ.get("country"),
                        "locality": occ.get("locality", ""),
                        "year": occ.get("year"),
                        "basis": occ.get("basisOfRecord", ""),
                        "source": "GBIF",
                    })
    except Exception as e:
        print(f"  Error: {e}")
    return records

def main():
    with open(SPECIES_FILE, encoding="utf-8") as f:
        species = json.load(f)

    print(f"Fetching GBIF distributions for {len(species)} species...")

    all_results = {}
    total_points = 0

    for sp in species:
        name = sp.get("scientific_name", "")
        print(f"  {name}", end=" ")

        gbif_key = get_gbif_species_key(name)
        if not gbif_key:
            print("✗ GBIF key not found")
            all_results[name] = {"gbif_key": None, "distributions": []}
            continue

        time.sleep(0.3)
        occurrences = fetch_occurrences(name, limit=20)

        all_results[name] = {
            "gbif_key": gbif_key,
            "distributions": occurrences,
            "count": len(occurrences),
        }

        total_points += len(occurrences)
        if occurrences:
            print(f"✓ {len(occurrences)} points (e.g. {occurrences[0]['country']})")
        else:
            print("✗ no coordinate records")

        time.sleep(0.3)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)

    species_with_points = sum(1 for v in all_results.values() if v.get("distributions"))
    print(f"\nDone! {species_with_points}/{len(species)} species with GBIF distributions")
    print(f"Total distribution points: {total_points}")
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
