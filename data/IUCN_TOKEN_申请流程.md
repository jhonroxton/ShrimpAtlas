# IUCN Red List API Token 申请流程

## 为什么需要 IUCN Token？

IUCN Red List (https://www.iucnredlist.org) 是全球权威的濒危物种数据库。
ShrimpAtlas 需要通过 API 获取每种虾的濒危等级（CR/EN/VU/NT/LC/DD）和威胁因素。

---

## 申请步骤

### 1. 注册账号

1. 打开 https://www.iucnredlist.org
2. 点击右上角 **"Register"**（或登录）
3. 填写信息：
   - Email
   - Password
   - First Name / Last Name
   - Organization（可选）
4. 完成后登录账号

### 2. 申请 API Token

1. 登录后访问：https://apiv3.iucnredlist.org/api/v3/token
2. 或者在我的账户页面找 **"API Token"** 入口
3. 点击 **"Request a Token"**
4. 说明用途，例如：
   > "Building an open marine biodiversity education platform (ShrimpAtlas) to visualize global shrimp species distribution. Need to fetch IUCN conservation status for shrimp species."
5. 提交后，Token 会显示在页面上（格式：`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）

### 3. 将 Token 配置到项目

在 `data/.env` 文件中添加：

```
IUCN_API_TOKEN=你的token字符串
```

---

## IUCN API 基本信息

- **Base URL**: `https://apiv3.iucnredlist.org/api/v3/`
- **格式**: JSON
- **请求示例**:
  ```
  https://apiv3.iucnredlist.org/api/v3/species/id/19405?token=YOUR_TOKEN
  ```
- **主要端点**:
  - `/species/id/{id}` — 按 IUCN Species ID 查询
  - `/species/name/{name}` — 按名称搜索
  - `/species/search?q={query}` — 关键词搜索

---

## IUCN 濒危等级说明

| 等级 | 含义 |
|------|------|
| **CR** | Critically Endangered — 极危 |
| **EN** | Endangered — 濒危 |
| **VU** | Vulnerable — 易危 |
| **NT** | Near Threatened — 近危 |
| **LC** | Least Concern — 无危 |
| **DD** | Data Deficient — 数据缺乏 |

---

## ShrimpAtlas 中的应用

IUCN 数据将写入 `shrimp_species.iucn_status` 和 `shrimp_species.threats` 字段。
代码准备好，等 token 配置好即可运行抓取。
