# MUSE AI Lab 架构概览

> 本文档只负责说明系统分层、运行边界、当前仓库结构和文档分工。
> 产品范围与优先级以 `docs/PRD/` 为准，数据模型与 API 契约以 `docs/AI_Artifacts/tech_requirement.md` 为准。

---

## 1. 文档职责

| 文档 | 职责 | 不是它的职责 |
|------|------|--------------|
| `docs/PRD/...md` | 产品目标、P0/P1、交互流程、验收标准 | 数据库字段、API 细节、代码文件归属 |
| `docs/AI_Artifacts/tech_requirement.md` | 数据模型、API 契约、状态流转、技术拆分 | 产品优先级裁决、协作规范 |
| `docs/AI_Artifacts/architecture.md` | 系统分层、模块边界、当前仓库结构、文档分工 | 详细字段定义、接口请求体 |
| `docs/AI_Artifacts/provider_sop.md` | Provider 接入规范、配置命名、测试要求 | 产品默认用哪个模型做业务决策 |
| `AGENTS.md` / `CLAUDE.md` | AI Agent 协作规则、命令、改文档同步要求 | 产品定义、技术契约 |

---

## 2. 系统目标

MUSE AI Lab 是面向时尚行业的 AI 内容创作与验证平台，分为两个入口：

- `Muse Spark`：创作者工作台，负责素材管理、AI 搭配、虚拟拍摄、采纳与发布
- `Muse Land`：内容消费端，负责 Feed 浏览、详情互动、TryOn 与带货链接演示

Demo P0 的闭环口径是：

`Spark 生成并发布内容 -> Land 浏览/详情/互动/TryOn -> Spark 查看互动数据概览`

互动偏好自动注入 prompt 属于 P1，不属于本轮 P0 验收。

---

## 3. 架构分层

```text
Frontend (React + Vite + Fabric.js)
  ├─ Muse Spark: Dashboard / Canvas
  └─ Muse Land: Feed / Detail
            │
            ▼
FastAPI API Layer
  ├─ Provider routes
  └─ Spark / Land demo business routes
            │
            ▼
Service Layer
  ├─ Canvas / Project / Asset orchestration
  ├─ Outfit generation orchestration
  ├─ Shot generation / publish / land interactions
  └─ Provider registry and execution
            │
            ├─ SQLite + SQLAlchemy
            └─ Provider abstraction layer
                    ├─ LLM providers
                    ├─ Image providers
                    └─ Video providers
```

设计原则：

- 前后端通过 HTTP/JSON 通信
- Provider 层只负责模型调用，不承载业务编排
- Service 层承载 Spark / Land 业务逻辑
- `Shot` 在 Demo 阶段同时表示生成任务和生成结果
- `Content` 表示一次发布聚合，多图顺序以 `Content.shot_ids` 为准

---

## 4. 当前仓库结构

### 4.1 后端

```text
src/backend/
├── main.py                 # FastAPI 入口
├── config.py               # 环境变量配置
├── database.py             # 数据库与 demo store
├── models.py               # ORM 模型
├── schemas.py              # Pydantic 契约
├── api/
│   ├── router.py           # 根路由，聚合 providers + demo
│   ├── providers.py        # Provider API
│   └── demo.py             # 当前 Spark / Land Demo 业务 API
├── services/
│   ├── provider_service.py
│   ├── canvas_service.py
│   ├── outfit_service.py
│   └── generation_service.py
└── providers/
    ├── llm/
    ├── image/
    └── video/
```

### 4.2 前端

```text
src/frontend/src/
├── App.tsx
├── types.ts
├── store.ts
├── pages/
├── components/
└── hooks/
```

前端当前仍存在旧页面/旧组件是允许的，但新增页面和状态设计必须以 PRD 与 `tech_requirement` 为准，不以旧实现命名为准。

---

## 5. Provider 架构

Provider 统一通过抽象基类和 `ParamSpec` 元数据暴露能力：

- `BaseLLMProvider`
- `BaseImageProvider`
- `BaseVideoProvider`
- `ParamSpec`

当前仓库中的 Provider 清单以代码目录为准，SOP 负责接入规范：

- LLM: Gemini / Zhipu / 302.AI
- Image: Gemini Image (Nano Banana 2 / Nano Banana Pro)
- Video: 302.AI Kling

产品功能要选哪个 Provider 做默认实现，属于功能决策，应在 PRD 和 `tech_requirement` 中说明；不要在架构文档和 SOP 中硬编码产品默认模型。

---

## 6. 关键数据边界

这里只定义边界，不重复字段细节。字段与请求体以 `tech_requirement.md` 为准。

- `Project`: Spark 顶层容器
- `Asset`: 素材库实体
- `Look`: AI 搭配结果
- `LookItem`: Look 内部单品或占位项
- `Shot`: 生成任务及结果
- `Content`: 发布聚合，包含 1..N 个 `Shot`
- `Interaction`: 点赞/收藏/评论
- `TryOnTask`: Land 端异步试穿任务

---

## 7. 路由与状态约束

- 详细 API path、请求体、响应体以 `tech_requirement.md` 为准
- 当前代码中业务 API 主要集中在 `src/backend/api/demo.py`
- 如果未来按域拆成 `project_router.py`、`land_router.py` 等文件，必须保持 `tech_requirement.md` 中定义的契约不变
- `Shot.status` 和 `TryOnTask.status` 的流转规则以 `tech_requirement.md` 为准

---

## 8. 变更同步规则

发生以下变更时，必须同步对应文档：

- 改产品范围 / P0/P1 / 验收标准：更新 `PRD`
- 改字段 / schema / API path / 状态流转：先更新 `tech_requirement.md`
- 改 Provider inventory / 配置命名 / 接入流程：更新 `provider_sop.md`
- 改协作流程 / 命令 / 文档同步要求：更新 `AGENTS.md` 和 `CLAUDE.md`

如果多个文档冲突，按以下顺序处理：

1. 产品范围以 `PRD` 为准
2. 技术契约以 `tech_requirement.md` 为准
3. 先修文档，再改代码
