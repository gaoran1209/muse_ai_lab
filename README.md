# MUSE AI Lab

面向时尚行业的 **AI 内容创作与验证平台**：创作者通过 AI 快速生成搭配内容（Muse Spark），达人通过互动和试穿验证内容价值（Muse Land），互动数据实时回流驱动下一轮创作。

> **当前状态**:
> - 后端: 多厂商 AI 提供商封装完成，统一的调度层与 API 暴露设计实现
> - 前端: 包含双端（Muse Spark 工作台 + Muse Land 内容消费端）的基础交互架构已搭建阶段（React + Fabric.js + Zustand）

### 两大核心模块

- **Muse Spark (创作者工作台)**：给内容创作者使用，支持导入素材、AI 智能搭配补全与分组、虚拟拍摄节点流（换模特/换背景等）、内容采纳与发布。
- **Muse Land (内容消费端)**：给达人/KOL使用，沉浸式互动 Feed 流浏览、查看 Look 单品详情、图文 TryOn 虚拟试穿、表达消费偏好（点赞/收藏）。

## Project Structure

```text
muse_ai_lab/
├── .env                          # API Keys、配置
├── .env.example                  # 配置示例文件
├── .gitignore                    # Git 忽略规则
├── README.md                     # 项目说明文档
├── requirements.txt              # Python 依赖
├── package.json                  # 前端依赖（根目录统一管理）
├── pnpm-lock.yaml                # 前端依赖锁文件
├── docs/                         # 文档目录
│   ├── PRD/                      # 产品需求文档
│   └── AI_Artifacts/             # AI 开发辅助与参考文档（如架构、SOP等）
├── logs/                         # 日志输出目录
├── scripts/                      # 项目运行与运维脚本
│   ├── setup.sh                  # 初始化环境脚本
│   ├── test.sh                   # 运行测试脚本
│   └── restart.sh                # 服务重启脚本（前端+后端）
├── src/                          # 源代码主目录
│   ├── backend/                  # 后端代码（Python/FastAPI）
│   │   ├── main.py               # FastAPI 入口
│   │   ├── config.py             # 配置管理（读取 .env）
│   │   ├── database.py           # 数据库连接
│   │   ├── models.py             # ORM 模型
│   │   ├── schemas.py            # Pydantic Schema
│   │   ├── logger.py             # 日志配置
│   │   ├── utils.py              # 工具函数
│   │   ├── services/             # 核心业务逻辑
│   │   │   ├── provider_service.py  # Provider 服务层封装
│   │   │   ├── generation.py     # AI 生成调度服务
│   │   │   ├── outfit.py         # Outfit 相关服务
│   │   │   ├── canvas.py         # Canvas 相关服务
│   │   │   ├── design.py         # Design 相关服务
│   │   │   ├── feed.py           # Feed 相关服务
│   │   │   ├── asset.py          # Asset 相关服务
│   │   │   └── interaction.py    # Interaction 相关服务
│   │   ├── api/                  # API 路由层
│   │   │   ├── __init__.py       # 模块导出
│   │   │   ├── router.py         # API 路由定义
│   │   │   └── test_router.py    # API 路由测试
│   │   └── providers/            # 外部 API 封装层
│   │       ├── param_spec.py     # 参数元数据定义（ParamSpec 数据类）
│   │       ├── llm/              # LLM 提供商
│   │       ├── image/            # 图像生成提供商
│   │       └── video/            # 视频生成提供商
│   └── frontend/                 # 前端代码（React/TypeScript）
│       ├── index.html            # HTML 入口
│       ├── vite.config.ts        # Vite 配置
│       ├── tsconfig.json         # TypeScript 配置
│       └── src/                  # 前端源码
│           ├── main.tsx          # React 入口
│           ├── App.tsx           # 应用根组件
│           ├── App.css           # 全局样式
│           ├── types.ts          # 类型定义 + 常量
│           ├── store.ts          # Zustand 状态管理
│           ├── pages/            # 页面组件 (Dashboard, Canvas, Land 等)
│           ├── components/       # 通用组件
│           └── hooks/            # 自定义 Hooks
└── tests/                        # 测试目录
    ├── conftest.py               # Pytest 配置
    ├── api/                      # API 测试
    ├── services/                 # 服务层测试
    └── providers/                # Provider 单元测试
```

---

## 已实现的厂商

### LLM 提供商

| 厂商 | 类名 | 状态 | 暴露参数 | 推荐模型 |
|------|------|------|----------|----------|
| 智谱 AI | `ZhipuProvider` | ✅ | `thinking_enabled` | `glm-4.7-flash` |
| Google Gemini | `GeminiProvider` | ✅ | `thinking_level` | `gemini-2.5-flash` |
| 302.AI | `AI302Provider` | ✅ | 无 | `gemini-2.5-flash` |

### 图像生成提供商

| 厂商 | 类名 | 状态 | 暴露参数 | 推荐模型 |
|------|------|------|----------|----------|
| 302.AI Nano Banana | `AI302NanoBananaProvider` | ✅ | `images`, `resolution`, `aspect_ratio` | `google/nano-banana-2` |
| 302.AI Seedream | `AI302SeedreamProvider` | ✅ | `image`, `aspect_ratio` | `doubao-seedream-5-0-260128` |

### 视频生成提供商

| 厂商 | 类名 | 状态 | 暴露参数 | 推荐模型 |
|------|------|------|----------|----------|
| 302.AI Kling | `AI302KlingProvider` | ✅ | `images`, `model_name`, `mode`, `aspect_ratio`, `duration` | `kling-v2-5-turbo` |

---

## 后端 API 服务

### 架构分层

```text
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Routes                        │
│         /api/v1/{llm,image,video,providers}              │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Provider Service Layer                      │
│    ProviderRegistry | LLMService | ImageService | ...    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  Provider Abstract Layer                 │
│     BaseLLMProvider | BaseImageProvider | ...           │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                 External AI Services                     │
│      Zhipu | Gemini | 302.AI | Kling | ...              │
└─────────────────────────────────────────────────────────┘
```

### 启动服务

```bash
# 使用 restart.sh 脚本同时启动前端和后端
./scripts/restart.sh

# 仅启动后端
./scripts/restart.sh backend

# 仅启动前端
./scripts/restart.sh frontend

# 或手动启动后端
source .venv/bin/activate
uvicorn src.backend.main:app --reload --port 8000

# 访问 API 文档
open http://localhost:8000/docs
```

---

## 前端功能 (MUSE AI Lab Demo v0.6)

### Muse Spark: 创作者工作台

**UI 风格**：深色背景（`#111113`）+ 动态点阵网格，毛玻璃面板

- **素材库**：左侧面板支持展开/折叠。全区支持图片拖拽上传。上传后，后台将自动打标品类、风格等标签。
- **画布底层管控**：基于 Fabric.js 设计，允许鼠标拖拽平移，滚轮缩放范围控制在 50%～200%。
- **三类标准对象节点**：
  - **Text（文本）**：承载单一文本。
  - **Image（图像）**：包括素材图与 AI 渲染图，支持直接从素材库拖入。选中后可输入提示词直接触发生成。
  - **Video（视频）**：承载成片视频，结构上与 Image 统一。
- **AI 智能搭配逻辑**：
  - 选中 1~2 件单品触发「搭配补全」；选中 3 件以上单品触发「搭配分组」。
  - 在画布上自动生成 **Look / Board** 大分组视窗，包含推荐的搭配单品图组合，可整体拖拽移动与移除。
- **快捷虚拟拍摄节点流 (基于裂变)**：
  - 选中 Look 组，触发拍摄弹出 `[换模特]`、`[换背景]`、`[TryOn]` 或 `[自定义指令]`。自动裂变衍生出子节点构成连线控制图产生最终成果物。
- **结果面板与一键分发**：
  - 用户可对满意的节点结果点击「✅ 采纳」。选出多张优质设计存入右侧藏宝箱面板，接着点击「发布到 Muse Land」一键流转到内容场。

### Muse Land: 消费者 / 达人沉浸场

- **沉浸式 Feed 浏览**：达人用户进入 Land 后，默认按倒序或风格查看最新的穿搭种草内容。
- **达人 TryOn 体验**：点击「TryOn Me」可快速上传人像自拍图，联动试穿模型（VTON）将虚拟服饰效果覆盖成达人自我的实际上身效果供评估。
- **正反馈循环**：系统收集点赞、收藏互动记录，反推给 Muse Spark 做为下一轮 AI 供稿设计的个性化权重辅助数据。

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3+ | UI 框架 |
| TypeScript | 5.7+ | 类型安全 |
| Vite | 6.0+ | 构建工具 |
| Fabric.js | 6.4+ | 画布渲染引擎 |
| Zustand | 5.0+ | 状态管理 |
| React Router | 7.13+ | 路由管理 |

---

## 快速开始

### 1. 环境构建

```bash
./scripts/setup.sh    # 创建虚拟环境并安装前端、后端依赖
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入对应厂商的 API Keys
```

### 3. 运行测试

```bash
# 运行核心测试（不含外部 API 调用）
./scripts/test.sh tests/services/test_provider_service.py  # 服务层测试
./scripts/test.sh tests/api/test_router.py                   # API 路由测试
./scripts/test.sh tests/providers/test_param_spec.py        # 参数规范测试

# 运行指定类型测试（需要配置 API Key）
./scripts/test.sh tests/providers/llm/               # LLM 提供商测试
./scripts/test.sh tests/providers/image/             # 图像提供商测试
./scripts/test.sh tests/providers/video/             # 视频提供商测试
```

### 4. 启动服务

```bash
./scripts/restart.sh
```

访问地址:
- 首页 (Muse Spark Dashboard): http://localhost:5173/
- 画布创作空间 (Muse Spark Canvas): http://localhost:5173/canvas/:projectId
- 达人浏览街区 (Muse Land Feed): http://localhost:5173/land
- 接口文档: http://localhost:8000/docs

### 5. 构建前端

```bash
pnpm run build          # 构建生产版本
pnpm run preview        # 预览生产构建
```

---

## 开发与协作规范 (Agent Development Rules)

### 1. 技术栈与边界约束 (Architecture)
- **前后端架构边界**: 前端以纯视图为主，尽量依赖后端暴露业务抽象层（保持 Zustand Store 分区和 Backend Service 独立映射稳定）。
- **Provider 层独立**: Provider 层只承担对外大模型及服务的调用，严禁混入任何产品逻辑或业务编排代码。
- **数据库设计**: 采用零配置的 SQLite (`data/muse.db`) 结合 SQLAlchemy，由 8 个核心大表撑起整个生命周期业务闭环（Project, Asset, Look, LookItem, Shot, Content, Interaction, TryOnTask）。

### 2. 多 Agent 并行协作策略 (Agent Plan)
为保障并发工程的稳定性，本系统应用多 AI Agent 拆分方案，严格划定责任防止代码冲突破坏：
- **Agent 0 (Data Foundation)**: 提供系统地基。负责全局后端的 ORM 数据引擎表结构创建，并一次性敲定前台 `types.ts` 和基于 `store.ts` 的结构注视分区骨架建设。
- **Agent A (全部后端)**: 逻辑建设主脑。接管所有的业务 API 接口层代码开发（提供出 `/api/v1/` 底下全部业务）处理生成排队状态与协同业务 Service 逻辑分配。
- **Agent B (Spark 前端)**: 对抗核心交互体验。独占并负责创作者侧复杂工作台功能开发及画布组件渲染（依赖 `VITE_USE_MOCK=true` 与真实数据）。
- **Agent C (Land 前端)**: 闭环体验层。负责消费互动侧瀑布流。
- *隔离协议：`App.tsx` 的路由注册权归 Agent B，而各部分状态只写入基于 `store.ts` 内划定好的专属注释区段。*

### 3. 添加新供应商 (Provider SOP)

参考 `docs/AI_Artifacts/provider_sop.md`。

1. 当需要在系统扩展 LLM、图生平台时，前往 `src/backend/providers/<type>/<vendor>.py` 创建对应提供商的具体实现。
2. 内部必须继承基类并定义 `GENERATE_PARAMS` 来获得系统的参数拦截与过滤分配，且切忌在路由层随意硬编码。
3. ENV 环境与常量配置遵守 `<VENDOR>_API_KEY` 模型名称等约定，不要凭空发明前缀。
4. 提供覆盖完备的初始化、API 请求和 ParamSpec 的测试验证于 `tests/providers/<type>/test_<vendor>.py`。

### 4. 冲突解决基准
发现矛盾和未决事物时执行此同步顺序：`产品目标规则以 PRD ＞ 数据和接口协议以 tech_requirement.md ＞ 任何修补必须首先反映在说明书（Docs）中再改代码。`

## License

MIT
