# MUSE AI Lab 技术需求文档

> 对应 PRD: `docs/PRD/MUSE AI Lab 项目说明 + PRD (Demo v0.4).md`
>
> 本文档将 PRD 功能需求映射为可执行的技术方案，供 AI Coding 协作使用。
>
> **职责边界**: 本文档是数据模型、API 契约、状态流转和技术拆分的唯一事实来源。若 PRD 调整了功能范围，必须先同步本文档，再进行代码实现。

---

## 目录

- [1. 现状与差距分析](#1-现状与差距分析)
- [2. 数据模型设计](#2-数据模型设计)
- [3. 后端 API 设计](#3-后端-api-设计)
- [4. 后端 Service 设计](#4-后端-service-设计)
- [5. 前端页面与组件设计](#5-前端页面与组件设计)
- [6. 开发优先级与任务拆分](#6-开发优先级与任务拆分)
- [7. 技术风险与降级方案](#7-技术风险与降级方案)

---

## 1. 现状与差距分析

### 1.1 已完成

| 模块 | 状态 | 说明 |
|------|------|------|
| Provider 抽象层 | 已完成 | LLM/Image/Video 三类 Provider，含参数元数据系统 |
| 已接入厂商 | 已完成 | LLM: Gemini / Zhipu / 302.AI；Image: Gemini（Nano Banana 2 / Nano Banana Pro）；Video: 302.AI Kling |
| 基础画布 | 已完成 | Fabric.js 无限画布，深色主题，图文节点，底部生成面板 |
| OSS 上传 | 已完成 | 阿里云 OSS 图片上传，返回永久 URL |
| API 基础 | 已完成 | Provider 查询端点 + Spark/Land Demo 业务 API |

### 1.2 待开发（PRD v0.4 要求）

| PRD 功能 | 对应后端 | 对应前端 | 优先级 |
|----------|---------|---------|--------|
| Dashboard 工作台看板 | Project CRUD API | Dashboard 页面（卡片网格 + 互动数据概览） | P0 |
| 素材库 | Asset CRUD + 自动打标 API | 左侧素材面板（上传/分类/拖拽） | P0 |
| AI 搭配 | Outfit Service + LLM prompt | Look/Board 画布渲染 | P0 |
| 虚拟拍摄（快捷操作） | Shot 调度 + 生图调度 | 悬浮工具条 + 节点裂变 | P0 |
| 采纳 + 发布 | Shot/Content CRUD | 结果面板 + 发布弹窗 | P0 |
| Muse Land Feed | Content 查询 API | Feed 瀑布流页面 | P0 |
| 内容详情页 | Content 详情 API + 互动 API | 详情页组件（大图/单品明细/点赞/收藏/评论） | P0 |
| 图文 TryOn | TryOn 任务调度 | TryOn 上传/结果展示 | P0 |
| 带货链接 | 静态 mock | Promote 弹窗 | P0 |
| 图生视频 | Video 生成（已有） | 视频节点 | P1 |
| 互动偏好注入 | 偏好数据查询 | prompt 增强 | P1 |
| 节点手动创建 | 无新增 | 节点创建 UI | P1 |

### 1.3 不做（Demo 阶段）

- 电商交易链路
- 组织权限体系
- 高并发/全球化架构
- 视频 TryOn
- 复杂推荐算法

---

## 2. 数据模型设计

### 2.1 技术选型

Demo 阶段使用 **SQLite + SQLAlchemy ORM**：
- 零运维，单文件数据库，适合 Demo
- SQLAlchemy 抽象层，后续可平滑迁移到 PostgreSQL
- 数据库文件: `data/muse.db`

### 2.2 ER 模型

```
Project 1──N Asset
Project 1──N Look
Look    1──N LookItem (关联 Asset)
Look    1──N Shot (生成结果)
Shot    N──1 Content (通过 Shot.content_id FK 反向索引，发布聚合以 Content.shot_ids 为准)
Content 1──N Interaction (点赞/收藏/评论)
Content 1──N TryOnTask (试穿任务)
```

### 2.3 表结构定义

#### Project（设计方案）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| name | VARCHAR(200) | 方案名称 |
| cover_url | TEXT | 封面图 URL（取最新采纳图） |
| canvas_state | JSON | 画布草稿状态，保存本地图片节点/分组/隐藏状态/prompt 覆盖/位置覆盖 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 最后修改时间 |

#### Asset（素材）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| library_scope | VARCHAR(20) | 素材库归属: `public` / `user` |
| owner_user_id | VARCHAR(64, nullable) | 用户归属；Demo 阶段固定为 `demo_user_001`，公共素材为 `null` |
| source_type | VARCHAR(20) | 来源类型: `seed` / `upload` |
| storage_provider | VARCHAR(20) | 存储方式: `local` / `oss` |
| storage_key | TEXT (nullable) | 云端或本地存储 key |
| url | TEXT | 原图 URL |
| thumbnail_url | TEXT | 缩略图 URL |
| category | VARCHAR(20) | 分类: product/model/background/pose |
| tags | JSON | 自动打标结果: `{category, color, style, season, occasion}` |
| original_filename | VARCHAR(200) | 原始文件名 |
| status | VARCHAR(20) | `active` / `processing` / `failed` / `deleted` |
| created_at | DATETIME | 上传时间 |
| last_used_at | DATETIME (nullable) | 最近一次被项目引用或拖上画布的时间 |

#### ProjectAsset（项目素材引用）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| project_id | UUID (FK) | 所属方案 |
| asset_id | UUID (FK) | 关联素材 |
| created_at | DATETIME | 引用创建时间 |

#### Look（搭配方案）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| project_id | UUID (FK) | 所属方案 |
| name | VARCHAR(200) | Look 名称（AI 生成） |
| description | TEXT | 风格描述（AI 生成） |
| style_tags | JSON | 风格标签列表 |
| board_position | JSON | 画布上 Board 位置 `{x, y, width, height}` |
| created_at | DATETIME | 创建时间 |

#### LookItem（Look 包含的单品）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| look_id | UUID (FK) | 所属 Look |
| asset_id | UUID (FK, nullable) | 关联素材（有实物图时） |
| category | VARCHAR(20) | 品类: top/bottom/dress/shoes/bag/accessory |
| placeholder_desc | TEXT | 占位描述（无匹配素材时） |
| sort_order | INT | 排序序号 |

#### Shot（生成结果）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| look_id | UUID (FK) | 所属 Look |
| content_id | UUID (FK, nullable) | 所属 Content（发布后回写） |
| type | VARCHAR(10) | image / video |
| url | TEXT | 生成结果 URL |
| thumbnail_url | TEXT | 缩略图 URL |
| prompt | TEXT | 使用的 prompt |
| parameters | JSON | 使用的生成参数 |
| vendor | VARCHAR(50) | 使用的厂商 |
| status | VARCHAR(20) | queued/processing/completed/failed |
| adopted | BOOLEAN | 是否已采纳 |
| canvas_position | JSON | 画布上位置 `{x, y}` |
| created_at | DATETIME | 生成时间 |

#### Content（发布内容）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| look_id | UUID (FK) | 来源 Look |
| title | VARCHAR(200) | 标题 |
| description | TEXT | 描述文案 |
| tags | JSON | 标签列表 |
| cover_url | TEXT | 封面图 URL（默认取 `shot_ids[0]` 对应图片） |
| shot_ids | JSON | 已发布 Shot ID 列表（顺序即展示顺序） |
| like_count | INT | 点赞数 |
| favorite_count | INT | 收藏数 |
| comment_count | INT | 评论数 |
| published_at | DATETIME | 发布时间 |

#### Interaction（互动）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| content_id | UUID (FK) | 关联内容 |
| type | VARCHAR(20) | like/favorite/comment |
| user_identifier | VARCHAR(100) | 用户标识（Demo 用设备指纹） |
| comment_text | TEXT | 评论内容（type=comment 时） |
| created_at | DATETIME | 互动时间 |

#### TryOnTask（试穿任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| content_id | UUID (FK) | 关联内容 |
| user_photo_url | TEXT | 用户上传照片 URL |
| result_url | TEXT | 试穿结果 URL（Demo 阶段只保留单张最终结果） |
| status | VARCHAR(20) | queued/processing/completed/failed |
| created_at | DATETIME | 提交时间 |
| completed_at | DATETIME | 完成时间 |

### 2.4 核心状态约定

- `Shot` 同时表示一次生成任务和其最终产物。Demo 阶段不单独创建 `GenerationTask` 表。
- `Shot.status`: `queued -> processing -> completed | failed`
- `Content` 表示一次发布聚合，`Content.shot_ids` 是多图内容的主事实来源，`Shot.content_id` 用于反向索引。
- `TryOnTask` 表示 Land 端异步试穿任务。Demo 阶段只返回单张最终结果，不做预览图/高清图双阶段产物。

---

## 3. 后端 API 设计

### 3.1 API 路由规划

在现有 `/api/v1/` 前缀下扩展，按业务域分组：

```
src/backend/api/
├── router.py              # 根路由，聚合 providers + demo
├── providers.py           # Provider 能力路由
├── demo.py                # 当前 Spark/Land Demo 业务路由
└── __init__.py            # 统一注册所有 router
```

### 3.2 端点清单

#### Project（设计方案）

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/projects` | 新建方案 |
| GET | `/api/v1/projects` | 方案列表 |
| GET | `/api/v1/projects/{id}` | 方案详情 |
| PATCH | `/api/v1/projects/{id}` | 更新方案（重命名等） |
| GET | `/api/v1/projects/{id}/canvas-state` | 获取画布草稿状态（本地节点/隐藏状态/覆盖信息） |
| PATCH | `/api/v1/projects/{id}/canvas-state` | 更新画布草稿状态 |
| DELETE | `/api/v1/projects/{id}` | 删除方案 |

#### Asset（素材）

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/assets/library` | 素材库列表，支持 `?scope=public|user|all&category=product&owner_user_id=demo_user_001` |
| POST | `/api/v1/assets/library/upload` | 上传到“我的素材库”，自动打标；优先上传 OSS，未配置时回退本地 `/media` |
| GET | `/api/v1/projects/{id}/assets` | 当前项目已引用的素材列表，支持 `?category=product` 筛选 |
| POST | `/api/v1/projects/{id}/assets/link` | 把素材库中的现有素材关联到当前项目 |
| PATCH | `/api/v1/assets/{id}` | 更新素材标签（人工修正） |
| DELETE | `/api/v1/projects/{id}/assets/{asset_id}` | 从当前项目取消素材引用 |
| DELETE | `/api/v1/assets/{id}` | 删除“我的素材”主记录及存储文件；公共素材禁止删除 |

#### Look（AI 搭配）

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/projects/{id}/looks/generate` | AI 搭配生成（输入选中素材 ID 列表） |
| GET | `/api/v1/projects/{id}/looks` | Look 列表 |
| PATCH | `/api/v1/looks/{id}` | 更新 Look（替换单品、调整位置） |
| DELETE | `/api/v1/looks/{id}` | 删除 Look |

**AI 搭配生成请求体**:
```json
{
  "asset_ids": ["uuid1", "uuid2"],
  "mode": "auto",         // auto(系统判断) / complete(补全) / group(分组)
  "count": 3              // 期望生成 Look 数量
}
```

**AI 搭配生成响应体**:
```json
{
  "looks": [
    {
      "id": "uuid",
      "name": "都市休闲风",
      "description": "以黑色皮衣为核心...",
      "style_tags": ["urban", "casual"],
      "items": [
        {"category": "top", "asset_id": "uuid", "match_reason": "..."},
        {"category": "shoes", "asset_id": null, "placeholder_desc": "建议补充：黑色切尔西靴"}
      ]
    }
  ]
}
```

#### Generation（虚拟拍摄/生成任务）

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/{id}/shots` | 查询方案下全部 Shot（用于 Canvas 初始化恢复） |
| POST | `/api/v1/looks/{id}/generate` | 提交拍摄/生成任务 |
| GET | `/api/v1/shots/{id}` | 查询生成结果状态 |
| PATCH | `/api/v1/shots/{id}` | 更新生成结果元数据（当前用于保存 `canvas_position`） |
| PATCH | `/api/v1/shots/{id}/adopt` | 采纳/取消采纳 |

**生成任务请求体**:
```json
{
  "type": "image",                // image / video
  "action": "change_model",       // change_model / change_background / tryon / custom
  "vendor": "gemini",
  "preset_id": "model_01",        // 预设模特/场景 ID（可选）
  "custom_prompt": "...",         // 自定义指令（可选）
  "reference_image_url": "...",   // TryOn 参考照片 URL（action=tryon 时必填）
  "parameters": {
    "model_name": "gemini-3.1-flash-image-preview",
    "resolution": "2k",
    "aspect_ratio": "3:4"
  }                               // 厂商参数
}
```

#### Content（内容发布）

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/contents` | 发布内容到 Muse Land |
| GET | `/api/v1/contents/{id}` | 内容详情 |

**发布请求体**:
```json
{
  "look_id": "uuid",
  "shot_ids": ["uuid1", "uuid2"],   // 发布聚合以此顺序为准，同时回写这些 Shot 的 content_id
  "title": "...",
  "description": "...",
  "tags": ["urban", "casual"]
}
```

#### Land（Muse Land 消费端）

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/land/feed` | Feed 流（支持 `?tag=xxx&page=1&limit=20`） |
| GET | `/api/v1/land/contents/{id}` | 内容详情（含搭配单品） |
| POST | `/api/v1/land/contents/{id}/like` | 点赞 |
| POST | `/api/v1/land/contents/{id}/favorite` | 收藏 |
| POST | `/api/v1/land/contents/{id}/comment` | 评论 |
| POST | `/api/v1/land/contents/{id}/tryon` | 发起 TryOn |
| GET | `/api/v1/land/tryon/{id}` | 查询 TryOn 结果 |
| GET | `/api/v1/land/contents/{id}/promote` | 获取带货链接（mock） |

---

## 4. 后端 Service 设计

### 4.1 Service 层规划

```
src/backend/services/
├── provider_service.py      # 现有：Provider 注册/调用
├── canvas_service.py        # 当前 demo 中的 Project / Asset 相关逻辑
├── outfit_service.py        # AI 搭配核心逻辑
├── generation_service.py    # 生成、发布、Land 互动相关逻辑
└── prompt_templates.py      # LLM prompt 模板集中管理
```

### 4.2 核心 Service 说明

#### AssetService（素材管理）

```
上传流程:
1. 接收图片文件 → 落本地临时文件
2. 若 OSS 配置有效，则上传 OSS 并记录永久 URL；若未配置或上传失败，则回退本地 `/media`
3. 调用 LLM (multimodal) 分析图片 → 返回标签 JSON
4. 写入 Asset 表，并为当前 Project 建立 `ProjectAsset` 引用

约定:
- Demo 阶段默认用户固定为 `demo_user_001`
- `storage_provider=oss` 时，`url/thumbnail_url` 返回云端 URL，`storage_key` 为 OSS 对象 key
- `storage_provider=local` 时，`url/thumbnail_url` 返回 `/media/...`，`storage_key` 为相对 `MEDIA_ROOT` 的路径
```

**自动打标 prompt 要点**:
- 输入: 素材图片
- 输出结构: `{category, subcategory, color, style, season, occasion}`
- category 枚举: product / model / background / pose
- 对于 product 类别，进一步识别 subcategory: top / bottom / dress / shoes / bag / accessory

#### OutfitService（AI 搭配）

```
搭配流程:
1. 接收选中素材 ID 列表 → 查询素材标签 + 素材图片 URL
2. 根据素材数量和品类自动判断 mode（补全/分组）
3. 构建多模态搭配 prompt（文本标签 + 商品图片）→ 调用 LLM（multimodal）
4. 解析 LLM 结构化输出 → 在素材库中标签匹配
5. 生成 Look + LookItem 记录
6. 返回 Look 数据（含匹配素材/占位提示）
```

**搭配 prompt 要点**:
- **多模态输入**: 将选中单品的图片作为 image part 传入 LLM，使 AI 能直观理解商品的款式、材质、细节，而非仅依赖文本标签
- 品类关系规则（上下装搭配、鞋包配饰协调）
- 风格一致性约束
- 季节和场合适配
- 输出 JSON 格式: 每个推荐项含 `{category, color, style, match_reason}`

#### GenerationService（生成任务调度）

```
生成流程:
1. 接收生成请求 → 创建 Shot 记录（status=queued）
2. 根据 action 类型构建 prompt:
   - change_model: Look 单品图 + 预设模特描述 → 合成 prompt
   - change_background: Look 单品图 + 预设场景描述 → 合成 prompt
   - tryon: Look 单品图 + 用户上传的参考照片(reference_image_url) → TryOn prompt
     （Spark 端: 创作者在画布上快捷预览试穿效果，参考照片来自素材库或本地上传）
   - custom: 用户自定义 prompt
3. 调用对应 Provider（多模态图像生成）→ 上传 OSS
4. 更新 Shot 记录（status=completed, url=...)

异步方案: Demo 阶段使用 FastAPI `BackgroundTasks`，API 立即返回 Shot ID，
前端轮询 `GET /api/v1/shots/{id}` 获取状态。

`Shot` 是本项目 Demo 阶段唯一的生成任务实体，不再额外创建 `GenerationTask` 表。

为支持 Spark 画布刷新后恢复历史结果，补充只读查询接口 `GET /api/v1/projects/{id}/shots`。
返回值沿用 `ShotResponse`，额外包含 `content_id` 用于前端识别哪些 Shot 已被发布聚合引用。

为支持 Spark 画布自动保存结果节点位置，补充更新接口 `PATCH /api/v1/shots/{id}`。
当前仅更新 `canvas_position`，前端在拖拽结束后立即调用，刷新工作台后按该位置恢复。

为支持设计工具式自动保存，项目级新增 `canvas_state`：
- 保存 `localNodes`，确保用户拖入/生成的本地图片与视频节点数量、位置、prompt、输入参数可恢复
- 保存 `localBoards`，确保自定义分组恢复
- 保存 `hiddenLookIds / hiddenLookItemIds / hiddenShotIds`
- 保存 `lookPromptOverrides / lookFrameOverrides / shotPositionOverrides`

前端策略：
- 本地状态先立即更新
- 使用 debounce 自动保存到后端
- 同时写入浏览器本地 pending 草稿，刷新或短暂离线后仍可恢复并重试同步

**TryOn 双入口说明**:
- **Spark 端** (`action=tryon`): 创作者在画布中对 Look 点击「TryOn」快捷操作，参考照片来自素材库或本地上传，生成结果为 Shot 节点展示在画布中
- **Land 端** (`POST /api/v1/land/contents/{id}/tryon`): 达人在内容详情页上传个人照片，生成 TryOnTask 记录，结果异步展示

两者底层均调用图像 Provider，但入口 API 和数据存储不同。若试穿效果不稳定，可按 PRD 降级为“达人照片 + 搭配描述”的 AI 创意图。
```

**快捷操作预设数据**:
```python
MODEL_PRESETS = [
    {"id": "model_01", "name": "Asian Female A", "desc": "亚洲女性，身高168cm，短发..."},
    {"id": "model_02", "name": "European Male A", "desc": "欧洲男性，身高185cm..."},
    # ... 4~6 个预设
]

SCENE_PRESETS = [
    {"id": "scene_01", "name": "街拍-行走", "desc": "城市街道，自然光，行走姿态..."},
    {"id": "scene_02", "name": "棚拍-站姿", "desc": "白色摄影棚，柔光，正面站姿..."},
    # ... 4~6 个预设
]
```

#### LandService（Muse Land）

```
Feed 查询: 按发布时间倒序 + 可选标签筛选，分页返回
互动: 点赞/收藏为幂等 toggle，评论为追加
TryOn: 创建异步任务 → 调用 TryOn 模型 → 更新结果
```

### 4.3 Prompt 模板管理

集中管理所有 LLM prompt，便于迭代调优：

```python
# prompt_templates.py

ASSET_TAGGING_PROMPT = """..."""      # 素材自动打标
OUTFIT_COMPLETE_PROMPT = """..."""     # 搭配补全
OUTFIT_GROUP_PROMPT = """..."""        # 搭配分组
SHOOTING_PROMPT = """..."""            # 虚拟拍摄合成
CONTENT_TITLE_PROMPT = """..."""       # 内容标题生成
CONTENT_DESC_PROMPT = """..."""        # 内容描述生成
```

---

## 5. 前端页面与组件设计

### 5.1 路由规划

```
/                          → Dashboard（方案列表）
/canvas/:projectId         → Spark 画布工作台        [扩展现有 Canvas]
/land                      → Muse Land Feed 流      [新增]
/land/:contentId           → 内容详情页              [新增]
```

### 5.2 页面与组件树

```
App.tsx (Router)
├── Dashboard (/)
│   ├── StatsOverview        # 互动数据概览（可先基于已发布内容聚合或前端 mock）
│   ├── ProjectCard          # 方案卡片（封面+名称+时间）
│   └── NewProjectButton     # 新建方案按钮
│
├── Canvas (/canvas/:projectId)
│   ├── AssetPanel (左侧)
│   │   ├── UploadZone       # 拖拽/点击上传区
│   │   ├── CategoryTabs     # [全部][商品][模特][背景][姿势]
│   │   └── AssetGrid        # 双列缩略图网格
│   │
│   ├── InfiniteCanvas (中部)  [扩展现有]
│   │   ├── ImageNode        # 图片节点（现有）
│   │   ├── TextNode         # 文本节点（现有）
│   │   ├── LookBoard        # Look 看板节点（新增）
│   │   ├── ShotNode         # 生成结果节点（新增）
│   │   └── VideoNode        # 视频节点（新增）
│   │
│   ├── FloatingToolbar      # 选中对象后的悬浮工具条（新增）
│   │   ├── AIOutfitButton   # AI 搭配按钮
│   │   ├── ShootButton      # 拍摄按钮
│   │   ├── GroupButton      # 组合按钮
│   │   └── QuickActions     # 换模特/换背景/TryOn(上传参考照片+Look单品→生成试穿效果)/自定义
│   │
│   ├── ResultPanel (右侧)   # 采纳结果面板（新增）
│   │   ├── LookGroup        # 按 Look 分组
│   │   ├── ShotThumbnail    # Shot 缩略图
│   │   └── PublishButton    # 发布按钮
│   │
│   ├── PublishDialog        # 发布编辑弹窗（新增）
│   └── BottomPromptBar      # 底部生成面板（保留，作为备用入口）
│
├── Land (/land)
│   ├── FeedHeader           # 标签栏 [FOR YOU][BY COLLECTION]
│   └── ContentCard          # 内容卡片（瀑布流）
│
└── LandDetail (/land/:contentId)
    ├── ImageGallery         # 大图浏览（左右翻页）
    ├── OutfitDetail         # 搭配单品明细
    ├── InteractionBar       # 点赞/收藏/评论
    ├── TryOnButton          # TryOn 入口
    ├── TryOnDialog          # 上传照片弹窗
    ├── PromoteButton        # 带货链接按钮
    └── PromoteDialog        # 带货链接弹窗
```

### 5.3 状态管理扩展

扩展 Zustand store，按业务域拆分 slice：

```typescript
// store.ts 扩展（或拆分为多个 store 文件）

// 画布 store（现有，扩展）
interface CanvasStore {
  // ...现有字段
  projectId: string | null
  looks: Look[]
  shots: Shot[]
  projectCanvasState: CanvasDraftState | null
  // ...新增操作
  addLookBoard(look: Look): void
  addShotNode(shot: Shot): void
  adoptShot(shotId: string): void
  saveProjectCanvasState(projectId: string, canvasState: CanvasDraftState): Promise<void>
}

// 素材 store（新增）
interface AssetStore {
  assets: Asset[]
  activeCategory: string
  loadAssets(projectId: string): void
  uploadAsset(file: File): void
}

// Land store（新增）
interface LandStore {
  feed: Content[]
  loadFeed(params: FeedParams): void
  toggleLike(contentId: string): void
  toggleFavorite(contentId: string): void
}
```

### 5.4 LookBoard 画布渲染方案

LookBoard 在 Fabric.js 画布上作为 **Group 对象** 渲染：

```
LookBoard 视觉结构:
┌─────────────────────────────────┐  ← 圆角矩形，浅色底色
│  Look Name          style tags  │
│ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │ 上装 │ │ 下装 │ │ 鞋子 │       │
│ └─────┘ └─────┘ └─────┘       │
│  风格描述文本...                  │
└─────────────────────────────────┘
```

实现方式：
- 使用 Fabric.js `fabric.Group` 组合矩形背景 + 图片 + 文本
- 自定义属性存储 `lookId`，用于关联数据
- 支持整体拖拽移动
- Board 内单品图支持拖拽替换（检测 drop 目标）

### 5.5 节点裂变交互

快捷操作（换模特/换背景）触发的节点裂变：

```
触发前:                    触发后:
                          ┌──────────┐
┌──────────┐              │ 背景图   │──┐
│ LookBoard│     →        └──────────┘  │  ┌──────────┐
└──────────┘              ┌──────────┐  ├─→│ 生成结果  │
                          │ LookBoard│──┘  └──────────┘
                          └──────────┘
```

实现方式：
- 新节点以 LookBoard 中心为锚点，向右偏移布局
- 节点间用 Fabric.js `fabric.Line` 绘制连线
- 连线数据存储在 store 中，画布渲染时同步绘制

---

## 6. 开发优先级与任务拆分

### Phase 1: 数据基础（预计 0.5 天）

| # | 任务 | 涉及文件 |
|---|------|---------|
| 1.1 | 初始化 SQLite + SQLAlchemy | `database.py`, `models.py` |
| 1.2 | 定义全部数据模型 | `models.py` |
| 1.3 | 定义 Pydantic schemas | `schemas.py` |
| 1.4 | 数据库迁移脚本 | `scripts/init_db.py` |

### Phase 2: Spark 核心链路（预计 2 天）

| # | 任务 | 涉及文件 |
|---|------|---------|
| 2.1 | Dashboard 页面 + Project CRUD | Dashboard 组件, Project CRUD API |
| 2.2 | 素材上传 + 自动打标 | `canvas_service.py`, AssetPanel 组件 |
| 2.3 | AI 搭配（补全/分组） | `outfit_service.py`, `prompt_templates.py` |
| 2.4 | LookBoard 画布渲染 | LookBoard 组件, store 扩展 |
| 2.5 | 悬浮工具条 + 快捷拍摄 | FloatingToolbar, `generation_service.py` |
| 2.6 | 采纳 + 结果面板 | ResultPanel 组件, Shot adopt API |

### Phase 3: 发布与 Land（预计 1.5 天）

| # | 任务 | 涉及文件 |
|---|------|---------|
| 3.1 | 发布弹窗 + Content API | `generation_service.py`, PublishDialog |
| 3.2 | Muse Land Feed 页面 | Land 页面组件, Content 查询 API |
| 3.3 | Land 内容详情页 + 互动功能 | 详情 API, InteractionBar 组件 |
| 3.4 | 图文 TryOn | TryOn API, TryOnDialog 组件 |
| 3.5 | 带货链接（mock） | PromoteDialog 组件 |

### Phase 4: P1 功能（时间允许）

| # | 任务 | 涉及文件 |
|---|------|---------|
| 4.1 | 图生视频节点 | VideoNode 组件, 视频生成集成 |
| 4.2 | 互动偏好注入搭配 prompt | `outfit_service.py` 增强 |

---

## 7. 技术风险与降级方案

### 7.1 AI 搭配质量

| 风险 | 概率 | 降级方案 |
|------|------|---------|
| LLM 搭配推荐不准 | 中 | 多轮 prompt 迭代；用户可手动拖拽替换 |
| 素材库匹配不到对应单品 | 高 | 显示占位卡片 + 补充建议文案 |
| LLM 输出格式不稳定 | 中 | 严格 JSON schema prompt + 输出校验 + 重试 |

### 7.2 生图质量

| 风险 | 概率 | 降级方案 |
|------|------|---------|
| 换模特/换背景效果差 | 中 | 多厂商切换尝试；提供自定义 prompt 兜底 |
| 生成耗时长 | 低 | 异步任务 + 进度轮询；画布显示 loading 状态 |

### 7.3 TryOn 质量

| 风险 | 概率 | 降级方案 |
|------|------|---------|
| 试穿融合效果差 | 高 | 退化为"AI 创意图"（达人照片 + 搭配描述生成风格图） |
| TryOn API 不稳定 | 中 | 设置超时 + 友好错误提示 + 重试 |

### 7.4 性能

| 风险 | 概率 | 降级方案 |
|------|------|---------|
| Fabric.js 大量节点卡顿 | 低 | Demo 阶段画布元素有限；必要时做视口裁剪 |
| SQLite 并发写锁 | 低 | Demo 单用户场景；WAL 模式启用 |

---

## 附录 A: 文件变更清单

### 新增文件

```
# 后端
src/backend/database.py              # 重写：SQLAlchemy 引擎/会话
src/backend/models.py                # 重写：ORM 模型定义
src/backend/schemas.py               # 重写：Pydantic schemas
src/backend/api/providers.py         # 现有
src/backend/api/demo.py              # 现有 Spark/Land Demo 业务路由
src/backend/services/canvas_service.py     # 现有 Project / Asset 相关 demo 服务
src/backend/services/outfit_service.py     # 重写
src/backend/services/generation_service.py # 重写
src/backend/services/prompt_templates.py   # 新增
scripts/init_db.py                         # 新增

# 前端
src/frontend/src/pages/Dashboard.tsx       # 新增
src/frontend/src/pages/Land.tsx            # 新增
src/frontend/src/pages/LandDetail.tsx      # 新增
src/frontend/src/components/canvas/AssetPanel.tsx       # 新增
src/frontend/src/components/canvas/AssetPanel.css       # 新增
src/frontend/src/components/canvas/LookBoard.tsx        # 新增
src/frontend/src/components/canvas/ShotNode.tsx         # 新增
src/frontend/src/components/canvas/FloatingToolbar.tsx  # 新增
src/frontend/src/components/canvas/ResultPanel.tsx      # 新增
src/frontend/src/components/canvas/PublishDialog.tsx    # 新增
src/frontend/src/components/land/ContentCard.tsx        # 新增
src/frontend/src/components/land/TryOnDialog.tsx        # 新增
src/frontend/src/components/land/PromoteDialog.tsx      # 新增
```

### 修改文件

```
src/backend/main.py          # 注册新路由，初始化数据库
src/backend/api/__init__.py  # 导出新路由
src/frontend/src/App.tsx     # 新增路由
src/frontend/src/types.ts    # 新增类型定义
src/frontend/src/store.ts    # 扩展/拆分 store
package.json                 # 可能新增前端依赖
requirements.txt             # 维护后端依赖
```

### 新增依赖

```
# requirements.txt
sqlalchemy>=2.0

# package.json (如需)
# 暂无新增，现有依赖足够
```
