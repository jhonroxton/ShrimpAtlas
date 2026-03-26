# ShrimpAtlas 技术规格文档

## 1. 概述与目标

ShrimpAtlas 是一个以 3D 地球为载体的海洋科普平台，通过可视化展示全球虾类分布，并结合洋流与气候系统，让用户以探索的方式理解海洋生态。

## 2. 技术栈

### 前端
- **框架**: React 18 + TypeScript + Vite
- **样式**: Tailwind CSS (deep-sea theme)
- **3D 地球**: CesiumJS
- **地图可视化**: deck.gl
- **路由**: react-router-dom v6
- **HTTP 客户端**: axios

### 后端
- **框架**: Python FastAPI
- **数据库**: PostgreSQL + PostGIS
- **ORM**: SQLAlchemy (async)
- **认证**: JWT (python-jose)
- **验证**: Pydantic v2

### 部署
- **前端**: 静态托管 / 腾讯云 COS
- **后端**: Uvicorn (ASGI)
- **对象存储**: 腾讯云 COS

## 3. 项目结构

```
ShrimpAtlas/
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── components/      # 可复用组件
│   │   ├── pages/           # 页面组件
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── types/           # TypeScript 类型定义
│   │   ├── api/             # API 请求封装
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/             # API 路由
│   │   ├── models/          # SQLAlchemy 模型
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── core/             # 核心配置
│   │   ├── crud/             # CRUD 操作
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
├── .github/
│   └── workflows/
│       ├── frontend.yml
│       └── backend.yml
└── data/                    # 静态数据
```

## 4. 前端域名与配置

- 开发服务器: http://localhost:5173
- API Base URL: http://localhost:8000/api/v1

## 5. 数据库Schema

### shrimp_species (虾类物种表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| cn_name | VARCHAR(100) | 中文名 |
| en_name | VARCHAR(200) | 英文名 |
| scientific_name | VARCHAR(200) | 拉丁学名 |
| family | VARCHAR(100) | 科 |
| genus | VARCHAR(100) | 属 |
| max_length_cm | DECIMAL | 最大体长(cm) |
| color_description | TEXT | 颜色特征 |
| habitat | VARCHAR(50) | 栖息环境 |
| temperature_zone | VARCHAR(20) | 温度带 |
| diet | VARCHAR(50) | 食性 |
| is_edible | BOOLEAN | 是否可食用 |
| edible_regions | TEXT[] | 常见食用地区 |
| fishing_type | VARCHAR(20) | 捕捞方式 |
| iucn_status | VARCHAR(10) | IUCN状态 |
| threats | TEXT[] | 威胁因素 |
| images | TEXT[] | 图片URL列表 |
| created_at | TIMESTAMP | 创建时间 |

### species_distribution (分布记录表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| species_id | UUID | 外键 |
| location | GEOGRAPHY(POINT) | 地理坐标 |
| location_name | VARCHAR(200) | 位置名称 |
| depth_m | DECIMAL | 栖息深度 |
| is_verified | BOOLEAN | 是否验证 |
| source | VARCHAR(100) | 数据来源 |

### ocean_currents (洋流数据表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR(100) | 洋流名称 |
| type | VARCHAR(20) | 暖流/寒流 |
| geometry | GEOGRAPHY(LINESTRING) | 洋流路径 |
| season | VARCHAR(20) | 适用季节 |

### user_contributions (用户贡献表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| species_id | UUID | 物种ID |
| image_url | VARCHAR(500) | 图片URL |
| location | GEOGRAPHY(POINT) | 拍摄地点 |
| description | TEXT | 描述 |
| status | VARCHAR(20) | 待审核/通过/拒绝 |

## 6. API 设计

Base URL: `/api/v1`

### 物种
- `GET /species` - 获取物种列表（分页、筛选）
- `GET /species/{id}` - 获取物种详情
- `GET /species/{id}/distributions` - 获取分布点
- `GET /species/search?q=` - 搜索物种

### 地图
- `GET /map/distributions` - 获取地图分布数据（GeoJSON）
- `GET /map/ocean-currents` - 获取洋流数据
- `GET /map/bounds/{ocean}` - 获取指定大洋边界

### 洋流
- `GET /currents` - 获取洋流列表
- `GET /currents/{id}` - 获取洋流详情

### 用户
- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录
- `POST /contributions` - 提交贡献
- `GET /contributions/me` - 获取我的贡献

## 7. Phase 1 里程碑

- [ ] 项目初始化（仓库、CI/CD）
- [ ] 前端框架搭建（React + Vite + Tailwind + CesiumJS）
- [ ] 后端框架搭建（FastAPI + PostgreSQL + PostGIS）
- [ ] 数据库设计
- [ ] 物种数据导入
- [ ] 3D 地球基础
- [ ] 物种列表页
- [ ] 物种详情卡片
- [ ] 分布点可视化
- [ ] 基础筛选功能
- [ ] 搜索功能
