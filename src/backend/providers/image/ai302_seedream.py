"""302.AI Seedream 图片生成提供商

使用 302.AI 的 Doubao Seedream 5.0 模型生成图片。

API 文档: https://doc.302.ai/419295548e0

价格: 0.035 PTC/张

环境变量:
    AI302_DOUBAO_API_KEY: 302.AI Doubao API 密钥（优先）
    AI302_API_KEY: 302.AI 通用 API 密钥（备选）
    AI302_DOUBAO_MODEL: Doubao 模型名称

示例:
    >>> provider = AI302SeedreamProvider()
    >>> if provider.is_available():
    ...     # 文生图
    ...     image = provider.generate("一只可爱的猫咪")
    ...     # 图生图（单张）
    ...     image = provider.generate("变成卡通风格", image="https://example.com/cat.jpg")
    ...     # 多图融合
    ...     image = provider.generate(
    ...         "将图1的服装换为图2的服装",
    ...         image=["https://example.com/cat1.jpg", "https://example.com/cat2.jpg"]
    ...     )
"""

import time
import requests
from src.backend.config import config
from src.backend.logger import logger
from ..param_spec import ParamSpec
from .base import BaseImageProvider


class AI302SeedreamProvider(BaseImageProvider):
    """302.AI Seedream 图片生成提供商

    使用 302.AI 的 Doubao Seedream 5.0 模型生成图片。

    特性:
        - 文生图（text-to-image）
        - 图生图（image-to-image）
        - 多图融合（multiple images）
        - 支持多种分辨率和宽高比
        - 返回图片二进制数据

    Attributes:
        api_url: API 端点
        default_model: 默认模型名称

    可用模型:
        - doubao-seedream-5-0-260128  # Seedream 5.0（默认，最新版本）

    支持的宽高比:
        - 1:1   2048x2048  # 正方形
        - 4:3   2304x1728  # 横向标准
        - 3:4   1728x2304  # 纵向标准
        - 16:9  2560x1440  # 横向宽屏
        - 9:16  1440x2560  # 纵向宽屏
        - 3:2   2496x1664  # 横向照片
        - 2:3   1664x2496  # 纵向照片
        - 21:9  3024x1296  # 超宽屏
    """

    API_URL = "https://api.302.ai/doubao/images/generations"
    DEFAULT_MODEL = "doubao-seedream-5-0-260128"

    # generate 方法参数规范
    GENERATE_PARAMS = (
        ParamSpec(
            name="image",
            type=str | list[str],
            exposed=True,
            default=None,
            description="参考图片 URL（单张）或 URL 列表（多张），用于图生图功能",
            choices=None,
            required=False,
        ),
        ParamSpec(
            name="size",
            type=str,
            exposed=False,
            default=None,
            description="图片尺寸（如 '2K'），如果同时指定了 aspect_ratio 则使用 aspect_ratio 对应的分辨率",
            choices=None,
            required=False,
        ),
        ParamSpec(
            name="aspect_ratio",
            type=str,
            exposed=True,
            default="1:1",
            description="宽高比",
            choices=["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
            required=False,
        ),
        ParamSpec(
            name="watermark",
            type=bool,
            exposed=False,
            default=False,
            description="是否添加水印",
            choices=None,
            required=False,
        ),
        ParamSpec(
            name="response_format",
            type=str,
            exposed=False,
            default="url",
            description="返回格式，内部使用",
            choices=["url", "b64_json"],
            required=False,
        ),
        ParamSpec(
            name="model",
            type=str,
            exposed=False,
            default=None,
            description="模型名称，内部使用",
            choices=None,
            required=False,
        ),
    )

    # 超时配置（秒）
    TIMEOUT_TEXT_TO_IMAGE = 120
    TIMEOUT_IMAGE_TO_IMAGE = 300  # 图生图可能需要更长时间
    MAX_RETRIES = 3
    RETRY_DELAY = 2

    # 宽高比到分辨率的映射
    ASPECT_RATIO_MAP = {
        "1:1": "2048x2048",
        "4:3": "2304x1728",
        "3:4": "1728x2304",
        "16:9": "2560x1440",
        "9:16": "1440x2560",
        "3:2": "2496x1664",
        "2:3": "1664x2496",
        "21:9": "3024x1296",
    }

    DEFAULT_ASPECT_RATIO = "1:1"

    def __init__(self):
        super().__init__(
            api_key=config.AI302_API_KEY or "",
            model_name=config.AI302_IMAGE_MODEL
        )
        self.api_url = self.API_URL
        self.default_model = self.model_name

        if self.api_key:
            self.client = True
            logger.info(f"AI302SeedreamProvider initialized with model: {self.default_model}")
        else:
            self.client = None
            logger.debug("AI302SeedreamProvider not initialized - AI302_DOUBAO_API_KEY or AI302_API_KEY not configured")

    def generate(
        self,
        prompt: str,
        image: str | list[str] | None = None,
        size: str | None = None,
        aspect_ratio: str = "1:1",
        watermark: bool = False,
        response_format: str = "url",
        model: str | None = None,
        **kwargs
    ) -> bytes:
        """生成图片

        Args:
            prompt: 图片描述提示词（必填）
            image: 参考图片 URL（单张）或 URL 列表（多张），用于图生图功能
                   - str: 单张图片 URL
                   - list[str]: 多张图片 URL 列表，用于多图融合
            size: 图片尺寸，可选值: "2K" 等（直接传给API）
                  如果同时指定了 aspect_ratio，则使用 aspect_ratio 对应的分辨率
            aspect_ratio: 宽高比，可选值: "1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"
                        默认: "1:1" (2048x2048)
            watermark: 是否添加水印
            response_format: 返回格式，"url" 或 "b64_json"
            model: 模型名称，默认使用 doubao-seedream-5-0-260128
            **kwargs: 其他厂商特定参数（如 sequential_image_generation 等）

        Returns:
            bytes: 图片二进制数据

        Raises:
            ValueError: API 密钥未配置或宽高比不支持
            RuntimeError: API 请求失败

        示例:
            >>> provider = AI302SeedreamProvider()
            >>> # 文生图（默认 1:1）
            >>> image = provider.generate("一只柯基犬在草地上奔跑")
            >>> # 指定宽高比
            >>> image = provider.generate("风景画", aspect_ratio="16:9")
            >>> # 图生图（单张）
            >>> image = provider.generate(
            ...     "变成卡通风格",
            ...     image="https://example.com/dog.jpg",
            ...     aspect_ratio="3:4"
            ... )
            >>> # 多图融合
            >>> image = provider.generate(
            ...     "将图1的服装换为图2的服装",
            ...     image=["https://example.com/img1.jpg", "https://example.com/img2.jpg"]
            ... )
        """
        if not self.is_available():
            raise ValueError("AI302SeedreamProvider not available - check AI302_DOUBAO_API_KEY or AI302_API_KEY")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # 处理尺寸参数：如果未提供 size，则根据 aspect_ratio 获取对应分辨率
        if size is None:
            if aspect_ratio in self.ASPECT_RATIO_MAP:
                size = self.ASPECT_RATIO_MAP[aspect_ratio]
            else:
                supported = ", ".join(f'"{k}"' for k in self.ASPECT_RATIO_MAP.keys())
                raise ValueError(f"Unsupported aspect_ratio: {aspect_ratio}. Supported values: {supported}")

        payload = {
            "model": model or self.default_model,
            "prompt": prompt,
            "size": size,
            "watermark": watermark,
            "response_format": response_format,
        }

        # 添加图片参数（图生图）
        if image:
            payload["image"] = image

        # 添加额外的参数
        payload.update(kwargs)

        # 根据模式选择超时时间
        timeout = self.TIMEOUT_IMAGE_TO_IMAGE if image else self.TIMEOUT_TEXT_TO_IMAGE

        # 重试逻辑
        last_error = None
        for attempt in range(self.MAX_RETRIES):
            try:
                # 确定生成模式
                if image:
                    if isinstance(image, list):
                        mode = f"multiple-images-to-image ({len(image)} images)"
                    else:
                        mode = "image-to-image"
                else:
                    mode = "text-to-image"
                logger.info(
                    f"Generating image with prompt: {prompt[:50]}... "
                    f"(mode: {mode}, attempt: {attempt + 1}/{self.MAX_RETRIES})"
                )

                response = requests.post(
                    self.api_url,
                    headers=headers,
                    json=payload,
                    timeout=timeout
                )
                response.raise_for_status()

                data = response.json()

                # 检查是否有错误
                if "error" in data:
                    error_info = data["error"]
                    error_code = error_info.get("code", "unknown")
                    error_msg = error_info.get("message", "Unknown error")
                    raise RuntimeError(f"API error ({error_code}): {error_msg}")

                # 获取图片数据
                images_data = data.get("data", [])
                if not images_data:
                    raise RuntimeError("No image data in response")

                image_info = images_data[0]

                if response_format == "b64_json":
                    # 返回 base64 编码的图片
                    import base64
                    b64_data = image_info.get("b64_json")
                    if b64_data:
                        return base64.b64decode(b64_data)
                    else:
                        raise RuntimeError("No base64 image data in response")
                else:
                    # 返回 URL 下载的图片
                    image_url = image_info.get("url")
                    if image_url:
                        logger.info(f"Image generated successfully: {image_url}")
                        # 下载图片并返回二进制数据
                        img_response = requests.get(image_url, timeout=60)
                        img_response.raise_for_status()
                        return img_response.content
                    else:
                        raise RuntimeError("No image URL in response")

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
ai302_seedream_provider: AI302SeedreamProvider = AI302SeedreamProvider()
