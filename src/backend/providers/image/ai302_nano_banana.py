"""302.AI Nano-Banana 图片生成提供商

使用 302.AI 的 Google Nano-Banana-2 模型生成图片。

API 文档:
    - 文生图: https://doc.302.ai/420136730e0
    - 图生图: https://doc.302.ai/420136731e0

价格:
    分辨率1K/2K 0.08 PTC/次
    分辨率4K 0.16 PTC/次

环境变量:
    AI302_GEMINI_IMAGE_API_KEY: 302.AI Gemini 图片 API 密钥（优先）
    AI302_API_KEY: 302.AI 通用 API 密钥（备选）
    AI302_IMAGE_MODEL: 图片生成模型名称

示例:
    >>> provider = AI302NanoBananaProvider()
    >>> if provider.is_available():
    ...     # 文生图
    ...     image = provider.generate("一只可爱的猫咪")
    ...     # 图生图
    ...     image = provider.generate("变成卡通风格", images=["https://example.com/cat.jpg"])
"""

import time
import requests
from src.backend.config import config
from src.backend.logger import logger
from ..param_spec import ParamSpec
from .base import BaseImageProvider


class AI302NanoBananaProvider(BaseImageProvider):
    """302.AI Nano-Banana 图片生成提供商

    使用 302.AI 的图片生成模型生成图片。

    特性:
        - 同步按次收费模式
        - 支持文生图（text-to-image）
        - 支持图生图（image-to-image）
        - 支持 1K/2K/4K 分辨率
        - 支持自定义宽高比
        - 返回图片二进制数据

    Attributes:
        api_base_text_to_image: 文生图 API 端点
        api_base_image_to_image: 图生图 API 端点
        default_resolution: 默认分辨率

    可用模型:
        Google Nano-Banana 系列:
            - google/nano-banana-2           # Nano-Banana-2（默认，性价比高）
            - google/nano-banana-pro         # Nano-Banana-Pro（更高质量）
            - google/nano-banana             # Nano-Banana（轻量版）
    """

    API_BASE_TEXT_TO_IMAGE = "https://api.302.ai/ws/api/v3/google/nano-banana-2/text-to-image"
    API_BASE_IMAGE_TO_IMAGE = "https://api.302.ai/ws/api/v3/google/nano-banana-2/edit"

    # generate 方法参数规范
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
            name="resolution",
            type=str,
            exposed=True,
            default="2k",
            description="图片分辨率",
            choices=["1k", "2k", "4k"],
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
        ParamSpec(
            name="enable_base64_output",
            type=bool,
            exposed=False,
            default=False,
            description="是否返回 base64 编码的图片数据（内部参数）",
            choices=None,
            required=False,
        ),
        ParamSpec(
            name="enable_sync_mode",
            type=bool,
            exposed=False,
            default=True,
            description="是否启用同步模式（内部参数）",
            choices=None,
            required=False,
        ),
    )

    # 超时配置（秒）
    TIMEOUT_TEXT_TO_IMAGE = 120
    TIMEOUT_IMAGE_TO_IMAGE = 300  # 图生图可能需要更长时间
    MAX_RETRIES = 3
    RETRY_DELAY = 2

    def __init__(self):
        super().__init__(
            api_key=config.AI302_API_KEY or "",
            model_name=config.AI302_IMAGE_MODEL
        )
        self.api_base_text_to_image = self.API_BASE_TEXT_TO_IMAGE
        self.api_base_image_to_image = self.API_BASE_IMAGE_TO_IMAGE
        self.default_resolution = "2k"

        if self.api_key:
            self.client = True
            logger.info(f"AI302NanoBananaProvider initialized with model: {self.model_name}")
        else:
            self.client = None
            logger.debug("AI302NanoBananaProvider not initialized - AI302_GEMINI_IMAGE_API_KEY or AI302_API_KEY not configured")

    def generate(
        self,
        prompt: str,
        images: list[str] | None = None,
        resolution: str = "2k",
        aspect_ratio: str = "3:4",
        enable_base64_output: bool = False,
        enable_sync_mode: bool = True,
        **kwargs
    ) -> bytes:
        """生成图片

        Args:
            prompt: 图片描述提示词（必填）
            images: 参考图片 URL 列表，用于图生图功能
                    当提供此参数时，将使用图片编辑接口
            resolution: 图片分辨率，可选值: "1k", "2k", "4k"
            aspect_ratio: 宽高比，如 "3:4", "1:1", "16:9"
            enable_base64_output: 是否返回 base64 编码的图片数据
            enable_sync_mode: 是否启用同步模式
            **kwargs: 其他厂商特定参数

        Returns:
            bytes: 图片二进制数据

        Raises:
            ValueError: API 密钥未配置
            RuntimeError: API 请求失败

        示例:
            >>> provider = AI302NanoBananaProvider()
            >>> # 文生图
            >>> image = provider.generate("一只柯基犬在草地上奔跑")
            >>> # 图生图
            >>> image = provider.generate(
            ...     "变成卡通风格",
            ...     images=["https://example.com/dog.jpg"]
            ... )
        """
        if not self.is_available():
            raise ValueError("AI302NanoBananaProvider not available - check AI302_GEMINI_IMAGE_API_KEY or AI302_API_KEY")

        # 根据是否提供 images 参数选择 API 端点
        if images:
            api_url = self.api_base_image_to_image
        else:
            api_url = self.api_base_text_to_image

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "prompt": prompt,
            "resolution": resolution or self.default_resolution,
            "aspect_ratio": aspect_ratio,
            "enable_base64_output": enable_base64_output,
            "enable_sync_mode": enable_sync_mode,
        }

        # 添加图片参数（图生图）
        if images:
            payload["images"] = images

        # 添加额外的参数
        payload.update(kwargs)

        # 根据模式选择超时时间
        timeout = self.TIMEOUT_IMAGE_TO_IMAGE if images else self.TIMEOUT_TEXT_TO_IMAGE

        # 重试逻辑
        last_error = None
        for attempt in range(self.MAX_RETRIES):
            try:
                logger.info(
                    f"Generating image with prompt: {prompt[:50]}... "
                    f"(mode: {'image-to-image' if images else 'text-to-image'}, "
                    f"attempt: {attempt + 1}/{self.MAX_RETRIES})"
                )

                response = requests.post(
                    api_url,
                    headers=headers,
                    json=payload,
                    timeout=timeout
                )
                response.raise_for_status()

                data = response.json()

                if data.get("code") == 200:
                    outputs = data.get("data", {}).get("outputs", [])
                    if outputs and isinstance(outputs, list):
                        image_url = outputs[0]
                        logger.info(f"Image generated successfully: {image_url}")

                        # 下载图片并返回二进制数据
                        img_response = requests.get(image_url, timeout=60)
                        img_response.raise_for_status()
                        return img_response.content
                    else:
                        raise RuntimeError("No image URL in response")
                else:
                    error_msg = data.get("message", "Unknown error")
                    raise RuntimeError(f"API error: {error_msg}")

            except (requests.Timeout, requests.ConnectionError) as e:
                last_error = e
                if attempt < self.MAX_RETRIES - 1:
                    retry_delay = self.RETRY_DELAY * (attempt + 1)
                    logger.warning(
                        f"Request failed (attempt {attempt + 1}/{self.MAX_RETRIES}): {e}. "
                        f"Retrying in {retry_delay}s..."
                    )
                    time.sleep(retry_delay)
                else:
                    logger.error(f"Max retries reached. Last error: {e}")
            except requests.RequestException as e:
                last_error = e
                logger.error(f"HTTP error during image generation: {e}")
                break

        raise RuntimeError(f"HTTP error after {self.MAX_RETRIES} retries: {last_error}") from last_error


# 单例实例
ai302_nano_banana_provider: AI302NanoBananaProvider = AI302NanoBananaProvider()
