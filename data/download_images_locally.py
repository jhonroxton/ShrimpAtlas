"""
Download all species images to local directory.
Images will be stored at: frontend/public/species-images/
And served at: /species-images/{species_id}/{index}.jpg
"""

import requests
import json
import time
import random
import concurrent.futures
import subprocess
import os
import hashlib
from pathlib import Path

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.inaturalist.org/',
}

IMAGE_DIR = Path('/home/jhonroxton/code/ShrimpAtlas/frontend/public/species-images')

# Get all species with images from DB
result = subprocess.run(
    ['docker', 'exec', 'shrimpatlas-db', 'psql', '-U', 'shrimpatlas', '-d', 'shrimpatlas', '-t', '-c',
     "SELECT id::text, scientific_name, images FROM shrimp_species WHERE images IS NOT NULL AND array_length(images,1) > 0;"],
    capture_output=True, text=True
)

tasks = []
for line in result.stdout.strip().split('\n'):
    if '|' not in line:
        continue
    parts = line.split('|')
    if len(parts) >= 3:
        sid = parts[0].strip()
        name = parts[1].strip()
        # Parse images array - format: {url1,url2,...}
        imgs_str = '|'.join(parts[2:]).strip()
        # Extract URLs from PostgreSQL array format (strip braces, split by comma)
        urls = []
        try:
            clean = imgs_str.strip('{}')
            urls = [u.strip() for u in clean.split(',') if u.strip().startswith('http')]
        except:
            pass
        if sid and name and urls:
            tasks.append({'sid': sid, 'name': name, 'urls': urls})

print(f"Species to download: {len(tasks)}")

IMAGE_DIR.mkdir(parents=True, exist_ok=True)

def sanitize_filename(name: str) -> str:
    """Convert scientific name to safe directory name"""
    return name.replace(' ', '_').replace('/', '_').replace("'", '')

def download_species_images(task: dict) -> dict:
    """Download all images for one species"""
    sid = task['sid']
    name = task['name']
    urls = task['urls']
    
    species_dir = IMAGE_DIR / sanitize_filename(name)
    species_dir.mkdir(exist_ok=True)
    
    local_urls = []
    for i, url in enumerate(urls):
        # Determine file extension
        ext = 'jpg'
        if '.png' in url.lower():
            ext = 'png'
        elif '.jpeg' in url.lower():
            ext = 'jpg'
        
        filename = f"{i+1}.{ext}"
        filepath = species_dir / filename
        
        # Skip if already downloaded
        if filepath.exists() and filepath.stat().st_size > 1000:
            local_path = f"/species-images/{sanitize_filename(name)}/{filename}"
            local_urls.append(local_path)
            print(f"  {name}: already exists, skipping")
            continue
        
        try:
            r = requests.get(url, headers=HEADERS, timeout=30, stream=True)
            if r.status_code == 200:
                content = r.content
                with open(filepath, 'wb') as f:
                    f.write(content)
                local_path = f"/species-images/{sanitize_filename(name)}/{filename}"
                local_urls.append(local_path)
                print(f"  ✓ {name} [{i+1}]: {filepath.stat().st_size//1024}KB")
            else:
                print(f"  ✗ {name} [{i+1}]: HTTP {r.status_code}")
        except Exception as e:
            print(f"  ✗ {name} [{i+1}]: {e}")
        
        time.sleep(random.uniform(0.2, 0.5))
    
    return {'sid': sid, 'name': name, 'local_urls': local_urls}

# Download all with thread pool
results = []
print("\nDownloading images...")
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    futures = {executor.submit(download_species_images, t): t for t in tasks}
    done = 0
    for future in concurrent.futures.as_completed(futures):
        result = future.result()
        results.append(result)
        done += 1
        if done % 10 == 0:
            print(f"Progress: {done}/{len(tasks)}")

print(f"\nDone! Downloaded images for {len(results)} species")

# Save mapping
mapping = {r['sid']: r['local_urls'] for r in results if r['local_urls']}
with open('/tmp/image_mapping.json', 'w') as f:
    json.dump(mapping, f, indent=2)
print(f"Saved mapping to /tmp/image_mapping.json")

# Generate SQL to update DB
print("\nGenerating SQL updates...")
sql_updates = []
for sid, urls in mapping.items():
    url_list = ','.join(f"'{u}'" for u in urls)
    sql = f"UPDATE shrimp_species SET images = ARRAY[{url_list}]::TEXT[] WHERE id = '{sid}';"
    sql_updates.append(sql)

sql_file = Path('/tmp/update_images_local.sql')
sql_file.write_text('\n'.join(sql_updates))
print(f"Generated {len(sql_updates)} SQL updates → {sql_file}")
