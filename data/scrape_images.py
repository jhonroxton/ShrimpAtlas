"""
WoRMS Species Image Scraper v2
Extracts real species photos from WoRMS HTML pages.
WoRMS stores images at: https://images.marinespecies.org/thumbs/{id}_{name}.jpg
"""

import requests
import json
import time
import os
from pathlib import Path
import re

DATA_DIR = Path(__file__).parent
SPECIES_FILE = DATA_DIR / "worms" / "species" / "_all_species.json"
OUTPUT_FILE = DATA_DIR / "worms" / "species" / "_all_images.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
}

def load_species():
    with open(SPECIES_FILE, encoding="utf-8") as f:
        return json.load(f)

def fetch_species_images(aphia_id: int, scientific_name: str) -> list[str]:
    """Scrape real species photos from WoRMS HTML page"""
    url = f"https://www.marinespecies.org/aphia.php?p=taxdetails&id={aphia_id}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        html = resp.text

        img_urls = []

        # Pattern 1: WoRMS image server: images.marinespecies.org/thumbs/{id}_{name}.jpg
        for match in re.findall(r'images\.marinespecies\.org/thumbs/(\d+_[^"]+\.(?:jpg|jpeg|png))', html):
            url_img = f'https://images.marinespecies.org/thumbs/{match}'
            img_urls.append(url_img)

        # Pattern 2: Any direct image link
        for match in re.findall(r'(https://images\.marinespecies\.org/[^\s"\'<>]+\.(?:jpg|jpeg|png))', html):
            if 'logo' not in match.lower() and 'icon' not in match.lower():
                img_urls.append(match)

        # Deduplicate and limit
        seen = set()
        unique = []
        for url_img in img_urls:
            if url_img not in seen:
                seen.add(url_img)
                unique.append(url_img)

        return unique[:5]
    except Exception as e:
        print(f"  Error: {e}")
        return []

def generate_worms_image_url(aphia_id: int, scientific_name: str) -> str:
    """Generate the WoRMS thumbnail URL directly from ID and name"""
    safe_name = scientific_name.lower().replace(' ', '-').replace('_', '-')
    return f"https://images.marinespecies.org/thumbs/{aphia_id}_{safe_name}.jpg"

def main():
    species = load_species()
    print(f"Fetching images for {len(species)} species...")

    results = {}
    for sp in species:
        aphia_id = sp.get('worms_aphia_id')
        name = sp.get('scientific_name', 'unknown')
        if not aphia_id:
            print(f"  {name}: no AphiaID, skipping")
            continue

        print(f"Fetching: {name} (AphiaID={aphia_id})", end=" ")

        # Try HTML scraping
        img_urls = fetch_species_images(aphia_id, name)

        # Always try the direct thumbnail URL pattern
        direct_url = generate_worms_image_url(aphia_id, name)
        if direct_url not in img_urls:
            # Verify it exists
            try:
                r = requests.head(direct_url, timeout=5, headers=HEADERS)
                if r.status_code == 200:
                    img_urls.insert(0, direct_url)
            except:
                pass

        results[name] = {
            'worms_aphia_id': aphia_id,
            'images': img_urls[:5],
            'count': len(img_urls),
        }

        if img_urls:
            print(f"✓ {len(img_urls)} images: {img_urls[0][-60:]}")
        else:
            print("✗ no images")

        time.sleep(0.3)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    total = sum(1 for r in results.values() if r['images'])
    print(f"\nDone! Found images for {total}/{len(species)} species")
    print(f"Results: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
