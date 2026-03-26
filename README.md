# ShrimpAtlas 🦐

一个以 3D 地球为载体的海洋科普平台，通过可视化展示全球虾类分布，并结合洋流与气候系统，让用户以探索的方式理解海洋生态。

## 技术栈

### 前端
- **框架**: React 18 + TypeScript + Vite
- **样式**: Tailwind CSS (深海蓝主题)
- **3D 地球**: CesiumJS
- **地图可视化**: deck.gl
- **路由**: react-router-dom v6

### 后端
- **框架**: Python FastAPI (异步)
- **数据库**: PostgreSQL + PostGIS
- **ORM**: SQLAlchemy (async)
- **认证**: JWT

## 项目结构

```
ShrimpAtlas/
├── frontend/              # React 前端
│   ├── src/
│   │   ├── components/    # 可复用组件
│   │   ├── pages/         # 页面组件
│   │   ├── hooks/          # 自定义 Hooks
│   │   ├── types/          # TypeScript 类型
│   │   └── api/            # API 请求封装
│   └── package.json
├── backend/               # FastAPI 后端
│   ├── app/
│   │   ├── api/           # API 路由
│   │   ├── models/        # SQLAlchemy 模型
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── core/          # 核心配置
│   │   └── main.py
│   ├── requirements.txt
│   └── schema.sql         # 数据库 Schema
├── .github/workflows/     # CI/CD
└── SPEC.md                # 技术规格文档
```

## 快速开始

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 数据库

需要 PostgreSQL 15 + PostGIS 3.3

```bash
psql -U postgres -c "CREATE DATABASE shrimpatlas;"
psql -U postgres -d shrimpatlas -f backend/schema.sql
```

## 开发文档

https://my.feishu.cn/docx/UD4BdKtEiopCm6xaUv7cUfzFnHg

## 数据来源

- WoRMS (World Register of Marine Species)
- IUCN Red List
- NOAA Ocean Currents

## License

MIT
