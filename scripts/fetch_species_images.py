#!/usr/bin/env python3
"""
fetch_species_images.py
自动为缺失图片的物种从 Wikipedia 抓取照片。

用法:
    pip install requests pillow
    python3 scripts/fetch_species_images.py [--limit N] [--dry-run]

需要:
    - 数据库中所有物种的 scientific_name
    - 保存到 frontend/public/species-images/{Genus_species}/1.jpg
    - 自动更新数据库 images 字段
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import urllib.error
import argparse
import sqlite3

# ── Config ────────────────────────────────────────────────────────────────────

DB_PATH = os.path.join(os.path.dirname(__file__), "../backend/shrimpatlas.db")
IMG_ROOT = os.path.join(os.path.dirname(__file__), "../frontend/public/species-images")
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"

# ── DB helpers ───────────────────────────────────────────────────────────────

def get_db():
    # Try PostgreSQL first, then SQLite fallback
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=os.environ.get("DB_HOST", "localhost"),
            port=int(os.environ.get("DB_PORT", "5432")),
            database=os.environ.get("DB_NAME", "shrimpatlas"),
            user=os.environ.get("DB_USER", "shrimpatlas"),
            password=os.environ.get("DB_PASSWORD", "shrimpatlas"),
        )
        print("[DB] Connected via PostgreSQL")
        return conn, "postgres"
    except Exception:
        db_path = os.environ.get("DB_PATH", DB_PATH)
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            print(f"[DB] Connected via SQLite: {db_path}")
            return conn, "sqlite"
        raise RuntimeError("Cannot connect to database. Set DB_* env vars or place shrimpatlas.db next to script.")

def get_species_without_images(conn, db_type, limit=None):
    """Fetch species that need images."""
    if db_type == "postgres":
        cur = conn.cursor()
        cur.execute("""
            SELECT id, scientific_name, cn_name, genus
            FROM shrimp_species
            WHERE images IS NULL OR images = '{}'::text[] OR images[1] IS NULL
            ORDER BY cn_name
            LIMIT %s
        """, (limit,) if limit else (999999,))
    else:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, scientific_name, cn_name, genus
            FROM shrimp_species
            WHERE images IS NULL OR images = '{}' OR images[1] IS NULL
            LIMIT ?
        """, (limit,) if limit else (999999,))
    rows = cur.fetchall()
    cur.close()
    return rows

def update_species_image(conn, db_type, species_id, image_path):
    """Update the images column for a species."""
    path = f"/species-images/{image_path}"
    if db_type == "postgres":
        cur = conn.cursor()
        cur.execute(
            "UPDATE shrimp_species SET images = %s WHERE id = %s",
            ([path], species_id)
        )
        cur.close()
    else:
        cur = conn.cursor()
        cur.execute(
            "UPDATE shrimp_species SET images = ? WHERE id = ?",
            (json.dumps([path]), species_id)
        )
        cur.close()
    conn.commit()

# ── Wikipedia API ─────────────────────────────────────────────────────────────

def search_wikipedia_image(scientific_name):
    """
    Search Wikipedia for an image of a species.
    Returns (image_url, image_name) or (None, None).
    """
    # Try exact scientific name search first
    query = scientific_name.replace("_", " ")
    params = {
        "action": "query",
        "format": "json",
        "titles": query,
        "prop": "pageimages",
        "piprop": "original",
        "pithumbsize": 800,
    }
    url = f"{WIKIPEDIA_API}?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ShrimpAtlasBot/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"  [WARN] Wikipedia search failed for {query}: {e}")
        return None, None

    pages = data.get("query", {}).get("pages", {})
    for page_id, page_data in pages.items():
        if page_id == "-1":  # Page not found
            continue
        orig = page_data.get("original", {})
        if orig and orig.get("source"):
            img_url = orig["source"]
            img_name = orig.get("name", "unknown.jpg")
            # Check if image is freely licensed
            ext = os.path.splitext(img_name)[1].lower()
            if ext not in [".jpg", ".jpeg", ".png", ".gif"]:
                ext = ".jpg"
            return img_url, ext
    return None, None

def search_wikidata_image(scientific_name):
    """
    Fallback: search Wikidata for an image.
    """
    query = scientific_name.replace("_", " ")
    params = {
        "action": "wbgetentities",
        "format": "json",
        "titles": query,
        "props": "image",
        "languages": "en",
    }
    url = f"https://www.wikidata.org/w/api.php?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ShrimpAtlasBot/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return None

    entities = data.get("entities", {})
    for entity_id, entity in entities.items():
        claims = entity.get("claims", {})
        if "P18" in claims:  # Image property
            img_name = claims["P18"][0]["mainsnak"]["datavalue"]["value"]
            # Try to get the actual image URL from Wikimedia Commons
            commons_params = {
                "action": "query",
                "titles": f"File:{img_name}",
                "prop": "imageinfo",
                "iiprop": "url",
                "format": "json",
            }
            commons_url = f"https://en.wikipedia.org/w/api.php?{urllib.parse.urlencode(commons_params)}"
            try:
                creq = urllib.request.Request(commons_url, headers={"User-Agent": "ShrimpAtlasBot/1.0"})
                with urllib.request.urlopen(creq, timeout=10) as cresp:
                    cdata = json.loads(cresp.read().decode())
                pages = cdata.get("query", {}).get("pages", {})
                for pid, pdata in pages.items():
                    info = pdata.get("imageinfo", [{}])[0]
                    if info.get("url"):
                        ext = os.path.splitext(img_name)[1].lower() or ".jpg"
                        return info["url"], ext
            except Exception:
                pass
    return None

def search_gbif_image(scientific_name):
    """
    Fallback: search GBIF (Global Biodiversity Information Facility) for photos.
    GBIF has many species photos under open licenses.
    """
    query = scientific_name.replace("_", " ")
    url = f"https://api.gbif.org/v1/species/match?name={urllib.parse.quote(query)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ShrimpAtlasBot/1.0 (shrimpatlas@example.com)"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return None

    if data.get("usageKey"):
        # Get media/photos for this species
        key = data["usageKey"]
        media_url = f"https://api.gbif.org/v1/species/{key}/media"
        try:
            mreq = urllib.request.Request(media_url, headers={"User-Agent": "ShrimpAtlasBot/1.0"})
            with urllib.request.urlopen(mreq, timeout=10) as mresp:
                mdata = json.loads(mresp.read().decode())
            if mdata.get("results"):
                for result in mdata["results"]:
                    if result.get("license", "").startswith("http://creativecommons.org"):
                        return result.get("identifier"), ".jpg"
                    # Also accept CC-BY and other open licenses
                    if "creativecommons" in result.get("license", "").lower():
                        return result.get("identifier"), ".jpg"
        except Exception:
            pass
    return None

# ── Image download ────────────────────────────────────────────────────────────

def download_image(url, dest_path):
    """Download image from URL to dest_path. Returns True on success."""
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "ShrimpAtlasBot/1.0 (contact@shrimpatlas.com)"
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()

        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "wb") as f:
            f.write(data)
        size = os.path.getsize(dest_path)
        print(f"  [OK] Downloaded {size/1024:.0f} KB → {dest_path}")
        return True
    except Exception as e:
        print(f"  [FAIL] {e}")
        return False

def make_folder_name(scientific_name):
    """Convert scientific name to folder name: 'Panulirus ornatus' → 'Panulirus_ornatus'"""
    return scientific_name.strip().replace(" ", "_").replace("/", "_")

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fetch species images from Wikipedia/GBIF")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of species to process")
    parser.add_argument("--dry-run", action="store_true", help="Don't download, just show what would be done")
    parser.add_argument("--resume", action="store_true", help="Resume from last run (skip already attempted)")
    args = parser.parse_args()

    # Connect to DB
    try:
        conn, db_type = get_db()
    except Exception as e:
        print(f"[ERROR] Cannot connect to database: {e}")
        print("Set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD environment variables.")
        print("Or place shrimpatlas.db next to this script.")
        sys.exit(1)

    # Get species without images
    species_list = get_species_without_images(conn, db_type, limit=args.limit)
    print(f"\n[INFO] Found {len(species_list)} species without images")
    if args.dry_run:
        print("\n[DRY RUN] First 10 species that would be processed:")
        for row in species_list[:10]:
            print(f"  - {row[2]} | {row[1]}")
        return

    if not species_list:
        print("Nothing to do.")
        return

    # Track progress
    progress_file = os.path.join(os.path.dirname(__file__), ".fetch_progress.json")
    attempted = set()
    if args.resume and os.path.exists(progress_file):
        with open(progress_file) as f:
            attempted = set(json.load(f))
        print(f"[INFO] Resuming: skipping {len(attempted)} previously attempted species")

    success_count = 0
    fail_count = 0
    skip_count = 0

    for i, (species_id, scientific_name, cn_name, genus) in enumerate(species_list):
        folder_name = make_folder_name(scientific_name)
        folder_path = os.path.join(IMG_ROOT, folder_name)
        img_path = os.path.join(folder_path, "1.jpg")

        print(f"\n[{i+1}/{len(species_list)}] {cn_name} | {scientific_name}")

        # Skip if already attempted
        if scientific_name in attempted:
            print(f"  [SKIP] Already attempted")
            skip_count += 1
            continue

        # If image file already exists locally, just update DB
        if os.path.exists(img_path):
            print(f"  [EXISTS] Local file found, updating DB")
            update_species_image(conn, db_type, species_id, f"{folder_name}/1.jpg")
            success_count += 1
            attempted.add(scientific_name)
            with open(progress_file, "w") as f:
                json.dump(list(attempted), f)
            continue

        # Try Wikipedia image search
        img_url, ext = search_wikipedia_image(scientific_name)

        # Try Wikidata if Wikipedia failed
        if not img_url:
            img_url, ext = search_wikidata_image(scientific_name)

        # Try GBIF if Wikidata failed
        if not img_url:
            img_url, ext = search_gbif_image(scientific_name)

        if not img_url:
            print(f"  [MISS] No image found on Wikipedia/Wikidata/GBIF")
            attempted.add(scientific_name)
            with open(progress_file, "w") as f:
                json.dump(list(attempted), f)
            fail_count += 1
            continue

        # Download
        if download_image(img_url, img_path):
            update_species_image(conn, db_type, species_id, f"{folder_name}/1.jpg")
            success_count += 1
        else:
            fail_count += 1

        attempted.add(scientific_name)
        with open(progress_file, "w") as f:
            json.dump(list(attempted), f)

        # Be polite: rate limit to Wikipedia
        time.sleep(0.3)

    conn.close()
    print(f"\n{'='*50}")
    print(f"[DONE] Success: {success_count} | Failed: {fail_count} | Skipped: {skip_count}")
    print(f"Images saved to: {IMG_ROOT}")
    print(f"Run with --resume to continue from where you left off.")

if __name__ == "__main__":
    main()
