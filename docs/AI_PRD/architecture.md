# Muse AI Studio 架构设计

## 项目概览

Muse AI Studio 是一个 AI 内容生成平台，支持多厂商 LLM、图像生成、视频生成服务，并提供无限画布功能用于内容创作与整理。

**技术栈**:
- 后端: Python 3.12+ / FastAPI / PostgreSQL / Pytest
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
│       └── architecture.md       # 本文档
├── logs/                         # 日志输出目录
│   └── app_YYYYMMDD_HHMMSS.log   # 带时间戳的日志文件
├── scripts/                      # 项目运行与运维脚本
│   ├── setup.sh                  # 初始化环境脚本
│   └── test.sh                   # 运行测试脚本
├── src/                          # 源代码主目录
│   ├── backend/                  # 后端代码（Python/FastAPI）
│   │   ├── main.py               # FastAPI 入口（待实现）
│   │   ├── config.py             # 配置管理（读取 .env）
│   │   ├── database.py           # 数据库连接（待实现）
│   │   ├── models.py             # ORM 模型（待实现）
│   │   ├── schemas.py            # Pydantic Schema（待实现）
│   │   ├── utils.py              # 日志、工具函数
│   │   ├── services/             # 核心业务逻辑
│   │   │   ├── generation.py     # AI 生成调度服务
│   │   │   ├── outfit.py         # Outfit 相关服务
│   │   │   └── canvas.py         # Canvas 相关服务
│   │   └── providers/            # 外部 API 封装层
│   │       └── llm/              # LLM 提供商
│   │           ├── __init__.py   # 模块导出
│   │           ├── base.py       # BaseLLMProvider 抽象基类
│   │           └── zhipu.py      # ZhipuProvider 实现
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
│           │       └── InfiniteCanvas.tsx  # 无限画布核心组件
│           └── hooks/            # 自定义 Hooks
│               └── useFabricCanvas.ts  # Fabric.js 封装
└── tests/                        # 测试目录
    └── llm/                      # LLM 测试
        └── test_zhipu.py         # ZhipuProvider 测试
```

---

## 前端架构

### 技术选型

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3+ | UI 框架 |
| TypeScript | 5.7+ | 类型安全 |
| Vite | 6.0+ | 构建工具 |
| Fabric.js | 6.4+ | 画布渲染引擎 |
| Zustand | 5.0+ | 状态管理 |
| React Router | 7.13+ | 路由管理 |

### 目录结构原则

1. **扁平化优先**: 避免过度嵌套，单文件目录直接放在父级
2. **按功能分组**: components/ 下按功能划分子目录（如 canvas/）
3. **就近导入**: 使用相对导入而非 @/ 别名，代码更清晰
4. **避免空文件**: 不创建占位文件，需要时再添加

### 核心模块说明

#### 1. 类型定义 (`types.ts`)

合并类型定义与常量配置，避免多个小文件：

```typescript
// 画布元素类型
export type CanvasItemType = 'text' | 'image';

// 视口状态
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// 颜色常量
export const COLORS = {
  background: '#f8fafc',
  grid: '#e2e8f0',
  selection: '#3b82f6',
  text: '#1e293b',
} as const;

// 限制常量
export const LIMITS = {
  minZoom: 0.1,
  maxZoom: 5,
  defaultFontSize: 16,
  minTextWidth: 120,
} as const;
```

#### 2. 状态管理 (`store.ts`)

使用 Zustand 管理全局状态：

```typescript
interface CanvasStore {
  // 状态
  items: CanvasItem[];
  viewport: Viewport;
  selectedIds: string[];
  isPanning: boolean;

  // 操作
  addItem: (item: CanvasItem) => void;
  updateItem: (id: string, updates: Partial<CanvasItem>) => void;
  deleteItem: (id: string) => void;
  // ...
}
```

#### 3. Fabric.js Hook (`useFabricCanvas.ts`)

封装 Fabric.js 操作，提供 React 友好的 API：

```typescript
const {
  canvas,           // Fabric 画布实例
  viewport,         // 当前视口状态
  resize,           // 调整画布大小
  setZoom,          // 设置缩放
  pan,              // 平移画布
  addImage,         // 添加图片
  addText,          // 添加文字
  deleteSelected,   // 删除选中元素
  clear,            // 清空画布
} = useFabricCanvas(canvasRef, options);
```

#### 4. 无限画布组件 (`InfiniteCanvas.tsx`)

核心功能实现：

- **平移模式**: 空格键或工具栏按钮切换
- **缩放**: 鼠标滚轮缩放（以鼠标位置为中心）
- **元素操作**: 选择、拖拽、删除（Delete/Backspace）
- **文字编辑**: 双击文字进入编辑模式
- **图片上传**: 点击按钮或拖拽上传
- **坐标转换**: 屏幕坐标 ↔ 画布坐标自动转换

### 坐标系统

```
屏幕坐标 → 画布坐标：
canvasX = (screenX + viewport.x) / viewport.zoom
canvasY = (screenY + viewport.y) / viewport.zoom

画布坐标 → 屏幕坐标：
screenX = canvasX * viewport.zoom - viewport.x
screenY = canvasY * viewport.zoom - viewport.y
```

### 开发命令

```bash
# 安装依赖（根目录）
pnpm install

# 启动开发服务器
pnpm run dev

# 构建生产版本
pnpm run build

# 预览生产构建
pnpm run preview
```

### 访问地址

- 首页: http://localhost:5173/
- 画布页: http://localhost:5173/canvas

---

## 后端架构

### 模块组织

```
backend/
├── config.py       # 配置管理（从 .env 读取）
├── utils.py        # 工具函数（日志等）
├── services/       # 业务逻辑层
│   ├── generation/  # AI 生成服务
│   ├── outfit/      # Outfit 服务
│   └── canvas/      # Canvas 同步服务
└── providers/       # 外部 API 封装
    ├── llm/         # LLM 提供商
    ├── image/       # 图像生成提供商
    └── video/       # 视频生成提供商
```

### 提供商模式

所有外部 API 遵循统一接口：

```python
class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, **kwargs) -> str:
        pass

    @abstractmethod
    async def stream_generate(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        pass
```

---

## 开发规范

### Git 提交格式

```
<type>: <description>

[optional body]
```

类型: feat, fix, refactor, docs, test, chore, perf, ci

### 代码质量检查点

- [ ] 函数小于 50 行
- [ ] 文件小于 800 行
- [ ] 无深层嵌套（>4 层）
- [ ] 错误处理完善
- [ ] 无硬编码值
- [ ] 使用不可变模式
