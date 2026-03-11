import os
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()


def _clean_secret(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    lowered = normalized.lower()
    if lowered.startswith("your_") or lowered.endswith("_here"):
        return None
    return normalized

class Config:
    # =============================================================================
    # Gemini (Google 直连) 配置
    # =============================================================================
    # Gemini API 密钥
    # LLM 模型: gemini-3.1-flash-lite-preview (多模态 LLM)
    # 图片模型:
    #   - gemini-3.1-flash-image-preview  (Nano Banana 2)
    #   - gemini-3-pro-image-preview      (Nano Banana Pro)
    #   - imagen-4.0-generate-001         (Imagen 4.0)
    #   - gemini-3.1-flash-lite-preview   (多模态 LLM)
    GEMINI_API_KEY = _clean_secret("GEMINI_API_KEY")
    GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME")
    GEMINI_IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL")

    # =============================================================================
    # 智谱 GLM 模型配置
    # 智谱 GLM 模型名称
    # 可选: glm-4.7-flash, glm-4.7, glm-4-plus, glm-z1-plus 等
    # =============================================================================
    # 智谱 API 密钥
    ZHIPU_API_KEY = _clean_secret("ZHIPU_API_KEY")
    ZHIPU_MODEL_NAME = os.getenv("ZHIPU_MODEL_NAME")

    # =============================================================================
    # 302.AI（默认服务商）
    # API 地址: https://api.302.ai/v1/chat/completions
    # API 文档: https://302ai.apifox.cn/343209599e0
    # 价格: https://302.ai/price
    # =============================================================================

    # 302.AI 支持模型（通过 Chat Completions API 调用）:
    #   - gemini-3.1-flash-image-preview   # Nano Banana 2
    #   - gemini-3-pro-image-preview       # Nano Banana Pro
    #   - gemini-3.1-flash-lite-preview    # 多模态 LLM
    THIRTYTWO_API_KEY = _clean_secret("THIRTYTWO_API_KEY")
    THIRTYTWO_LLM_MODEL = os.getenv("THIRTYTWO_LLM_MODEL")

    # =============================================================================
    # 302.AI 图片生成配置（非默认，用于 Nano-Banana WS 专用 API / Seedream API）
    # 默认图片生成通过 thirtytwo_gemini provider 使用 Chat Completions API
    # =============================================================================
    THIRTYTWO_IMAGE_MODEL = os.getenv("THIRTYTWO_IMAGE_MODEL")

    # =============================================================================
    # 302.AI Kling 视频生成配置
    # =============================================================================
    # Kling 视频生成模型名称
    # 可用模型:
    #   - kling-v-1-5-260121               # Kling v1.5（默认，最新版本）
    #   - kling-v-1-260121                 # Kling v1
    # 文档: https://doc.302.ai/421815034e0
    THIRTYTWO_VIDEO_MODEL = os.getenv("THIRTYTWO_VIDEO_MODEL")

    # =============================================================================
    # 数据库配置
    # =============================================================================
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/muse.db")

    # Debug 模式
    # =============================================================================
    DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() in ("true", "1", "on")

# 导出配置实例或直接导出变量
config = Config()
