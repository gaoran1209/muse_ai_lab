# AGENTS.md

本文件只负责 **AI Agent 协作规范**、常用命令和文档同步要求。

产品定义以 `docs/PRD/` 为准。  
数据模型、API 契约、状态流转以 `docs/AI_Artifacts/tech_requirement.md` 为准。  
系统分层与 Provider inventory 说明见 `docs/AI_Artifacts/architecture.md` 与 `docs/AI_Artifacts/provider_sop.md`。

---

## 1. 文档职责

| 文档 | 职责 |
|------|------|
| `docs/PRD/...md` | 产品目标、P0/P1、交互流程、验收标准 |
| `docs/AI_Artifacts/tech_requirement.md` | 数据模型、API 契约、状态流转、技术拆分 |
| `docs/AI_Artifacts/architecture.md` | 架构分层、仓库结构、文档边界 |
| `docs/AI_Artifacts/provider_sop.md` | Provider 接入规范、配置命名、测试要求 |
| `AGENTS.md` / `CLAUDE.md` | AI Agent 协作规范 |

冲突处理规则：

1. 产品范围冲突，以 `PRD` 为准
2. 字段、schema、API path 冲突，以 `tech_requirement.md` 为准
3. 发现冲突时，先修文档，再改代码

---

## 2. 项目概览

MUSE AI Lab 是面向时尚行业的 AI 内容创作与验证平台。

- `Muse Spark`：创作者工作台
- `Muse Land`：内容消费端

当前技术栈：

- 后端：Python 3.12+ / FastAPI / SQLAlchemy / SQLite
- 前端：React 18 / TypeScript / Vite / Fabric.js / Zustand

---

## 3. 核心命令

### 后端

```bash
./scripts/setup.sh
./scripts/test.sh
./scripts/test.sh tests/providers/
./scripts/test.sh tests/services/
./scripts/test.sh tests/api/
PYTHONPATH=$(pwd) pytest tests/ -v
./scripts/restart.sh
```

### 前端

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run preview
```

访问地址：

- `http://localhost:5173/`
- `http://localhost:5173/canvas/:projectId`
- `http://localhost:5173/land`
- `http://localhost:5173/land/:contentId`

---

## 4. 协作规则

### 4.1 改代码前先看什么

- 做产品范围判断：先看 `PRD`
- 改字段、schema、接口：先看 `tech_requirement.md`
- 改 Provider：先看 `provider_sop.md`
- 判断模块边界：看 `architecture.md`

### 4.2 多 Agent 并行时的基本约束

- 不允许在未同步 `tech_requirement.md` 的情况下私自改数据模型或 API path
- 不允许在未同步 `PRD` 的情况下私自调整 P0/P1 或验收口径
- 公共契约文件优先级高于页面实现文件
- 如果多个 Agent 同时改同一契约文件，先合并文档，再合并代码

### 4.3 文件归属建议

- 后端契约：`src/backend/models.py`, `src/backend/schemas.py`, `src/backend/api/`
- 业务逻辑：`src/backend/services/`
- Provider：`src/backend/providers/`
- 前端页面：`src/frontend/src/pages/`
- 前端组件：`src/frontend/src/components/`
- 跨页面状态与类型：`src/frontend/src/store.ts`, `src/frontend/src/types.ts`

---

## 5. 开发约束

1. Python 虚拟环境在项目根目录 `.venv/`
2. 前端依赖在项目根目录 `node_modules/`
3. 涉及环境改动要同步 `package.json`、`requirements.txt`，并检查 `scripts/setup.sh`
4. 后端新增或修改代码后，使用 `./scripts/restart.sh` 重启服务
5. 测试文件放在 `tests/` 对应目录，命名遵循 `test_<name>.py`
6. commit 和 push 前先征求用户确认

---

## 6. 文档同步要求

发生以下变更时，必须同步文档：

- 改产品范围、P0/P1、验收标准：更新 `PRD`
- 改字段、schema、API、状态流转：更新 `tech_requirement.md`
- 改架构分层、仓库边界、Provider inventory：更新 `architecture.md`
- 改 Provider 接入方式、配置命名、测试要求：更新 `provider_sop.md`

如果只是常规代码实现且没有改契约，不要为了“看起来同步”去改产品文档。
