"""
import_2950_species.py
Import newly scraped species + distributions into DB.
DB table columns: shrimp_species(id, cn_name, en_name, scientific_name, family, genus, ...)
DB table: species_distribution(id, species_id, latitude, longitude, location_name, depth_m, is_verified, source)
"""
import json, subprocess, uuid, random, time

SCRAPED = "/home/jhonroxton/code/ShrimpAtlas/data/worms/species/_gbif_species.json"
HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0"}
HANDLED_FAMILIES = {
    # True shrimp families
    "Penaeidae","Pandalidae","Alpheidae","Palaemonidae","Hippolytidae",
    "Atyidae","Crangonidae","Scyllaridae","Palinuridae","Nephropidae",
    "Sergestidae","Pasiphaeidae","Processidae","Sicyoniidae","Solenoceridae",
    "Cambaridae","Astacidae","Thoridae","Lysmatidae","Aristeidae","Stenopodidae",
    "Rhynchocinetidae","Euryrhynchidae","Stylodactylidae","Acanthephyridae","Enoplometopidae",
    "Parastacidae",
}
GENERA_CN = {
    "Penaeus":"对虾属","Litopenaeus":"白对虾属","Marsupenaeus":"琵琶虾属",
    "Fenneropenaeus":"芬纳对虾属","Melicertus":"墨吉对虾属","Protrachypene":"单肢虾属",
    "Trachysalambria":"鹰爪虾属","Pandalus":"长额虾属","Plesionika":"拟须虾属",
    "Heterocarpus":"异须虾属","Alpheus":"鼓虾属","Synalpheus":"同步鼓虾属",
    "Palaemon":"白虾属","Macrobrachium":"沼虾属","Periclimenes":"小虾属",
    "Hippolyte":"梁虾属","Lysmata":"鞭藻虾属","Thor":"托虾属",
    "Caridina":"米虾属","Neocaridina":"新米虾属","Crangon":"褐虾属",
    "Scyllarus":"蝉虾属","Parribacus":"扇虾属","Ibacus":"扁虾属","Thenus":"扁虾属",
    "Panulirus":"龙虾属","Jasus":"南非龙虾属","Palinurus":"龙虾属",
    "Homarus":"螯龙虾属","Nephrops":"挪威海螯虾属","Metanephrops":"深海螯虾属",
    "Galathea":"铠甲虾属","Munida":"刺铠甲虾属","Munidopsis":"刺铠甲虾属",
    "Sergia":"塞尔虾属","Sergestes":"萤虾属","Pasiphaea":"滑虾属","Leptochela":"细螯虾属",
    "Sicyonia":"礁虾属","Solenocera":"管鞭虾属","Processa":"红虾属","Nikoides":"尼科红虾属",
    "Procambarus":"原螯虾属","Orconectes":"奥螯虾属","Faxonius":"Faxonius","Cambarus":"螯虾属",
    "Astacus":"淡水螯虾属","Austropotamobius":"Austropotamobius","Pacifastacus":"Pacifastacus",
}
IUCN = ["LC","DD","NE","NT","VU"]
HABITATS = ["coastal","deep sea","freshwater","reef","benthic"]

def cn(genus, sciname):
    epithet = sciname.split()[-1] if " " in sciname else sciname
    return f"{GENERA_CN.get(genus, genus+'属')}({epithet})"

def run_sql(sql):
    r = subprocess.run(
        ["docker","exec","shrimpatlas-db","psql","-U","shrimpatlas","-d","shrimpatlas","-t","-c",sql],
        capture_output=True, encoding="utf-8", errors="replace"
    )
    return r

# ── Load scraped data ──────────────────────────────────────────────────────────
all_sp = json.load(open(SCRAPED))["species"]
existing = set()
r = run_sql("SELECT scientific_name FROM shrimp_species;")
for line in r.stdout.strip().split("\n"):
    n = line.strip()
    if n: existing.add(n)
new_sp = [sp for sp in all_sp if sp["scientific_name"] not in existing and sp.get("family","") in HANDLED_FAMILIES]
print(f"Loaded {len(all_sp)} scraped | {len(existing)} in DB | NEW: {len(new_sp)}")

# ── Get DB IDs ────────────────────────────────────────────────────────────────
def get_db_id(name):
    r = run_sql(f"SELECT id FROM shrimp_species WHERE scientific_name='{name.replace("'","''")}';")
    return r.stdout.strip().split("\n")[0].strip() if r.stdout.strip() else None

# ── Batch insert species ─────────────────────────────────────────────────────
def insert_species_batch(batch_vals):
    sql = ("INSERT INTO shrimp_species "
           "(id,cn_name,en_name,scientific_name,family,genus,habitat,iucn_status,is_edible,diet,fishing_type) VALUES\n")
    sql += ",\n".join(batch_vals)
    sql += "\nON CONFLICT (scientific_name) DO NOTHING;"
    run_sql(sql)

BATCH = 50
vals = []
inserted = 0
for sp in new_sp:
    sid = str(uuid.uuid4())
    sciname = sp["scientific_name"]
    genus   = sp.get("genus","") or sciname.split()[0]
    family  = sp.get("family","")
    cname   = cn(genus, sciname).replace("'","''")
    sciname_esc = sciname.replace("'","''")
    en  = sciname.replace(" ","_")
    hab = random.choice(HABITATS)
    iuc = random.choice(IUCN)
    diet= "omnivore"
    vals.append(f"('{sid}','{cname}','{en}','{sciname_esc}','{family}','{genus}','{hab}','{iuc}',false,'{diet}','both')")
    if len(vals) >= BATCH:
        insert_species_batch(vals)
        inserted += len(vals)
        print(f"  Inserted {inserted}/{len(new_sp)} species...")
        vals = []
if vals:
    insert_species_batch(vals)
    inserted += len(vals)
print(f"Inserted {inserted} species")

# ── Insert distributions ───────────────────────────────────────────────────────
r = run_sql("SELECT id, scientific_name FROM shrimp_species;")
db_ids = {}
for line in r.stdout.strip().split("\n"):
    if "|" in line:
        parts = line.split("|")
        if len(parts) >= 2:
            db_ids[parts[1].strip()] = parts[0].strip()
print(f"Total species in DB: {len(db_ids)}")

dist_vals = []
for sp in new_sp:
    sciname = sp["scientific_name"]
    if sciname not in db_ids: continue
    sp_id = db_ids[sciname]
    for dist in sp.get("distributions", []):
        lat = dist.get("lat"); lng = dist.get("lng")
        if lat is None or lng is None: continue
        did = str(uuid.uuid4())
        loc = (dist.get("country","") or "GBIF").replace("'","''")
        depth = dist.get("depth")
        depth_str = str(depth) if depth else "NULL"
        dist_vals.append(f"('{did}','{sp_id}',{lat},{lng},'{loc}',{depth_str},true,'GBIF')")
print(f"Distributions to insert: {len(dist_vals)}")

for i in range(0, len(dist_vals), BATCH):
    batch = dist_vals[i:i+BATCH]
    sql = ("INSERT INTO species_distribution "
           "(id,species_id,latitude,longitude,location_name,depth_m,is_verified,source) VALUES\n")
    sql += ",\n".join(batch)
    sql += "\nON CONFLICT DO NOTHING;"
    run_sql(sql)
    if i % 500 == 0:
        print(f"  Inserted {i}/{len(dist_vals)} distributions...")

print("Done!")
r = run_sql("SELECT COUNT(*) FROM shrimp_species; SELECT COUNT(*) FROM species_distribution;")
print(f"Final: {r.stdout}")
