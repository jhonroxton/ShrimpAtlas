"""
fix_cn_names.py
Fix Chinese names: use scientific_name as cn_name for all species
where current cn_name has wrong format (e.g., "某属(epithet)").
Using proper scientific name ensures correct and readable display.
"""
import subprocess

def run_sql(sql):
    r = subprocess.run(
        ["docker", "exec", "shrimpatlas-db", "psql",
         "-U", "shrimpatlas", "-d", "shrimpatlas", "-t", "-c", sql],
        capture_output=True, encoding="utf-8", errors="replace"
    )
    return r

# Count before
r = run_sql("SELECT COUNT(*) FROM shrimp_species WHERE cn_name LIKE '%属(%';")
bad_count = int(r.stdout.strip().split("\n")[-1])
print(f"Species with bad Chinese names: {bad_count}")

# Fix: set cn_name = scientific_name
sql = """
UPDATE shrimp_species
SET cn_name = scientific_name
WHERE cn_name LIKE '%属(%';
"""
result = run_sql(sql)
print(f"SQL result: {result.stderr[:300] if result.stderr else 'ok'}")

# Verify
r2 = run_sql("SELECT COUNT(*) FROM shrimp_species WHERE cn_name LIKE '%属(%';")
remaining = int(r2.stdout.strip().split("\n")[-1])
print(f"Remaining bad names: {remaining}")

# Show sample
r3 = run_sql("SELECT cn_name, scientific_name, family FROM shrimp_species ORDER BY random() LIMIT 10;")
print("\nSample fixed names:")
print(r3.stdout)
