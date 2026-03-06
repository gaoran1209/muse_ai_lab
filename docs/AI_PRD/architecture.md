# Muse AI Studio 架构设计

## 项目概览

Muse AI Studio 是一个 AI 内容生成平台，支持多厂商 LLM、图像生成、视频生成服务，并提供无限画布功能用于内容创作与整理。

**技术栈**:
- 后端: Python 3.12+ / FastAPI / Pytest
- 前端: React 18 / TypeScript / Vite / Fabric.js / Zustand

---

## 项目结构

```
muse_studio/
├── .env                          # API Keys、配置（不提交到 Git）
├── .env.example                  # 配置示例文件
├── .gitignore                    # Git 忽略规则
├── README.md                     # 项目说明文档
├── requirements.txt              # Python 依赖
├── package.json                  # 前端依赖（统一管理在根目录）
├── pnpm-lock.yaml                # 前端依赖锁文件
├── docs/                         # 文档目录
│   ├── PRD/                      # 产品需求文档
│   └── AI_PRD/                   # AI 实现指南
│       ├── architecture.md       # 架构设计文档（本文档）
│       └── provider_sop.md       # 模型/供应商添加标准操作流程
├── logs/                         # 日志输出目录
├── scripts/                      # 项目运行与运维脚本
│   ├── setup.sh                  # 初始化环境脚本
│   ├── test.sh                   # 运行测试脚本
│   └── restart.sh                # 服务重启脚本（前端+后端）
├── src/                          # 源代码主目录
│   ├── backend/                  # 后端代码（Python/FastAPI）
│   │   ├── main.py               # FastAPI 入口
│   │   ├── config.py             # 配置管理（读取 .env）
│   │   ├── logger.py             # 日志配置
│   │   ├── utils.py              # 工具函数
│   │   ├── api/                  # API 路由层
│   │   │   ├── __init__.py       # 模块导出
│   │   │   └── router.py         # API 路由定义（prefix=/api/v1）
│   │   ├── services/             # 核心业务逻辑
│   │   │   ├── provider_service.py  # Provider 服务层封装
│   │   │   ├── generation.py     # AI 生成调度服务
│   │   │   ├── outfit.py         # Outfit 相关服务
│   │   │   └── canvas.py         # Canvas 相关服务
│   │   └── providers/            # 外部 API 封装层
│   │       ├── param_spec.py     # 参数元数据定义（ParamSpec 数据类）
│   │       ├── llm/              # LLM 提供商
│   │       │   ├── __init__.py   # 模块导出
│   │       │   ├── base.py       # BaseLLMProvider 抽象基类
│   │       │   ├── zhipu.py      # 智谱 AI 实现
│   │       │   ├── gemini.py     # Google Gemini 实现
│   │       │   └── thirtytwo.py  # 302.AI 模型聚合平台实现
│   │       ├── image/            # 图像生成提供商
│   │       │   ├── __init__.py   # 模块导出
│   │       │   ├── base.py       # BaseImageProvider 抽象基类
│   │       │   ├── thirtytwo_nano_banana.py  # 302.AI Nano Banana 模型
│   │       │   └── thirtytwo_seedream.py     # 302.AI Seedream 模型
│   │       └── video/            # 视频生成提供商
│   │           ├── __init__.py   # 模块导出
│   │           ├── base.py       # BaseVideoProvider 抽象基类
│   │           └── thirtytwo_kling.py  # 302.AI Kling 视频生成实现
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
│           ├── pages/            # 页面组件
│           │   ├── Home.tsx      # 首页
│           │   └── Canvas.tsx    # 画布页面
│           ├── components/       # 通用组件
│           │   ├── CanvasEditor.tsx    # 画布编辑器入口
│           │   └── canvas/             # 画布相关组件
│           │       ├── InfiniteCanvas.tsx  # 无限画布核心组件
│           │       ├── InfiniteCanvas.css  # 画布样式（深色主题 + 点阵网格）
│           │       ├── BottomPromptBar.tsx # 底部生成面板（图片/视频 + 厂商 + 参数 chips）
│           │       └── BottomPromptBar.css # 底部面板样式（毛玻璃风格）
│           └── hooks/            # 自定义 Hooks
│               └── useFabricCanvas.ts  # Fabric.js 封装
└── tests/                        # 测试目录
    ├── conftest.py               # Pytest 配置
    ├── api/                      # API 测试
    │   └── test_router.py        # API 路由测试
    ├── services/                 # 服务层测试
    │   └── test_provider_service.py  # Provider 服务层测试
    └── providers/                # Provider 单元测试
        ├── test_param_spec.py    # 参数元数据测试
        ├── llm/                  # LLM 提供商测试
        │   ├── test_zhipu.py     # 智谱 AI 测试
        │   ├── test_gemini.py    # Gemini 测试
        │   └── test_thirtytwo.py # 302.AI 测试
        ├── image/                # 图像提供商测试
        │   ├── test_thirtytwo_nano_banana.py  # Nano Banana 测试
        │   └── test_thirtytwo_seedream.py     # Seedream 测试
        └── video/                # 视频提供商测试
            └── test_thirtytwo_kling.py  # Kling 视频测试
```

---

## 后端架构

### 分层设计

```
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Routes                        │
│              /api/v1/{llm,image,video}                  │
│                    (router.py)                          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Provider Service Layer                      │
│   ProviderRegistry | LLMService | ImageService |        │
│   VideoService      (provider_service.py)               │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  Provider Abstract Layer                 │
│     BaseLLMProvider | BaseImageProvider |               │
│     BaseVideoProvider        (providers/*/base.py)      │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                 External AI Services                     │
│      Zhipu | Gemini | 302.AI | Kling | ...              │
└─────────────────────────────────────────────────────────┘
```

### Provider 抽象基类

每种类型的 Provider 实现统一接口：

```python
class BaseLLMProvider(ABC):
    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name
        self.client = None

    @abstractmethod
    def generate(self, prompt: str, **kwargs) -> str:
        pass

    def is_available(self) -> bool:
        return self.client is not None
```

### 参数元数据系统

每个 Provider 通过 `GENERATE_PARAMS` 定义可暴露的参数规范：

```python
from ..param_spec import ParamSpec

class CustomProvider(BaseLLMProvider):
    GENERATE_PARAMS = (
        ParamSpec(
            name="temperature",
            type=float,
            exposed=True,          # True = 对外暴露，可通过 API 传入
            default=1.0,
            description="控制输出的随机性",
            choices=None,
            required=False,
        ),
    )
```

**参数过滤机制：**
- 只有 `exposed=True` 的参数才能通过 API 传入
- 服务层自动过滤未暴露的参数
- 前端可通过 `GET /api/v1/providers` 获取所有暴露参数列表

---

## 已实现的厂商

### LLM 提供商

| 厂商 | 类名 | 状态 | 暴露参数 | 推荐模型 |
|------|------|------|----------|----------|
| 智谱 AI | `ZhipuProvider` | ✅ | `thinking_enabled` | `glm-4.7-flash` |
| Google Gemini | `GeminiProvider` | ✅ | `thinking_level` | `gemini-2.5-flash` |
| 302.AI | `ThirtyTwoProvider` | ✅ | 无 | `gemini-2.5-flash` |

### 图像生成提供商

| 厂商 | 类名 | 状态 | 暴露参数 | 推荐模型 |
|------|------|------|----------|----------|
| 302.AI Nano Banana | `ThirtyTwoNanoBananaProvider` | ✅ | `images`, `resolution`, `aspect_ratio` | `google/nano-banana-2` |
| 302.AI Seedream | `ThirtyTwoSeedreamProvider` | ✅ | `image`, `aspect_ratio` | `doubao-seedream-5-0-260128` |

### 视频生成提供商

| 厂商 | 类名 | 状态 | 暴露参数 | 推荐模型 |
|------|------|------|----------|----------|
| 302.AI Kling | `ThirtyTwoKlingProvider` | ✅ | `images`, `model_name`, `mode`, `aspect_ratio`, `duration` | `kling-v2-5-turbo` |

---

## API 端点

### LLM 服务

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/llm/generate` | 生成文本 |
| GET | `/api/v1/llm/providers` | 获取所有 LLM Provider |

**请求示例：**
```json
POST /api/v1/llm/generate
{
  "vendor": "zhipu",
  "prompt": "请写一首关于春天的诗",
  "parameters": {
    "thinking_enabled": true
  }
}
```

### Image 服务

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/image/generate` | 生成图片 |
| GET | `/api/v1/image/providers` | 获取所有 Image Provider |

**请求示例：**
```json
POST /api/v1/image/generate
{
  "vendor": "thirtytwo_nano_banana",
  "prompt": "一只可爱的橘猫",
  "parameters": {
    "resolution": "2k",
    "aspect_ratio": "16:9"
  }
}
```

### Video 服务

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/video/generate` | 生成视频 |
| GET | `/api/v1/video/providers` | 获取所有 Video Provider |

**请求示例：**
```json
POST /api/v1/video/generate
{
  "vendor": "thirtytwo_kling",
  "prompt": "让画面中的云朵缓缓移动",
  "parameters": {
    "aspect_ratio": "16:9",
    "duration": 5
  }
}
```

### 统一端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/providers` | 获取所有 Provider（含暴露参数） |
| GET | `/health` | 健康检查 |

---

## 前端架构

### UI 风格：深色节点编辑器

画布页面采用深色节点编辑器风格设计：
- **背景**: 深色（`#111113`）+ CSS 点阵网格，随视口平移/缩放动态更新
- **左侧工具栏**: 毛玻璃侧边栏（文字、上传图片、平移、缩放）
- **底部生成面板**: 毛玻璃面板，支持图片/视频模式切换、厂商选择、参数 chips
- **图片边框**: 上传/生成的图片带半透明白色边框（`rgba(255,255,255,0.18)`），最大 280px，无旋转/缩放控制手柄

### 核心设计原则

1. **扁平化优先**: 避免过度嵌套，types 和 store 直接放在 `src/` 下
2. **相对导入**: 使用 `import './InfiniteCanvas.css'` 而非 `@/` 别名
3. **按需创建**: 避免空占位文件，需要时再创建
4. **Hook 模式**: Fabric.js 封装在 `useFabricCanvas.ts` 中，兼容 React

### 技术选型

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3+ | UI 框架 |
| TypeScript | 5.7+ | 类型安全 |
| Vite | 6.0+ | 构建工具 |
| Fabric.js | 6.4+ | 画布渲染引擎 |
| Zustand | 5.0+ | 状态管理 |
| React Router | 7.13+ | 路由管理 |

### 坐标系统

```
屏幕坐标 → 画布坐标：
canvasX = (screenX + viewport.x) / viewport.zoom
canvasY = (screenY + viewport.y) / viewport.zoom

画布坐标 → 屏幕坐标：
screenX = canvasX * viewport.zoom - viewport.x
screenY = canvasY * viewport.zoom - viewport.y
```

viewport 存储 `x = -vpt[4]`（Fabric 变换矩阵的负值），数值更直观。

### 无限画布核心功能

- **平移模式**: 空格键或左侧工具栏手型按钮切换
- **缩放**: 鼠标滚轮缩放（以鼠标位置为中心），侧边栏 +/- 按钮
- **元素操作**: 选择、拖拽、删除（Delete/Backspace 快捷键）
- **文字编辑**: 双击文字进入编辑模式
- **图片上传**: 侧边栏按钮或拖拽上传，图片带边框显示
- **AI 生成**: 底部面板输入 prompt，选择厂商和参数后生成图片/视频
- **参数 chips**: 后端暴露参数自动渲染为 chips（下拉选择/开关/输入框）

### 底部生成面板（BottomPromptBar）

面板从后端 API 获取可用厂商及其暴露参数，动态渲染 UI：

| 参数类型 | UI 渲染 |
|---------|---------|
| `choices` 非空 | 下拉选择 chip |
| `bool` | 开关 chip（ON/OFF） |
| `str` / `int` / `float` | 可编辑 chip（点击展开输入框） |
| `list` | 可编辑 chip（逗号分隔输入） |

生成请求格式：
```json
{
  "vendor": "thirtytwo_nano_banana",
  "prompt": "用户输入的描述",
  "parameters": { "resolution": "2k", "aspect_ratio": "16:9" }
}
```

---

## 添加新 Provider

按照 `docs/AI_PRD/provider_sop.md` 执行：

1. 创建 `src/backend/providers/<type>/<vendor>.py`，继承对应基类
2. 定义 `GENERATE_PARAMS` 类属性，使用 `ParamSpec` 声明参数
3. 更新 `src/backend/providers/<type>/__init__.py` 导出
4. 添加配置到 `config.py` 和 `.env.example`
5. 添加包到 `requirements.txt`
6. 创建测试 `tests/providers/<type>/test_<vendor>.py`
7. 运行 `./scripts/test.sh` 验证

---

## 开发规范

### Git 提交格式

```
<type>: <description>

[optional body]
```

类型: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### 代码质量检查点

- [ ] 函数小于 50 行
- [ ] 文件小于 800 行
- [ ] 无深层嵌套（>4 层）
- [ ] 错误处理完善
- [ ] 无硬编码值
- [ ] 使用不可变模式
- [ ] 新增代码包含测试，核心路径 80%+ 覆盖率
