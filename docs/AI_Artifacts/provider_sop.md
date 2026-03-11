# Provider 接入 SOP

> 本文档只负责 Provider 接入规范、配置命名、测试要求和同步清单。
> 产品功能默认使用哪个模型，不在本文档裁决；产品选择以 PRD 和 `tech_requirement.md` 为准。

---

## 1. 适用范围

适用于向 `src/backend/providers/` 添加或调整：

- LLM Provider
- Image Provider
- Video Provider

---

## 2. 当前仓库 Provider 清单

以当前代码目录为准：

### 2.1 LLM

- `src/backend/providers/llm/gemini.py`
- `src/backend/providers/llm/zhipu.py`
- `src/backend/providers/llm/ai302.py`

### 2.2 Image

- `src/backend/providers/image/gemini.py`

### 2.3 Video

- `src/backend/providers/video/ai302_kling.py`

---

## 3. 配置命名规范

以 `src/backend/config.py` 为准，当前命名如下：

```python
GEMINI_API_KEY
GEMINI_MODEL_NAME
GEMINI_IMAGE_MODEL

ZHIPU_API_KEY
ZHIPU_MODEL_NAME

AI302_API_KEY
AI302_LLM_MODEL
AI302_VIDEO_MODEL
```

新增 Provider 时遵守：

- API Key: `<VENDOR>_API_KEY`
- LLM 模型名: `<VENDOR>_MODEL_NAME` 或已有平台约定命名
- Image 模型名: `<VENDOR>_IMAGE_MODEL`
- Video 模型名: `<VENDOR>_VIDEO_MODEL`

如果是聚合平台，优先沿用平台级命名，不要为了文档美观重命名现有环境变量。

---

## 4. 目录与命名规范

```text
src/backend/providers/
├── param_spec.py
├── llm/
│   ├── base.py
│   └── <vendor>.py
├── image/
│   ├── base.py
│   └── <vendor>.py
└── video/
    ├── base.py
    └── <vendor>.py
```

命名约束：

- 模块文件：小写下划线，如 `zhipu.py`
- Provider 类：`*Provider`
- 单例实例：小写下划线，如 `zhipu_provider`
- 测试文件：`tests/providers/<type>/test_<vendor>.py`

---

## 5. 接入步骤

1. 在对应目录新增 Provider 文件，继承基类
2. 在对应 `__init__.py` 中导出 Provider
3. 补充 `config.py` 和 `.env.example`
4. 如有新 SDK，更新 `requirements.txt`
5. 如需要测试依赖，更新 `scripts/test.sh`
6. 增加 Provider 测试
7. 运行测试并验证 `ProviderRegistry` / API 可发现
8. 若影响可用 Provider inventory，同步 `architecture.md`

---

## 6. 抽象接口约束

所有 Provider 必须继承统一基类：

- `BaseLLMProvider`
- `BaseImageProvider`
- `BaseVideoProvider`

所有对外暴露参数必须通过 `ParamSpec` 定义，并满足：

- 仅 `exposed=True` 的参数可透传到前端/API
- 默认值、描述、choices 必须完整
- 不允许在路由层硬编码私有参数

---

## 7. 实现要求

### 7.1 LLM Provider

- 必须实现 `generate()`
- 返回文本结果或明确错误
- 需要在不可用时给出可诊断状态

### 7.2 Image Provider

- 必须实现 `generate()`
- 支持当前项目需要的文生图 / 图生图场景
- 返回统一结果结构，便于服务层上传 OSS 或继续编排

### 7.3 Video Provider

- 必须实现 `generate()`
- 如果上游 API 是异步任务，Provider 内部可以轮询，也可以返回可追踪结果，但对服务层的输出契约要稳定

---

## 8. 测试要求

测试位置：

- `tests/providers/llm/test_<vendor>.py`
- `tests/providers/image/test_<vendor>.py`
- `tests/providers/video/test_<vendor>.py`

最低要求：

- Provider 在缺少 API Key 时可安全初始化
- Provider 在存在 API Key 时可发起最小调用
- `ParamSpec` 暴露参数正确
- `ProviderRegistry` 可发现该 Provider

推荐命令：

```bash
PYTHONPATH=$(pwd) pytest tests/providers/ -v
./scripts/test.sh
```

---

## 9. 文档同步清单

新增或调整 Provider 后，检查以下文档是否需要同步：

- `docs/AI_Artifacts/architecture.md`
  何时更新：Provider inventory 发生变化
- `docs/AI_Artifacts/tech_requirement.md`
  何时更新：API 契约、默认业务链路或参数暴露规则变化
- `AGENTS.md` / `CLAUDE.md`
  一般不需要更新，除非协作流程改变

---

## 10. 禁止事项

- 不要在本文档里定义产品 P0/P1
- 不要在本文档里声明“某功能必须使用某模型”，除非该约束已经在 `tech_requirement.md` 明确
- 不要新增 Provider 却不更新 `__init__.py`、配置项和测试
- 不要让前端直接依赖 Provider 私有参数
