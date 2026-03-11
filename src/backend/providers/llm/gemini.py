"""Google Gemini LLM 提供商

支持 Gemini 系列模型，通过 Google AI SDK 直连。

支持的 LLM 模型:
    - gemini-3.1-flash-lite-preview    # 多模态 LLM（默认）

支持的图片模型（见 image/gemini.py）:
    - gemini-3.1-flash-image-preview   # Nano Banana 2
    - gemini-3-pro-image-preview       # Nano Banana Pro
    - imagen-4.0-generate-001          # Imagen 4.0
    - gemini-3.1-flash-lite-preview    # 多模态 LLM

注意:
    - 支持 thinking_level 的模型: gemini-3 系列
    - 也可使用 gemini-2.5-flash 等其他模型
"""

from src.backend.config import config
from src.backend.logger import logger
from ..param_spec import ParamSpec
from .base import BaseLLMProvider


class GeminiProvider(BaseLLMProvider):
    """Google Gemini LLM 提供商

    支持 Gemini 2.5、Gemini 3 等系列模型。

    特性:
        - 支持深度思考模式 (thinking_level)
        - 使用 google-genai SDK
        - 自动错误处理和日志记录
        - 不支持 thinking 的模型会自动回退到普通模式

    环境变量:
        GEMINI_API_KEY: Google API 密钥（必需）
        GEMINI_MODEL_NAME: 模型名称（默认: gemini-3.1-pro-preview）

    示例:
        >>> provider = GeminiProvider()
        >>> if provider.is_available():
        ...     response = provider.generate("用一句话解释量子计算")
    """

    # generate 方法参数规范
    GENERATE_PARAMS = (
        ParamSpec(
            name="thinking_level",
            type=str,
            exposed=True,
            default=None,
            description="思考级别，仅 gemini-3 系列模型支持",
            choices=["minimal", "low", "medium", "high"],
            required=False,
        ),
        ParamSpec(
            name="temperature",
            type=float,
            exposed=False,
            default=1.0,
            description="控制输出的随机性，范围 0.0-2.0",
            choices=None,
            required=False,
        ),
        ParamSpec(
            name="max_tokens",
            type=int,
            exposed=False,
            default=65536,
            description="最大输出 tokens 数",
            choices=None,
            required=False,
        ),
    )

    def __init__(self):
        super().__init__(config.GEMINI_API_KEY, config.GEMINI_MODEL_NAME)

        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                self._types = genai.types
                logger.info(f"GeminiProvider initialized with model: {self.model_name}")
            except ImportError:
                logger.debug("google-genai package is not installed. Run: pip install google-genai")
            except Exception as e:
                logger.debug(f"Failed to initialize Gemini client: {e}")
                self.client = None

    def generate(
        self,
        prompt: str,
        thinking_level: str | None = None,
        temperature: float = 1.0,
        max_tokens: int = 65536,
    ) -> str:
        """使用配置的 Gemini 模型生成内容

        Args:
            prompt: 输入提示词
            thinking_level: 思考级别 ("minimal", "low", "medium", "high")，None 表示禁用
            temperature: 控制输出的随机性 (0.0-2.0)，建议保留默认值 1.0
            max_tokens: 最大输出 tokens 数

        Returns:
            str: 生成的文本内容，如果出错则返回错误信息字符串

        Note:
            thinking_level 仅部分模型支持（如 gemini-3.1-pro-preview）。
            不支持的模型会自动回退到普通模式。
        """
        if not self.client:
            logger.warning("GeminiProvider client not available - check GEMINI_API_KEY configuration")
            return "Error: LLM configuration missing."

        try:
            logger.info(f"Generating content for prompt: {prompt[:50]}...")

            # 构建基础配置
            config_kwargs = {
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }

            # 添加思考配置（如果指定）
            if thinking_level is not None:
                config_kwargs["thinking_config"] = self._types.ThinkingConfig(
                    thinking_level=thinking_level.upper()
                )

            config_obj = self._types.GenerateContentConfig(**config_kwargs)

            # 发起请求
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config_obj,
            )

            # 提取响应文本
            if response.text:
                logger.info(f"Response: {response.text[:200]}...")
                return response.text
            else:
                logger.warning("Empty response from Gemini.")
                return ""

        except Exception as e:
            # 如果是思考配置不支持的错误，尝试不使用思考配置重试
            if "Thinking level is not supported" in str(e) or "thinking" in str(e).lower():
                logger.debug(f"Thinking config not supported, retrying without: {e}")
                try:
                    config_obj = self._types.GenerateContentConfig(
                        temperature=temperature,
                        max_output_tokens=max_tokens,
                    )
                    response = self.client.models.generate_content(
                        model=self.model_name,
                        contents=prompt,
                        config=config_obj,
                    )
                    if response.text:
                        logger.info(f"Response (no thinking): {response.text[:200]}...")
                        return response.text
                    return ""
                except Exception as retry_e:
                    logger.error(f"Error during retry: {retry_e}")
                    return f"Error generating content: {str(retry_e)}"

            logger.error(f"Error during generation: {e}")
            return f"Error generating content: {str(e)}"


# 单例实例
gemini_provider: GeminiProvider = GeminiProvider()
