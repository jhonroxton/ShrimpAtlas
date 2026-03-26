# ShrimpAtlas 数据目录

## 数据来源

### 1. WoRMS (World Register of Marine Species)
- **官网**: https://www.marinespecies.org/
- **REST API**: https://www.marinespecies.org/rest/
- **API 文档**: https://www.marinespecies.org/wiki/MarineSpecies_Wiki

**关键端点（虾类 Decapod 数据）:**
- 按分类搜索: `GET https://www.marinespecies.org/rest/AphiaRecordsByName/{name}`
- 按 Taxon ID: `GET https://www.marinespecies.org/rest/AphiaRecordByAphiaID/{id}`
- 分类列表: `GET https://www.marinespecies.org/rest/AphiaClassificationByAphiaID/{id}`
- 同义词: `GET https://www.marinespecies.org/rest/AphiaSynonymsByAphiaID/{id}`

**搜索 Decapod（螯虾/虾类）:**
- Taxon ID 范围: Decapod ~ 1070
- 热知识科: Palaemonidae(科), Crangonidae, Penaeidae, etc.

### 2. IUCN Red List
- **官网**: https://www.iucnredlist.org/
- **API**: https://apiv3.iucnredlist.org/api/v3/species/id/{id}
- 需要 API Token（免费注册获取）

### 3. NOAA Ocean Currents
- **官网**: https://www.nodc.noaa.gov/
- **海表洋流数据**: https://www.ncei.noaa.gov/products/optical-earth-observing/currents

## 数据文件说明

```
data/
├── worms/              # WoRMS 物种原始数据
│   └── species/        # 物种 JSON
├── iucn/               # IUCN 濒危等级
├── noaa/               # NOAA 洋流数据
└── processed/          # 清洗后的数据（可直接导入数据库）
```

## 数据字段映射

### WoRMS → shrimp_species

| WoRMS 字段 | shrimp_species 字段 |
|------------|-------------------|
| scientificname | scientific_name |
| vernacularnames | cn_name / en_name |
| family | family |
| genus | genus |
| -- | max_length_cm (需额外查) |
| habitat | habitat |
| -- | temperature_zone (需推算) |
| -- | diet (需额外查) |
| isMarine | -- (过滤用) |

## 抓取优先级

**Phase 1 所需最少数据（~50种常见虾）:**
1. 中国海域常见虾类 10-15 种
2. 全球知名食用虾 10 种
3. 大洋代表性虾种 20-30 种

**推荐从 WoRMS API 批量抓取 Decapod 数据：**
- 搜索 "shrimp" 或 "penaeid" 等关键词
- 按地区过滤（可选）

## API Token 配置

在 `data/.env` 中配置：
```
IUCN_API_TOKEN=your_iucn_token_here
```
