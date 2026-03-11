# 多 Agent 并行开发调度方案

> 本文档定义多个 AI Agent 并行开发 MUSE AI Lab 的分组、文件归属、接口契约和协作协议。
>
> **阅读前置**：每个 Agent 在开始前必须先阅读以下文档：
> - `docs/PRD/MUSE AI Lab 项目说明 + PRD （Demo v0.4）.md` — 项目需求文档（产品定义、功能优先级、验收标准）
> - `AGENTS.md` — 项目规范与核心命令
> - `docs/AI_Artifacts/architecture.md` — 系统架构
> - `docs/AI_Artifacts/tech_requirement.md` — API 设计 + 数据模型
> - `docs/AI_Artifacts/provider_sop.md` — Provider 调用规范（Agent A 必读）

---

## 1. 分组总览

```
Phase 0 (串行)            Phase 1 (并行)                    Phase 2
                    ┌── Agent A: 全部后端 (API+Service) ──┐
Agent 0: 数据基础 ─►├── Agent B: Spark 前端 (画布+组件) ──┼──► 联调 + E2E
  (DB + Models +    └── Agent C: Land 前端 (Feed+TryOn) ──┘
   Schemas +
   types.ts/store.ts 骨架)
```

| Agent | 职责 | 关键产出 |
|-------|------|---------|
| **Agent 0** | 数据模型 + 前端类型骨架 | `models.py`, `schemas.py`, `types.ts`, `store.ts` 骨架 |
| **Agent A** | 全部后端 API + Service + Prompt | 所有 `/api/v1/` 端点可用 |
| **Agent B** | Spark 端前端（Dashboard + 画布 + 组件） | Dashboard 页面、画布节点、悬浮工具条、结果面板 |
| **Agent C** | Land 端前端（Feed + TryOn + Promote） | Feed 瀑布流、内容详情、TryOn 弹窗 |

> **核心原则**：每个文件只有一个 Agent 负责。文件归属无歧义 = 零合并冲突。

---

## 2. Agent 0 — Data Foundation

### 职责

创建所有组的公共数据契约。Agent A/B/C **必须等 Agent 0 完成后才能启动**。

### 文件清单

| 文件 | 操作 |
|------|------|
| `src/backend/database.py` | 重写：SQLAlchemy 引擎 + 会话管理 |
| `src/backend/models.py` | 重写：定义 8 张表的 ORM 模型 |
| `src/backend/schemas.py` | 重写：全部 Pydantic 请求/响应 Schema |
| `scripts/init_db.py` | 新增：数据库建表脚本 |
| `requirements.txt` | 修改：新增 `sqlalchemy>=2.0` |
| `src/frontend/src/types.ts` | 修改：新增全部 TypeScript 类型定义 |
| `src/frontend/src/store.ts` | 修改：创建分区骨架（见下方协议） |

### 数据模型清单

必须定义以下 8 张表（详见 `tech_requirement.md` 第 2 节）：

```
Project, Asset, Look, LookItem, Shot, Content, Interaction, TryOnTask
```

ER 关系：
```
Project 1──N Asset
Project 1──N Look 1──N LookItem (关联 Asset)
Look    1──N Shot
Shot    N──1 Content (通过 Shot.content_id FK 回写，发布时关联)
Content 1──N Interaction
Content 1──N TryOnTask
```

### store.ts 分区协议

Agent 0 必须在 `store.ts` 中用注释分隔出三个区域：

```typescript
// ============================================================
// CANVAS STORE — 现有画布状态（保留原有代码）
// ============================================================
// ... 现有 store 代码 ...

// ============================================================
// SPARK STORE — Agent B 负责实现
// 包含：ProjectStore, AssetStore, LookStore, GenerationStore
// ============================================================
// TODO: Agent B 在此区域实现 Spark 相关状态管理

// ============================================================
// LAND STORE — Agent C 负责实现
// 包含：FeedStore, InteractionStore, TryOnStore
// ============================================================
// TODO: Agent C 在此区域实现 Land 相关状态管理
```

### types.ts 类型定义要求

Agent 0 必须定义以下 TypeScript 类型（与后端 `schemas.py` 一一对应）：

```typescript
// 核心实体类型
interface Project { id: string; name: string; cover_url: string | null; created_at: string; updated_at: string; }
interface Asset { id: string; project_id: string; url: string; thumbnail_url: string; category: string; tags: AssetTags; ... }
interface AssetTags { category: string; subcategory?: string; color: string; style: string; season: string; occasion: string; }
interface Look { id: string; project_id: string; name: string; description: string; style_tags: string[]; items: LookItem[]; ... }
interface LookItem { id: string; look_id: string; asset_id: string | null; category: string; placeholder_desc: string | null; ... }
interface Shot { id: string; look_id: string; type: 'image' | 'video'; url: string; status: string; adopted: boolean; ... }
interface Content { id: string; look_id: string; title: string; description: string; tags: string[]; cover_url: string; ... }
interface Interaction { id: string; content_id: string; type: 'like' | 'favorite' | 'comment'; ... }
interface TryOnTask { id: string; content_id: string; user_photo_url: string; result_url: string | null; status: string; ... }
```

### 完成标志

- [ ] `python scripts/init_db.py` 成功建表
- [ ] `models.py` 包含 8 个完整 ORM 模型
- [ ] `schemas.py` 包含所有 API 请求/响应 Schema
- [ ] `types.ts` 包含所有前端类型定义
- [ ] `store.ts` 包含三个分区注释块
- [ ] 运行 `./scripts/test.sh` 无报错

---

## 3. Agent A — 全部后端

### 职责

实现所有后端 API 端点和 Service 业务逻辑。是前端 Agent 的"API 供应商"。

### 文件清单

| 文件 | 操作 |
|------|------|
| `src/backend/api/project_router.py` | 新增 |
| `src/backend/api/asset_router.py` | 新增 |
| `src/backend/api/look_router.py` | 新增 |
| `src/backend/api/generation_router.py` | 新增 |
| `src/backend/api/content_router.py` | 新增 |
| `src/backend/api/land_router.py` | 新增 |
| `src/backend/services/project_service.py` | 新增 |
| `src/backend/services/asset_service.py` | 新增 |
| `src/backend/services/outfit_service.py` | 重写 |
| `src/backend/services/generation_service.py` | 重写 |
| `src/backend/services/content_service.py` | 新增 |
| `src/backend/services/land_service.py` | 新增 |
| `src/backend/services/prompt_templates.py` | 新增 |
| `src/backend/api/__init__.py` | 修改：注册全部 router |
| `src/backend/main.py` | 修改：初始化数据库、注册路由前缀 |

### API 端点契约

Agent A 必须严格实现 `tech_requirement.md` 第 3 节定义的全部端点。以下为摘要：

#### Project

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/projects` | 新建方案 |
| GET | `/api/v1/projects` | 方案列表 |
| GET | `/api/v1/projects/{id}` | 方案详情 |
| PATCH | `/api/v1/projects/{id}` | 更新方案 |
| DELETE | `/api/v1/projects/{id}` | 删除方案 |

#### Asset

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/projects/{id}/assets` | 上传素材（批量），自动触发打标 |
| GET | `/api/v1/projects/{id}/assets` | 素材列表，支持 `?category=` 筛选 |
| PATCH | `/api/v1/assets/{id}` | 更新标签 |
| DELETE | `/api/v1/assets/{id}` | 删除素材 |

#### Look

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/projects/{id}/looks/generate` | AI 搭配生成 |
| GET | `/api/v1/projects/{id}/looks` | Look 列表 |
| PATCH | `/api/v1/looks/{id}` | 更新 Look |
| DELETE | `/api/v1/looks/{id}` | 删除 Look |

#### Generation + Shot

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/looks/{id}/generate` | 提交生成任务 |
| GET | `/api/v1/shots/{id}` | 查询生成状态 |
| PATCH | `/api/v1/shots/{id}/adopt` | 采纳/取消采纳 |

#### Content

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/contents` | 发布内容 |
| GET | `/api/v1/contents/{id}` | 内容详情 |

#### Land

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/land/feed` | Feed 流（`?tag=&page=&limit=`） |
| GET | `/api/v1/land/contents/{id}` | 内容详情（含搭配单品） |
| POST | `/api/v1/land/contents/{id}/like` | 点赞（幂等 toggle） |
| POST | `/api/v1/land/contents/{id}/favorite` | 收藏（幂等 toggle） |
| POST | `/api/v1/land/contents/{id}/comment` | 评论 |
| POST | `/api/v1/land/contents/{id}/tryon` | 发起 TryOn |
| GET | `/api/v1/land/tryon/{id}` | 查询 TryOn 结果 |
| GET | `/api/v1/land/contents/{id}/promote` | 获取带货链接（mock） |

### 推荐实现顺序

1. Project CRUD + Asset API（解锁 Agent B Dashboard + 素材面板联调）
2. Look + Generation API（解锁 Agent B 画布核心联调）
3. Content + Land API（解锁 Agent C 联调）
4. Prompt 模板调优 + 全链路验证

### 测试要求

每个新增的 router 和 service 必须有对应测试文件：
```
tests/api/test_project_router.py
tests/api/test_asset_router.py
tests/services/test_project_service.py
tests/services/test_asset_service.py
...
```

完成后运行 `./scripts/test.sh` 确保全部通过，并通过 `./scripts/restart.sh` 验证服务可启动。

---

## 4. Agent B — Spark 前端

### 职责

实现 Spark 端所有前端页面和画布组件。

### 文件清单

| 文件 | 操作 |
|------|------|
| `src/frontend/src/pages/Dashboard.tsx` | 新增（替换 Home.tsx） |
| `src/frontend/src/pages/Canvas.tsx` | 修改：扩展画布功能 |
| `src/frontend/src/components/canvas/AssetPanel.tsx` | 新增 |
| `src/frontend/src/components/canvas/LookBoard.tsx` | 新增 |
| `src/frontend/src/components/canvas/ShotNode.tsx` | 新增 |
| `src/frontend/src/components/canvas/FloatingToolbar.tsx` | 新增 |
| `src/frontend/src/components/canvas/ResultPanel.tsx` | 新增 |
| `src/frontend/src/components/canvas/PublishDialog.tsx` | 新增 |
| `src/frontend/src/components/canvas/ImageActionPanel.tsx` | 修改 |
| `src/frontend/src/hooks/useFabricCanvas.ts` | 修改 |
| `src/frontend/src/App.tsx` | 修改：新增全部路由（含 Land 路由） |
| `src/frontend/src/store.ts` | 修改：填充 `SPARK STORE` 分区 |

### 路由注册

Agent B 负责 `App.tsx` 中的全部路由注册，包括 Land 的路由：

```tsx
// App.tsx 路由配置
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/canvas/:projectId" element={<Canvas />} />
  <Route path="/land" element={<Land />} />
  <Route path="/land/:contentId" element={<LandDetail />} />
</Routes>
```

Agent C 的 Land 页面组件（`Land.tsx`, `LandDetail.tsx`）完成后，Agent B 在 `App.tsx` 中 import 并注册。合并阶段处理。

### Mock 数据协议

Agent B 在后端 API 未就绪时使用 mock 数据开发。协议如下：

```typescript
// 环境变量控制 mock 开关
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// API 调用封装模式
async function fetchProjects(): Promise<Project[]> {
  if (USE_MOCK) return MOCK_PROJECTS
  const res = await fetch('/api/v1/projects')
  return res.json()
}
```

- 启动时设置 `VITE_USE_MOCK=true` 即可脱离后端独立开发
- Agent A 每完成一批 API，Agent B 将对应调用从 mock 切换为真实请求

### Store 填充规则

仅在 Agent 0 预留的 `// === SPARK STORE (Agent B) ===` 区域内编写代码。不修改其他区域。

### 核心交互参考

- **LookBoard 渲染**：使用 Fabric.js `fabric.Group` 组合圆角矩形 + 图片 + 文本
- **节点裂变**：快捷操作触发后，以 LookBoard 为锚点向右自动布局生成结果节点 + 连线
- **拖拽上屏**：素材从 DOM 面板拖入 Fabric.js 画布，跨容器拖拽事件处理

详见 `tech_requirement.md` 第 5 节。

### Dashboard 互动数据概览

Dashboard 的 `StatsOverview` 组件使用**前端 mock 数据**，无需后端 API。直接在组件中硬编码示例数据即可。

---

## 5. Agent C — Land 前端

### 职责

实现 Muse Land 端所有前端页面和组件。**不写后端代码。**

### 文件清单

| 文件 | 操作 |
|------|------|
| `src/frontend/src/pages/Land.tsx` | 新增 |
| `src/frontend/src/pages/LandDetail.tsx` | 新增 |
| `src/frontend/src/components/land/ContentCard.tsx` | 新增 |
| `src/frontend/src/components/land/TryOnDialog.tsx` | 新增 |
| `src/frontend/src/components/land/PromoteDialog.tsx` | 新增 |
| `src/frontend/src/store.ts` | 修改：填充 `LAND STORE` 分区 |

### 禁止修改的文件

- **`App.tsx`** — 由 Agent B 独占修改。Agent C 只需导出页面组件，合并阶段由 Agent B 注册路由。
- **`types.ts`** — 由 Agent 0 一次性定义完毕。如需新类型，在自己的组件文件内定义局部类型。

### Store 填充规则

仅在 Agent 0 预留的 `// === LAND STORE (Agent C) ===` 区域内编写代码。不修改其他区域。

### API 依赖

Agent C 依赖 Agent A 提供的 Land API 端点。在 API 未就绪时使用 mock 数据（同 Agent B 协议）。

Agent C 需要调用的端点：
```
GET  /api/v1/land/feed                      → Feed 列表
GET  /api/v1/land/contents/{id}             → 内容详情
POST /api/v1/land/contents/{id}/like        → 点赞
POST /api/v1/land/contents/{id}/favorite    → 收藏
POST /api/v1/land/contents/{id}/comment     → 评论
POST /api/v1/land/contents/{id}/tryon       → 发起 TryOn
GET  /api/v1/land/tryon/{id}                → 查询 TryOn 结果
GET  /api/v1/land/contents/{id}/promote     → 获取带货链接
```

请求/响应格式严格参照 `tech_requirement.md` 第 3 节 Land 部分。

### 页面设计参考

- **Feed 瀑布流**：卡片流展示，默认按发布时间倒序，支持标签筛选
- **标签栏**：`[FOR YOU]` `[BY COLLECTION]` 两个 Tab
- **内容卡片**：封面图 + 标题 + 创作者名称 + 互动计数
- **TryOn 弹窗**：上传照片 → 提交 → 显示 loading → 异步展示结果

详见 PRD 第 5.2 节。

---

## 6. 文件归属矩阵

> **铁律：每个文件只有一个 Agent 负责写入。如果矩阵中标记了多个 Agent，则通过分区协议隔离。**

| 文件 | Agent 0 | Agent A | Agent B | Agent C |
|------|:-------:|:-------:|:-------:|:-------:|
| `backend/database.py` | ✏️ | | | |
| `backend/models.py` | ✏️ | | | |
| `backend/schemas.py` | ✏️ | | | |
| `scripts/init_db.py` | ✏️ | | | |
| `requirements.txt` | ✏️ | | | |
| `frontend/src/types.ts` | ✏️ | | | |
| `frontend/src/store.ts` | ✏️骨架 | | ✏️Spark区 | ✏️Land区 |
| `backend/main.py` | | ✏️ | | |
| `backend/api/__init__.py` | | ✏️ | | |
| `backend/api/*.py` | | ✏️ | | |
| `backend/services/*.py` | | ✏️ | | |
| `frontend/src/App.tsx` | | | ✏️ | |
| `frontend/src/pages/Dashboard.tsx` | | | ✏️ | |
| `frontend/src/pages/Canvas.tsx` | | | ✏️ | |
| `frontend/src/components/canvas/*` | | | ✏️ | |
| `frontend/src/hooks/*` | | | ✏️ | |
| `frontend/src/pages/Land.tsx` | | | | ✏️ |
| `frontend/src/pages/LandDetail.tsx` | | | | ✏️ |
| `frontend/src/components/land/*` | | | | ✏️ |

---

## 7. Git 分支协议

### 分支命名

```
main                        ← Agent 0 完成后合并至此
  ├── feat/spark-backend    ← Agent A
  ├── feat/spark-frontend   ← Agent B
  └── feat/land             ← Agent C
```

### 合并顺序

1. **Agent 0** → `main`（完成后立即合并，解锁 Phase 1）
2. **`feat/spark-backend`** → `main`（后端先合，无前端文件冲突）
3. **`feat/spark-frontend`** → `main`（含 `App.tsx` 路由注册）
4. **`feat/land`** → `main`（最后合并，手动整合 `store.ts` Land 分区 + 在 `App.tsx` 注册 Land 路由）

### 合并时的冲突处理

| 文件 | 合并策略 |
|------|---------|
| `store.ts` | 按分区注释标记合并 Spark 区和 Land 区 |
| `App.tsx` | 在 Agent B 的路由配置中添加 Land 路由 import |
| 其他文件 | 各 Agent 独占，无冲突 |

---

## 8. P1 功能归属

以下功能在 P0 完成后，按归属 Agent 继续开发：

| 功能 | 归属 | 涉及文件 |
|------|------|---------|
| 图生视频 (P1-9) | Agent A + Agent B | Agent A: 视频生成 API 集成；Agent B: `VideoNode.tsx` |
| 内容详情页增强 (P1-10) | Agent C | `LandDetail.tsx` 扩展 |
| 互动偏好注入搭配 (P1-11) | Agent A | `outfit_service.py` prompt 增强 |
| 节点手动创建 (P1-12) | Agent B | 画布节点创建 UI |

---

## 9. 验收标准

### Agent 0 验收
- `python scripts/init_db.py` 成功建表
- `types.ts` 包含全部类型定义，`tsc --noEmit` 无报错
- `store.ts` 包含三个分区注释块

### Agent A 验收
- 全部 API 端点可通过 `curl` / HTTP 客户端调用，返回正确格式
- `./scripts/test.sh` 通过
- `./scripts/restart.sh` 服务正常启动

### Agent B 验收
- Dashboard 页面展示方案列表，支持新建
- 画布支持素材拖拽、LookBoard 渲染、快捷拍摄触发、结果采纳
- 发布弹窗可正常弹出并提交
- 使用 mock 数据时全部 UI 可正常交互

### Agent C 验收
- Feed 瀑布流正常渲染内容卡片
- 点赞/收藏/评论交互正常
- TryOn 弹窗上传照片 → 展示结果
- Promote 弹窗展示并支持复制链接
- 使用 mock 数据时全部 UI 可正常交互
