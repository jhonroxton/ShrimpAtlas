"""
High-Resolution Species Image Fetcher
Prioritizes the highest-resolution photos from:
1. iNaturalist original (full resolution)
2. WoRMS high-res thumbnails
3. GBIF best quality
"""

import requests
import json
import time
from pathlib import Path

DATA_DIR = Path(__file__).parent
SPECIES_FILE = DATA_DIR / "worms" / "species" / "_all_species.json"
IMAGES_FILE = DATA_DIR / "worms" / "species" / "_all_images.json"
OUTPUT_FILE = DATA_DIR / "worms" / "species" / "_all_images_hires.json"

HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0 (non-commercial)"}

def get_inat_photos(scientific_name: str) -> list[dict]:
    """Get highest-res iNaturalist photos (original resolution)"""
    photos = []
    try:
        r = requests.get(
            "https://api.gbif.org/v1/occurrence/search",
            params={"scientificName": scientific_name, "mediaType": "StillImage", "limit": 20},
            headers=HEADERS,
            timeout=15,
        )
        if r.status_code != 200:
            return []

        for occ in r.json().get("results", []):
            for m in occ.get("media", []):
                identifier = m.get("identifier", "")
                if "inaturalist" in identifier.lower() and "original" in identifier:
                    # This is full resolution!
                    license = m.get("rights", "CC-BY-NC")
                    photos.append({
                        "url": identifier,  # /original.jpg = full resolution
                        "thumbnail": identifier.replace("/original.", "/small."),
                        "license": license if license else "CC-BY-NC",
                        "source": "iNaturalist",
                        "resolution": "original",
                    })
    except Exception as e:
        print(f"    iNat error: {e}")
    return photos[:5]

def get_worms_hi_res(aphia_id: int) -> list[dict]:
    """Get WoRMS high-res images (from their image server)"""
    images = []
    try:
        # Try the WoRMS REST image endpoint
        r = requests.get(
            f"https://www.marinespecies.org/rest/AphiaImageByAphiaID/{aphia_id}",
            headers=HEADERS,
            timeout=10,
        )
        if r.status_code == 200 and r.text:
            try:
                data = r.json()
                items = data if isinstance(data, list) else [data]
                for item in items:
                    url = item.get("url", "")
                    if url:
                        # Convert thumbnail to full-res if possible
                        full_url = url.replace("/thumbs/", "/images/").replace("_thumb", "")
                        images.append({
                            "url": full_url,
                            "thumbnail": url,
                            "license": "CC-BY",
                            "source": "WoRMS",
                            "resolution": "high",
                        })
            except:
                pass
    except Exception as e:
        print(f"    WoRMS error: {e}")
    return images[:3]

def get_gbif_best_photos(scientific_name: str) -> list[dict]:
    """Get best quality GBIF photos"""
    photos = []
    try:
        r = requests.get(
            "https://api.gbif.org/v1/occurrence/search",
            params={"scientificName": scientific_name, "mediaType": "StillImage", "limit": 10},
            headers=HEADERS,
            timeout=15,
        )
        if r.status_code != 200:
            return []

        for occ in r.json().get("results", []):
            for m in occ.get("media", []):
                identifier = m.get("identifier", "")
                if identifier and identifier.endswith((".jpg", ".jpeg", ".png")):
                    # Prefer larger images (prefer inaturalist originals)
                    is_original = "original" in identifier
                    photos.append({
                        "url": identifier,
                        "license": m.get("rights", "CC-BY"),
                        "source": "GBIF",
                        "resolution": "original" if is_original else "medium",
                    })
    except Exception as e:
        print(f"    GBIF error: {e}")
    return photos[:5]

def main():
    with open(SPECIES_FILE, encoding="utf-8") as f:
        species = json.load(f)

    with open(IMAGES_FILE, encoding="utf-8") as f:
        existing = json.load(f)

    print(f"Fetching hi-res images for {len(species)} species...")

    results = {}
    for sp in species:
        name = sp.get("scientific_name", "")
        aphia_id = sp.get("worms_aphia_id")
        print(f"\n{name}", end=" ")

        all_photos = []

        # 1. iNaturalist original (highest priority - full resolution)
        inat = get_inat_photos(name)
        if inat:
            print(f"✓ {len(inat)} iNat original photos")
            all_photos.extend(inat)

        # 2. WoRMS hi-res
        if aphia_id:
            worms = get_worms_hi_res(aphia_id)
            if worms:
                print(f"✓ {len(worms)} WoRMS hi-res")
                all_photos.extend(worms)

        # 3. GBIF best
        gbif = get_gbif_best_photos(name)
        if gbif:
            print(f"✓ {len(gbif)} GBIF photos")
            all_photos.extend(gbif)

        # Deduplicate by URL
        seen = set()
        unique = []
        for p in all_photos:
            if p["url"] not in seen:
                seen.add(p["url"])
                unique.append(p)

        # Sort: original first, then by source
        def sort_key(p):
            source_order = {"iNaturalist": 0, "WoRMS": 1, "GBIF": 2}
            return (0 if p["resolution"] == "original" else 1, source_order.get(p["source"], 3))

        unique.sort(key=sort_key)

        results[name] = {
            "worms_aphia_id": aphia_id,
            "photos": unique[:5],
            "count": len(unique),
        }

        if unique:
            print(f"  → {unique[0]['source']} {unique[0]['resolution']}: {unique[0]['url'][:70]}")
        else:
            print("  ✗ no photos")

        time.sleep(0.4)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    total = sum(1 for v in results.values() if v["photos"])
    print(f"\n\nDone! {total}/{len(species)} species with hi-res photos")
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
