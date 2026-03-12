<div align="center">

  <h1>🎨 MUSE AI Lab</h1>

  <h3>面向时尚行业的 AI 内容创作与验证平台</h3>

  <p>
    创作者通过 AI 快速生成搭配内容 <strong>（Muse Spark）</strong><br/>
    达人通过互动和试穿验证内容价值 <strong>（Muse Land）</strong><br/>
    互动数据实时回流驱动下一轮创作
  </p>

  <div>
    <img alt="Python" src="https://img.shields.io/badge/python-3.12+-blue.svg"/>
    <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115-009688.svg"/>
    <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB.svg"/>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.6-3178C6.svg"/>
    <img alt="Fabric.js" src="https://img.shields.io/badge/Fabric.js-6.4-orange.svg"/>
    <img alt="License" src="https://img.shields.io/badge/license-MIT-green.svg"/>
  </div>

  <br/>

  <p>
    <a href="#核心亮点">核心亮点</a>
    ◆ <a href="#快速开始">快速开始</a>
    ◆ <a href="#功能模块">功能模块</a>
    ◆ <a href="#系统架构">系统架构</a>
    ◆ <a href="#ai-provider">AI Provider</a>
    ◆ <a href="#仓库结构">仓库结构</a>
    ◆ <a href="#开发指南">开发指南</a>
  </p>

</div>

---

## 核心亮点

MUSE AI Lab 将服装内容生产链路中**选款、搭配、拍摄、发布、反馈**五个环节串联为统一的 AI 工作流，打通 TapNow 等竞品缺失的「消费端闭环」：

- **🤖 AI 智能搭配** — 多模态 LLM 分析单品图片，自动推荐 3~5 件单品组合，理解品类、风格、季节和场合
- **📸 虚拟拍摄工作台** — 无限画布中一键换模特 / 换背景 / 图文 TryOn，异步生成，结果以节点形式呈现
- **🗂️ 素材智能打标** — 上传即自动识别品类、颜色、风格标签，支持公共素材库与个人素材库
- **🌊 Muse Land 内容场** — 瀑布流 Feed、单品明细、点赞 / 收藏 / 评论、虚拟试穿一体化体验
- **🔄 数据闭环** — 消费端互动数据回流 Dashboard，驱动下一轮内容决策
- **🔌 多 Provider 架构** — Gemini / 智谱 / 302.AI，LLM、图像、视频三类能力统一抽象，灵活切换

---

## 快速开始

### 前置要求

- Python 3.12+
- Node.js 18+ 及 pnpm 10+
- 至少配置一个 AI 厂商 API Key（Gemini / 智谱 / 302.AI 三选一）

### 1. 克隆并初始化环境

```bash
git clone <repo-url>
cd muse_ai_lab

# 初始化后端虚拟环境 + 安装依赖
./scripts/setup.sh
```

### 2. 配置 API Keys

```bash
cp .env.example .env
# 编辑 .env，至少填入一个厂商的 API Key
```

```env
# Gemini（Google 直连）
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL_NAME=gemini-3.1-flash-lite-preview
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview

# 智谱 GLM
ZHIPU_API_KEY=your_zhipu_key
ZHIPU_MODEL_NAME=glm-4.7-flash

# 302.AI（代理，支持 LLM + 图像 + 视频）
AI302_API_KEY=your_302_key
AI302_LLM_MODEL=gemini-3.1-flash-lite-preview
AI302_VIDEO_MODEL=kling-v-1-5-260121
```

### 3. 启动服务

**后端**（FastAPI，端口 8000）：

```bash
./scripts/restart.sh
```

**前端**（Vite，端口 5173）：

```bash
pnpm install
pnpm run dev
```

### 4. 访问平台

| 页面 | 地址 |
|------|------|
| 工作台 Dashboard | http://localhost:5173/ |
| 画布工作台 | http://localhost:5173/canvas/:projectId |
| Muse Land Feed | http://localhost:5173/land |
| 内容详情页 | http://localhost:5173/land/:contentId |
| API 文档 (Swagger) | http://localhost:8000/docs |

---

## 功能模块

### Muse Spark — 创作者工作台

**UI 风格**：深色背景（`#111113`）+ 动态点阵网格，毛玻璃面板

```
Dashboard（/）
├── 方案卡片网格     创建/打开设计方案，查看封面和时间
└── 互动数据概览     已发布内容的点赞/收藏/评论汇总

画布工作台（/canvas/:projectId）
├── 左侧素材面板     上传/分类/拖拽，AI 自动打标
│   └── 分类标签页   全部 / 商品 / 模特 / 背景 / 姿势
├── 无限画布（中部） Fabric.js，缩放范围 50%～200%
│   ├── LookBoard    AI 搭配结果的可视化分组看板
│   ├── ShotNode     生成结果节点（含轮询 loading 状态）
│   └── VideoNode    视频节点
├── 悬浮工具条       选中对象后浮现，提供快捷操作
│   └── 快捷操作     AI 搭配 / 换模特 / 换背景 / TryOn / 自定义
├── 右侧结果面板     按 Look 分组展示生成结果，一键采纳
└── 发布弹窗         填写标题/描述/标签，发布到 Muse Land
```

**AI 搭配触发规则**：选中 1~2 件单品 → 触发「搭配补全」；选中 3 件以上 → 触发「搭配分组」

**快捷拍摄节点裂变**：选中 Look 后触发，自动派生子节点并用连线关联，子节点展示异步生成进度

### Muse Land — 内容消费端

```
Feed 流（/land）
├── 标签栏           FOR YOU / BY COLLECTION
└── 内容瀑布流       封面图、标题、互动数据

内容详情页（/land/:contentId）
├── 大图浏览         左右翻页，多图内容
├── 搭配单品明细     Look 内各单品及带货链接
├── 互动栏           点赞 / 收藏 / 评论（幂等 toggle）
├── 虚拟试穿         上传人像照片 → 异步生成试穿效果
└── 带货链接弹窗     Demo 阶段静态 mock
```

**数据闭环**：消费端点赞 / 收藏偏好数据回流 Spark，作为下一轮 AI 搭配的个性化权重

---

## 系统架构

```
Frontend (React 18 + TypeScript + Vite + Fabric.js + Zustand)
  ├─ Muse Spark: Dashboard / Canvas
  └─ Muse Land: Feed / Detail
                    │  HTTP/JSON
                    ▼
FastAPI API Layer (/api/v1/)
  ├─ projects, assets, looks
  ├─ shots (generation), contents (publish)
  └─ land (feed, interactions, tryon, promote)
                    │
                    ▼
Service Layer
  ├─ ProjectService / AssetService     素材管理、画布自动保存（debounce）
  ├─ OutfitService                     AI 搭配编排（多模态 LLM）
  ├─ GenerationService                 虚拟拍摄调度（BackgroundTasks + 轮询）
  ├─ ContentService                    内容发布聚合
  └─ LandService                       Feed 查询、互动、TryOn 任务
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
SQLite + SQLAlchemy     Provider 抽象层
  data/muse.db            ├─ BaseLLMProvider
                          ├─ BaseImageProvider
                          └─ BaseVideoProvider
```

### 数据模型关系

```
Project 1──N Asset（通过 ProjectAsset 关联表）
Project 1──N Look
Look    1──N LookItem（关联 Asset，支持占位描述）
Look    1──N Shot（生成任务及结果，status: queued→processing→completed|failed）
Shot    N──1 Content（采纳后发布，Shot.content_id 回写）
Content 1──N Interaction（点赞/收藏/评论）
Content 1──N TryOnTask（Land 端异步试穿）
```

**核心约定**：`Shot` 同时表示一次生成任务和其最终产物；`Content` 是发布聚合，多图顺序以 `Content.shot_ids` 为准。

---

## AI Provider

平台通过统一抽象基类支持三类 AI 能力，每类均可多 Provider 切换：

### LLM 提供商

| 厂商 | Provider 类 | 推荐模型 | 能力 |
|------|------------|---------|------|
| Google Gemini | `GeminiProvider` | `gemini-3.1-flash-lite-preview` | 多模态理解、结构化输出 |
| 智谱 GLM | `ZhipuProvider` | `glm-4.7-flash` | 中文语义、thinking 模式 |
| 302.AI | `AI302Provider` | `gemini-3.1-flash-lite-preview` | 代理聚合 |

### 图像生成提供商

| 厂商 | Provider 类 | 推荐模型 | 说明 |
|------|------------|---------|------|
| Gemini Image | `GeminiImageProvider` | `gemini-3.1-flash-image-preview` | 直连，Nano Banana 2 |
| 302.AI Gemini | `AI302GeminiImageProvider` | `gemini-3-pro-image-preview` | 代理，Nano Banana Pro |
| 302.AI Seedream | `AI302SeedreamProvider` | `doubao-seedream-5-0-260128` | 字节 Seedream |
| 302.AI NanoBanana | `AI302NanaBananaProvider` | `google/nano-banana-2` | WS 专用 API |

### 视频生成提供商

| 厂商 | Provider 类 | 推荐模型 | 参数 |
|------|------------|---------|------|
| 302.AI Kling | `AI302KlingProvider` | `kling-v-1-5-260121` | `mode`, `aspect_ratio`, `duration` |

> 新增 Provider 参考 `docs/AI_Artifacts/provider_sop.md`，继承基类并定义 `GENERATE_PARAMS`。

---

## 仓库结构

```
muse_ai_lab/
├── src/
│   ├── backend/
│   │   ├── main.py                    # FastAPI 入口，注册路由和生命周期
│   │   ├── config.py                  # 环境变量配置（读取 .env）
│   │   ├── database.py                # SQLAlchemy 引擎 + 会话管理
│   │   ├── models.py                  # ORM 模型（8 张核心表）
│   │   ├── schemas.py                 # Pydantic 数据契约
│   │   ├── api/
│   │   │   ├── router.py              # 根路由聚合
│   │   │   ├── project_router.py      # 设计方案 CRUD + 画布状态
│   │   │   ├── asset_router.py        # 素材库管理
│   │   │   ├── look_router.py         # AI 搭配生成
│   │   │   ├── generation_router.py   # 虚拟拍摄 Shot 调度
│   │   │   ├── content_router.py      # 内容发布
│   │   │   └── land_router.py         # Muse Land Feed + 互动 + TryOn
│   │   ├── services/
│   │   │   ├── project_service.py     # Project / canvas_state 管理
│   │   │   ├── asset_service.py       # 素材上传 + LLM 自动打标
│   │   │   ├── outfit_service.py      # AI 搭配编排（多模态 LLM）
│   │   │   ├── generation_service.py  # Shot 调度 + TryOn
│   │   │   ├── content_service.py     # 内容发布聚合
│   │   │   ├── land_service.py        # Feed 查询 + 互动
│   │   │   └── prompt_templates.py    # 集中管理全部 LLM prompt
│   │   └── providers/
│   │       ├── param_spec.py          # ParamSpec 元数据系统
│   │       ├── llm/                   # Gemini / Zhipu / 302.AI
│   │       ├── image/                 # Gemini / 302.AI 系列
│   │       └── video/                 # Kling
│   └── frontend/src/
│       ├── App.tsx                    # 路由定义
│       ├── types.ts                   # 全局类型定义
│       ├── store.ts                   # Zustand store（Canvas / Asset / Land）
│       ├── pages/
│       │   ├── Dashboard.tsx          # 方案列表 + 数据概览
│       │   ├── Canvas.tsx             # 画布工作台入口
│       │   ├── Land.tsx               # Feed 流页面
│       │   └── LandDetail.tsx         # 内容详情页
│       └── components/
│           ├── canvas/                # LookBoard / ShotNode / AssetPanel 等
│           └── land/                  # ContentCard / TryOnDialog 等
├── docs/
│   ├── PRD/                           # 产品需求文档（v0.6）
│   └── AI_Artifacts/                  # 技术需求 / 架构 / Provider SOP
├── tests/
│   ├── api/                           # API 路由测试
│   ├── services/                      # 服务层测试
│   └── providers/                     # Provider 单元测试
├── scripts/
│   ├── setup.sh                       # 初始化虚拟环境 + 安装依赖
│   ├── restart.sh                     # 重启后端服务
│   └── test.sh                        # 运行 pytest 测试
└── data/                              # SQLite 数据库 + 上传文件（gitignore）
```

---

## 开发指南

### 常用命令

```bash
# ── 后端 ──────────────────────────────────────────
./scripts/setup.sh                     # 初始化虚拟环境和依赖
./scripts/restart.sh                   # 重启后端服务
./scripts/test.sh                      # 运行全部测试
./scripts/test.sh tests/providers/     # 只运行 Provider 测试
./scripts/test.sh tests/services/      # 只运行 Service 测试
./scripts/test.sh tests/api/           # 只运行 API 测试

# ── 前端 ──────────────────────────────────────────
pnpm install                           # 安装依赖
pnpm run dev                           # 启动开发服务器
pnpm run build                         # 构建生产包
pnpm run preview                       # 预览构建结果
```

### 文档体系

修改代码前，先确认需要参考哪份文档：

| 场景 | 参考文档 |
|------|---------|
| 判断功能是否在范围内 | `docs/PRD/` |
| 改字段、schema、API path | `docs/AI_Artifacts/tech_requirement.md` |
| 改架构分层、模块边界 | `docs/AI_Artifacts/architecture.md` |
| 新增或修改 Provider | `docs/AI_Artifacts/provider_sop.md` |

> **冲突处理**：产品范围以 PRD 为准 → 技术契约以 tech_requirement.md 为准 → 先修文档再改代码。

### 技术栈一览

| 层 | 技术 | 版本 |
|----|------|------|
| 前端框架 | React + TypeScript + Vite | 18 / 5.6 / 6.0 |
| 画布引擎 | Fabric.js | 6.4 |
| 状态管理 | Zustand | 5.0 |
| 路由 | React Router | 7.13 |
| 后端框架 | FastAPI + Python | 0.115 / 3.12+ |
| ORM / 数据库 | SQLAlchemy + SQLite | 2.0 |
| 对象存储 | 阿里云 OSS | — |
| AI SDK | Google GenAI + OpenAI-compatible | — |
| 包管理 | pnpm（前端）/ venv（后端）| 10 / — |

---

## License

MIT License

---

<div align="center">
  <p>
    <strong>MUSE AI Lab</strong><br/>
    <sub>让 AI 打通时尚内容创作与消费的完整闭环</sub>
  </p>
</div>
