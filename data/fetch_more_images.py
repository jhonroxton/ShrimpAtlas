"""
GBIF Species Image Fetcher
GBIF has millions of species photos - use it to supplement missing images.
"""

import requests
import json
import time
from pathlib import Path

DATA_DIR = Path(__file__).parent
SPECIES_FILE = DATA_DIR / "worms" / "species" / "_all_species.json"
IMAGES_FILE = DATA_DIR / "worms" / "species" / "_all_images.json"

HEADERS = {"User-Agent": "ShrimpAtlas/1.0 (research project)"}

# Species that need images (scientific name -> search query)
SPECIES_NEEDING_IMAGES = [
    "Penaeus chinensis",
    "Penaeus japonicus",
    "Penaeus subtilis",
    "Penaeus setiferus",
    "Penaeus aztecus",
    "Metapenaeus ensis",
    "Metapenaeus bennettae",
    "Metapenaeus mastersii",
    "Neocaridina denticulata",
    "Pandalus jordani",
    "Lysmata seticaudata",
    "Lysmata debelius",
    "Pasiphaea japonica",
    "Acetes japonicus",
    "Acetes intermedius",
    "Benthesicymus tanneri",
    "Alpheus bellimanus",
]

def search_gbif_images(scientific_name: str) -> list[dict]:
    """Search GBIF for species images"""
    # First search for the species key
    search_url = "https://api.gbif.org/v1/species/match"
    params = {"name": scientific_name}
    try:
        resp = requests.get(search_url, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if data.get("matchType") == "EXACT":
            species_key = data.get("speciesKey")
            if species_key:
                # Get media/photos for this species
                media_url = f"https://api.gbif.org/v1/species/{species_key}/media"
                media_resp = requests.get(media_url, headers=HEADERS, timeout=10)
                if media_resp.status_code == 200:
                    media_data = media_resp.json()
                    items = media_data.get("results", [])
                    results = []
                    for item in items[:3]:  # top 3
                        if item.get("format") in ("StillImage", "Image"):
                            results.append({
                                "url": item.get("identifier"),
                                "title": item.get("title", ""),
                                "license": item.get("license", ""),
                                "source": "GBIF",
                            })
                    return results
    except Exception as e:
        print(f"  GBIF error for {scientific_name}: {e}")
    return []

def search_wikimedia(scientific_name: str) -> list[dict]:
    """Search Wikimedia Commons for species images"""
    # Use the Wikipedia API to search for images
    common_name = scientific_name.replace(" ", "_")
    search_url = f"https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": scientific_name,
        "prop": "pageimages",
        "format": "json",
        "pithumbsize": 600,
    }
    try:
        resp = requests.get(search_url, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        pages = data.get("query", {}).get("pages", {})
        results = []
        for page_id, page_data in pages.items():
            thumb = page_data.get("thumbnail", {})
            if thumb:
                results.append({
                    "url": thumb.get("source", ""),
                    "title": scientific_name,
                    "license": "CC BY-SA",
                    "source": "Wikimedia",
                })
        return results
    except Exception as e:
        print(f"  Wikimedia error for {scientific_name}: {e}")
    return []

def main():
    # Load existing images
    with open(IMAGES_FILE, encoding="utf-8") as f:
        images_data = json.load(f)

    # Find species that need images
    needing = []
    for name in SPECIES_NEEDING_IMAGES:
        info = images_data.get(name, {})
        if not info.get("images"):
            needing.append(name)

    print(f"Need images for {len(needing)} species...")

    for name in needing:
        print(f"Searching for: {name}", end=" ")

        # Try GBIF first
        results = search_gbif_images(name)

        # Try Wikimedia
        if not results:
            results = search_wikimedia(name)

        if results:
            print(f"✓ {len(results)} from {results[0]['source']}")
            # Add to images_data
            images_data[name] = {
                "worms_aphia_id": None,
                "images": [r["url"] for r in results],
                "count": len(results),
                "supplemental": True,
            }
        else:
            print("✗ not found")
        time.sleep(0.3)

    with open(IMAGES_FILE, 'w', encoding='utf-8') as f:
        json.dump(images_data, f, indent=2, ensure_ascii=False)

    total = sum(1 for v in images_data.values() if v.get('images'))
    print(f"\nTotal with images: {total}/{len(images_data)}")

if __name__ == '__main__':
    main()
