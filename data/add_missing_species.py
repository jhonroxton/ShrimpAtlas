"""
add_missing_species.py
补全用户提到的常见物种 + 更新正确中文俗名
"""
import subprocess, requests, uuid, random, time

HEADERS = {"User-Agent": "ShrimpAtlas-research/1.0"}
PAUSE = 0.3

def run_sql(sql):
    r = subprocess.run(
        ["docker", "exec", "shrimpatlas-db", "psql",
         "-U", "shrimpatlas", "-d", "shrimpatlas", "-t", "-c", sql],
        capture_output=True, encoding="utf-8", errors="replace"
    )
    return r

# ── 常见物种中文俗名映射 ────────────────────────────────────────────────────
COMMON_NAMES = {
    # 用户提到的常见物种
    "Panulirus ornatus": "中华锦绣龙虾",
    "Panulirus homarus": "港式锦绣龙虾",
    "Panulirus interruptus": "加州龙虾",
    "Panulirus argus": "加勒比龙虾",
    "Panulirus cygnus": "澳洲龙虾",
    "Panulirus vulgaris": "西非岩龙虾",
    "Homarus americanus": "波士顿龙虾",
    "Homarus gammarus": "欧洲龙虾",
    "Jasus edwardsii": "新西兰鳌虾",
    "Sagmariasus verreauxi": "澳洲龙虾",
    "Pandalus borealis": "牡丹虾",
    "Pandalus claviger": "粉红牡丹虾",
    "Pandalus hypsinotus": "红斑牡丹虾",
    "Pandalus montagui": "粉红虾",
    "Pandalus propinquus": "北大西洋虾",
    "Crangon crangon": "褐虾",
    "Metapenaeus ensis": "红爪虾",
    "Metapenaeus mastersii": "红爪明虾",
    "Metapenaeus monoceros": "单角沼虾",
    "Alpheus heterochaelis": "红爪鼓虾",
    "Alpheus armillatus": "红带鼓虾",
    "Alpheus rubellus": "红爪虾",
    "Alpheus heralditanus": "海红虾",
    "Alpheus saulnieryi": "红肢鼓虾",
    "Macrobrachium rosenbergii": "罗氏沼虾",
    "Macrobrachium nipponense": "日本沼虾",
    "Fenneropenaeus merguiensis": "孟加拉湾虾",
    "Fenneropenaeus indicus": "印度白虾",
    "Litopenaeus vannamei": "南美白对虾",
    "Litopenaeus setiferus": "墨西哥白虾",
    "Penaeus monodon": "斑节对虾",
    "Penaeus japonicus": "日本对虾",
    "Penaeus merguiensis": "香蕉虾",
    "Penaeus semisulcatus": "绿唇对虾",
    "Marsupenaeus japonicus": "日本对虾",
    "Portunus trituberculatus": "三疣梭子蟹",
    "Charybdis japonica": "日本蟳",
    "Scylla serrata": "锯缘青蟹",
    "Oratosquilla oratoria": "皮皮虾",
    "Hypothalassia armata": "武装精蛰虾",
    "Oplophorus sp.": "发光虾",
}

# ── 批量更新中文俗名 ─────────────────────────────────────────────────────────
updated = 0
for sciname, cn in COMMON_NAMES.items():
    cn_esc = cn.replace("'", "''")
    sql = f"UPDATE shrimp_species SET cn_name='{cn_esc}' WHERE scientific_name='{sciname.replace(chr(39), chr(39)+chr(39))}';"
    r = run_sql(sql)
    if r.returncode == 0:
        updated += 1

print(f"Updated {updated} common names")

# ── 验证 ───────────────────────────────────────────────────────────────────
r = run_sql("SELECT cn_name, scientific_name, family FROM shrimp_species WHERE cn_name IN ('中华锦绣龙虾','波士顿龙虾','新西兰鳌虾','澳洲龙虾','牡丹虾','红爪虾','皮皮虾','日本对虾','斑节对虾');")
print("\nUpdated species:")
print(r.stdout)

# ── 检查皮皮虾（口足目）是否需要单独加 ───────────────────────────────────────
r2 = run_sql("SELECT COUNT(*) FROM shrimp_species WHERE scientific_name ILIKE '%oratosquilla%';")
has_mantis = int(r2.stdout.strip().split("\n")[-1])
print(f"\n皮皮虾(Oratosquilla) in DB: {has_mantis}")

# ── 添加缺失的口足目物种 ─────────────────────────────────────────────────────
# 皮皮虾不在虾类数据库里，是口足目。如果用户需要可以加一个单独的表。
# 先用GBIF查一下Oratosquilla oratoria
if has_mantis == 0:
    r = requests.get("https://api.gbif.org/v1/species/match", params={"name": "Oratosquilla oratoria"}, headers=HEADERS, timeout=10)
    if r.status_code == 200:
        d = r.json()
        print(f"Oratosquilla oratoria: GBIF key={d.get('key')}, family={d.get('family')}, status={d.get('status')}")
    # 提示用户
    print("\n注意：皮皮虾(Oratosquilla oratoria)是口足目，不是对虾目。数据库是否需要加入口足目物种？")
