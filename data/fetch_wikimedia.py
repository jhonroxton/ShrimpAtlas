"""
Wikimedia Commons Image Fetcher
Openly accessible, no token required. Great for marine species photos.
"""

import requests
import json
import time
from pathlib import Path

DATA_DIR = Path(__file__).parent
SPECIES_FILE = DATA_DIR / "worms" / "species" / "_all_species.json"
IMAGES_FILE = DATA_DIR / "worms" / "species" / "_all_images_hires.json"
OUTPUT_FILE = DATA_DIR / "worms" / "species" / "_all_images_final.json"

HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0 (non-commercial)"}

# Species that need images or better photos
MISSING_OR_POOR = [
    "Penaeus subtilis",
    "Acetes intermedius",
    "Pasiphaea japonica",
    "Benthesicymus tanneri",
    "Alpheus bellimanus",
    "Hippolyte inermis",
    "Processa edulis",
]

def search_wikimedia_images(query: str) -> list[dict]:
    """Search Wikimedia Commons for species images"""
    images = []
    try:
        # Search for files
        r = requests.get(
            "https://commons.wikimedia.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": query + " shrimp species",
                "format": "json",
                "srnamespace": 6,  # File namespace
                "srlimit": 10,
            },
            headers=HEADERS,
            timeout=15,
        )
        if r.status_code != 200:
            return []

        data = r.json()
        file_titles = [item["title"] for item in data.get("query", {}).get("search", [])]

        for title in file_titles[:5]:
            # Get file info (including image URL)
            file_r = requests.get(
                "https://commons.wikimedia.org/w/api.php",
                params={
                    "action": "query",
                    "titles": title,
                    "format": "json",
                    "prop": "imageinfo",
                    "iiprop": "url|extmetadata|mime",
                    "iiurlwidth": 1200,  # Request high-res
                },
                headers=HEADERS,
                timeout=10,
            )
            if file_r.status_code == 200:
                fd = file_r.json()
                pages = fd.get("query", {}).get("pages", {})
                for page_id, page_data in pages.items():
                    info = page_data.get("imageinfo", [{}])[0]
                    url = info.get("url", "")
                    mime = info.get("mime", "")
                    if url and "image" in mime:
                        # Get license info
                        rights = info.get("extmetadata", {}).get("LicenseShortName", {})
                        images.append({
                            "url": url,
                            "title": title,
                            "license": rights.get("value", "CC-BY-SA") if isinstance(rights, dict) else "CC-BY-SA",
                            "source": "Wikimedia Commons",
                            "resolution": "high",
                        })
    except Exception as e:
        print(f"    Error: {e}")
    return images

def search_wikimedia_with_name(scientific_name: str) -> list[dict]:
    """Try multiple search queries for a species"""
    queries = [
        scientific_name + " shrimp",
        scientific_name.replace(" ", "_") + "_shrimp",
        scientific_name.split()[0] + " " + scientific_name.split()[1] + " shrimp",
        scientific_name.split()[0] + " " + scientific_name.split()[1],
    ]
    for q in queries:
        imgs = search_wikimedia_images(q)
        if imgs:
            return imgs
    return []

def main():
    with open(SPECIES_FILE, encoding="utf-8") as f:
        species = json.load(f)

    # Load existing images
    try:
        with open(IMAGES_FILE, encoding="utf-8") as f:
            existing = json.load(f)
    except:
        existing = {}

    print(f"Searching Wikimedia Commons for {len(MISSING_OR_POOR)} missing species...")

    for name in MISSING_OR_POOR:
        print(f"\nSearching: {name}", end=" ")
        imgs = search_wikimedia_with_name(name)
        if imgs:
            print(f"✓ {len(imgs)} images")
            existing[name] = {
                "photos": imgs[:5],
                "count": len(imgs),
                "source": "Wikimedia Commons",
            }
        else:
            print("✗ no images")
        time.sleep(0.5)

    # Save final merged images
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)

    with_images = sum(1 for v in existing.values() if v.get("photos"))
    print(f"\nFinal: {with_images}/{len(existing)} species with images")
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
