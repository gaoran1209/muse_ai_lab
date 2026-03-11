import os
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

class Config:
    # =============================================================================
    # Gemini LLM 模型配置
    # =============================================================================
    # Gemini API 密钥
    # Gemini LLM 模型名称
    # 可选: gemini-2.5-flash, gemini-2.5-flash-lite, gemini-3-flash-preview,
    #       gemini-3-pro-preview, gemini-3.1-pro-preview, gemini-flash-latest 等
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME")

    # =============================================================================
    # 智谱 GLM 模型配置
    # 智谱 GLM 模型名称
    # 可选: glm-4.7-flash, glm-4.7, glm-4-plus, glm-z1-plus 等
    # =============================================================================
    # 智谱 API 密钥
    ZHIPU_API_KEY = os.getenv("ZHIPU_API_KEY")
    ZHIPU_MODEL_NAME = os.getenv("ZHIPU_MODEL_NAME")

    # =============================================================================
    # 302.AI 是一个 AI 模型聚合平台，提供 OpenAI 兼容格式的统一 API
    # 官方文档: https://302ai.apifox.cn/api-147522041
    # 价格: https://302.ai/price
    # 302.LLM 配置
    # =============================================================================

    # 302 LLM 模型名称
    # 常用 Gemini 模型（推荐）:
    #   - gemini-2.5-flash                    # 快速响应版（推荐）
    #   - gemini-2.5-pro                      # 专业版
    #   - gemini-3-pro-preview                # 第三代专业版预览
    #   - gemini-2.5-flash-preview-05-20      # Flash 预览版
    #   - gemini-2.5-flash-lite-preview-06-17 # Flash 轻量版
    #   - gemini-2.5-pro-preview-06-05        # Pro 预览版
    #   - gemini-2.5-pro-preview-06-05-thinking # Pro 预览版（展示思考）
    # 更多模型请参考: https://doc.302.ai/147522041e0
    THIRTYTWO_API_KEY = os.getenv("THIRTYTWO_API_KEY")
    THIRTYTWO_LLM_MODEL = os.getenv("THIRTYTWO_LLM_MODEL")

    # =============================================================================
    # 302.AI 图片生成配置
    # =============================================================================
    # 图片生成模型名称
    # Google Nano-Banana 系列:
    #   - google/nano-banana-2                      # Nano-Banana-2（性价比高）
    #   - google/nano-banana-pro                    # Nano-Banana-Pro（更高质量）
    #   - google/nano-banana                        # Nano-Banana（轻量版）
    # Doubao Seedream 系列:
    #   - doubao-seedream-5-0-260128                # Seedream 5.0（最新版本）
    #   - doubao-seedream-4-5-251024                # Seedream 4.5
    #   - doubao-seedream-4-0-250828                # Seedream 4.0
    # 文档: https://doc.302.ai/420136727e0
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
