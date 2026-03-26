"""
EOL (Encyclopedia of Life) Data Fetcher
Fetches species descriptions and additional images from EOL.
"""

import requests
import json
import time
from pathlib import Path

DATA_DIR = Path(__file__).parent
SPECIES_FILE = DATA_DIR / "worms" / "species" / "_all_species.json"
IMAGES_FILE = DATA_DIR / "worms" / "species" / "_all_images.json"
OUTPUT_FILE = DATA_DIR / "worms" / "species" / "_eol_data.json"

HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0 (non-commercial)"}

# Common shrimp species EOL page IDs mapping
# EOL uses numeric page IDs, we need to search first
EOL_SEARCH_URL = "https://eol.org/api/search/v1.0/{query}"
EOL_PAGE_URL = "https://eol.org/api/pages/v1.0/{id}"
EOL_MEDIA_URL = "https://eol.org/api/media/v1.0/{id}"

def search_eol_page(scientific_name: str) -> int | None:
    """Search EOL for a species page ID"""
    # Use the search API
    url = f"https://eol.org/api/search/v1.0/{requests.utils.quote(scientific_name)}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        # Find exact match
        for r in results:
            if r.get("title", "").lower() == scientific_name.lower():
                return r.get("id")
        # Return first result if any
        if results:
            return results[0].get("id")
    except Exception as e:
        print(f"  Search error: {e}")
    return None

def get_eol_media(page_id: int) -> dict:
    """Get media (images + descriptions) from EOL"""
    url = f"https://eol.org/api/media/v1.0/{page_id}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"  Media error: {e}")
        return {}

def get_eol_descriptions(page_id: int) -> list[dict]:
    """Get descriptions from EOL"""
    url = f"https://eol.org/api/pages/v1.0/{page_id}"
    params = {"images_per_page": 5, "videos_per_page": 0}
    try:
        resp = requests.get(url, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return data.get("dataObjects", [])
    except Exception as e:
        print(f"  Page error: {e}")
        return []

def extract_useful_data(media: dict) -> dict:
    """Extract useful image URLs and descriptions"""
    results = {
        "images": [],
        "descriptions": [],
        "vernacular_names": [],
    }

    for item in media.get("items", []):
        # Only use CC-licensed images
        license = item.get("license", "")
        if "cc-" not in license.lower() and "public" not in license.lower():
            continue

        if item.get("mimeType", "").startswith("image/"):
            url = item.get("identifier") or item.get("eolMediaURL", "")
            if url:
                results["images"].append({
                    "url": url,
                    "license": license,
                    "source": "EOL",
                })

    return results

def main():
    with open(SPECIES_FILE, encoding="utf-8") as f:
        species = json.load(f)

    print(f"Fetching EOL data for {len(species)} species...")

    eol_results = {}
    found = 0

    for sp in species:
        name = sp.get("scientific_name", "")
        print(f"Searching EOL: {name}", end=" ")

        page_id = search_eol_page(name)
        if page_id:
            print(f"✓ page ID={page_id}", end=" ")
            time.sleep(0.4)

            media = get_eol_media(page_id)
            data = extract_useful_data(media)

            eol_results[name] = {
                "eol_page_id": page_id,
                "images": data["images"][:5],  # top 5
                "image_count": len(data["images"]),
                "descriptions_count": len(data["descriptions"]),
            }

            if data["images"]:
                print(f"✓ {len(data['images'])} images")
                found += 1
            else:
                print("✗ no CC images")
        else:
            print("✗ page not found")
            eol_results[name] = {"eol_page_id": None, "images": [], "image_count": 0}

        time.sleep(0.3)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(eol_results, f, indent=2, ensure_ascii=False)

    print(f"\nDone! EOL images for {found}/{len(species)} species")
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
