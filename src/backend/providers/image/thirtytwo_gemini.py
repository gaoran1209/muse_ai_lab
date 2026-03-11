"""302.AI Gemini 图片生成提供商

通过 302.AI 的 OpenAI 兼容 Chat Completions API 调用 Gemini 图片生成模型。

API 文档: https://302ai.apifox.cn/343209599e0
API 端点: https://api.302.ai/v1/chat/completions

支持模型:
    - gemini-3.1-flash-image-preview   # Nano Banana 2（性价比高）
    - gemini-3-pro-image-preview       # Nano Banana Pro（更高质量）
    - gemini-3.1-flash-lite-preview    # 多模态 LLM

环境变量:
    THIRTYTWO_API_KEY: 302.AI API 密钥
"""

import base64
import re

from src.backend.config import config
from src.backend.logger import logger
from ..param_spec import ParamSpec
from .base import BaseImageProvider


class ThirtyTwoGeminiImageProvider(BaseImageProvider):
    """302.AI Gemini 图片生成提供商

    通过 OpenAI 兼容的 Chat Completions API 调用 Gemini 图片生成模型。

    特性:
        - 使用 OpenAI SDK，兼容性好
        - 支持文生图（text-to-image）
        - 支持图生图（image-to-image，通过多模态消息）
        - 支持多种 Gemini 图片模型
    """

    DEFAULT_MODEL = "gemini-3.1-flash-image-preview"
    SUPPORTED_MODELS = (
        "gemini-3.1-flash-image-preview",
        "gemini-3-pro-image-preview",
        "gemini-3.1-flash-lite-preview",
    )

    API_BASE_URL = "https://api.302.ai/v1"

    GENERATE_PARAMS = (
        ParamSpec(
            name="images",
            type=list[str],
            exposed=True,
            default=None,
            description="参考图片 URL 列表，用于图生图功能",
            choices=None,
            required=False,
        ),
        ParamSpec(
            name="model_name",
            type=str,
            exposed=True,
            default=DEFAULT_MODEL,
            description="模型",
            choices=list(SUPPORTED_MODELS),
            required=False,
        ),
        ParamSpec(
            name="aspect_ratio",
            type=str,
            exposed=True,
            default="3:4",
            description="宽高比",
            choices=["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2"],
            required=False,
        ),
    )

    def __init__(self):
        super().__init__(
            api_key=config.THIRTYTWO_API_KEY or "",
            model_name=self.DEFAULT_MODEL,
        )

        if self.api_key:
            try:
                from openai import OpenAI

                self.client = OpenAI(
                    api_key=self.api_key,
                    base_url=self.API_BASE_URL,
                )
                logger.info(
                    "ThirtyTwoGeminiImageProvider initialized with model: %s",
                    self.model_name,
                )
            except ImportError:
                logger.debug("openai package is not installed. Run: pip install openai")
            except Exception as exc:
                logger.debug("Failed to initialize ThirtyTwoGeminiImage client: %s", exc)
                self.client = None

    @staticmethod
    def _build_aspect_ratio_instruction(aspect_ratio: str) -> str:
        """构建宽高比提示词片段"""
        if aspect_ratio and aspect_ratio != "1:1":
            return f" Generate the image with aspect ratio {aspect_ratio}."
        return ""

    @staticmethod
    def _extract_image_base64(content: str) -> bytes:
        """从响应内容中提取图片的 base64 数据并解码为 bytes。

        支持以下格式:
            - data:image/...;base64,<data>
            - 纯 base64 字符串（无前缀）
        """
        # 匹配 data URI 格式
        match = re.search(r"data:image/[^;]+;base64,([A-Za-z0-9+/=\s]+)", content)
        if match:
            return base64.b64decode(match.group(1))

        # 尝试直接作为 base64 解码（去掉非 base64 字符）
        cleaned = re.sub(r"[^A-Za-z0-9+/=]", "", content)
        if len(cleaned) > 100:  # 合理的图片 base64 至少几百字符
            try:
                return base64.b64decode(cleaned)
            except Exception:
                pass

        raise RuntimeError("Unable to extract image data from response content")

    def generate(
        self,
        prompt: str,
        images: list[str] | None = None,
        model_name: str | None = None,
        aspect_ratio: str = "3:4",
        **kwargs,
    ) -> bytes:
        """生成图片

        Args:
            prompt: 图片描述提示词（必填）
            images: 参考图片 URL 列表，用于图生图功能
            model_name: 模型名称
            aspect_ratio: 宽高比
            **kwargs: 其他参数

        Returns:
            bytes: 图片二进制数据

        Raises:
            ValueError: 客户端不可用
            RuntimeError: API 请求失败或无法提取图片数据
        """
        if not self.is_available():
            raise ValueError(
                "ThirtyTwoGeminiImageProvider not available - check THIRTYTWO_API_KEY"
            )

        selected_model = model_name or self.model_name or self.DEFAULT_MODEL

        # 构建提示词（附加宽高比指令）
        full_prompt = prompt + self._build_aspect_ratio_instruction(aspect_ratio)

        logger.info(
            "Generating image via 302AI Gemini with model=%s mode=%s prompt=%s",
            selected_model,
            "image-to-image" if images else "text-to-image",
            prompt[:80],
        )

        # 构建消息
        messages = self._build_messages(full_prompt, images)

        try:
            response = self.client.chat.completions.create(
                model=selected_model,
                messages=messages,
            )

            return self._parse_image_response(response)

        except Exception as exc:
            logger.error("302AI Gemini image generation failed: %s", exc)
            raise RuntimeError(f"302AI Gemini image generation failed: {exc}") from exc

    def _build_messages(
        self, prompt: str, images: list[str] | None
    ) -> list[dict]:
        """构建 Chat Completions 消息列表。

        Args:
            prompt: 提示词
            images: 参考图片 URL 列表

        Returns:
            OpenAI 格式的消息列表
        """
        if not images:
            return [{"role": "user", "content": prompt}]

        # 图生图：构建多模态消息
        content_parts: list[dict] = []
        for image_url in images:
            content_parts.append(
                {
                    "type": "image_url",
                    "image_url": {"url": image_url},
                }
            )
        content_parts.append({"type": "text", "text": prompt})

        return [{"role": "user", "content": content_parts}]

    def _parse_image_response(self, response) -> bytes:
        """解析 Chat Completions 响应，提取图片数据。

        支持多种返回格式:
            1. 响应 content 中包含 data URI (data:image/...;base64,...)
            2. 响应 content 中包含纯 base64 字符串
            3. 响应 content parts 中包含 inline_data
        """
        if not response.choices:
            raise RuntimeError("Empty response from 302AI Gemini")

        message = response.choices[0].message

        # 处理 content 为字符串的情况
        if isinstance(message.content, str):
            return self._extract_image_base64(message.content)

        # 处理 content 为列表的情况（多模态响应）
        if isinstance(message.content, list):
            for part in message.content:
                if isinstance(part, dict):
                    # 检查 inline_data 格式
                    inline_data = part.get("inline_data")
                    if inline_data and inline_data.get("data"):
                        return base64.b64decode(inline_data["data"])
                    # 检查 image_url 格式
                    image_url = part.get("image_url", {})
                    url = image_url.get("url", "")
                    if url.startswith("data:image/"):
                        return self._extract_image_base64(url)
                    # 检查 text 中是否包含 base64
                    text = part.get("text", "")
                    if text and "base64" in text:
                        return self._extract_image_base64(text)

        raise RuntimeError(
            "Unable to extract image from 302AI Gemini response"
        )


# 单例实例
thirtytwo_gemini_image_provider: ThirtyTwoGeminiImageProvider = (
    ThirtyTwoGeminiImageProvider()
)
