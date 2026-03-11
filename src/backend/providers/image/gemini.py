"""Google Gemini 图片生成提供商。

支持以下模型：
    - gemini-3.1-flash-image-preview
    - gemini-3-pro-image-preview
"""

from __future__ import annotations

import mimetypes
from urllib.parse import urlparse

import requests

from src.backend.config import config
from src.backend.logger import logger

from ..param_spec import ParamSpec
from .base import BaseImageProvider


class GeminiImageProvider(BaseImageProvider):
    """Google Gemini 图片生成提供商。"""

    DEFAULT_MODEL = "imagen-4.0-generate-001"
    SUPPORTED_MODELS = (
        "gemini-3.1-flash-image-preview",
        "gemini-3-pro-image-preview",
        "gemini-3.1-flash-lite-preview",
        "imagen-4.0-fast-generate-001",
        "imagen-4.0-generate-001",
        "imagen-4.0-ultra-generate-001",
    )

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
            name="resolution",
            type=str,
            exposed=True,
            default="2k",
            description="图片分辨率",
            choices=["1k", "2k"],
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
            api_key=config.GEMINI_API_KEY or "",
            model_name=config.GEMINI_IMAGE_MODEL or self.DEFAULT_MODEL,
        )
        self._types = None

        if self.api_key:
            try:
                from google import genai

                self.client = genai.Client(api_key=self.api_key)
                self._types = genai.types
                logger.info("GeminiImageProvider initialized with model: %s", self.model_name)
            except ImportError:
                logger.debug("google-genai package is not installed. Run: pip install google-genai")
            except Exception as exc:
                logger.debug("Failed to initialize Gemini image client: %s", exc)
                self.client = None

    @staticmethod
    def _normalize_mime_type(image_url: str, content_type: str | None) -> str:
        if content_type:
            return content_type.split(";")[0].strip()

        parsed = urlparse(image_url)
        guessed, _ = mimetypes.guess_type(parsed.path)
        return guessed or "image/png"

    def _load_reference_images(self, images: list[str]) -> list[object]:
        if self._types is None:
            raise ValueError("Gemini image types are unavailable")

        reference_images: list[object] = []
        for image_url in images:
            response = requests.get(image_url, timeout=60)
            response.raise_for_status()
            mime_type = self._normalize_mime_type(
                image_url=image_url,
                content_type=response.headers.get("Content-Type"),
            )
            reference_images.append(
                self._types.RawReferenceImage(
                    reference_image=self._types.Image(
                        image_bytes=response.content,
                        mime_type=mime_type,
                    )
                )
            )
        return reference_images

    @staticmethod
    def _normalize_resolution(resolution: str) -> str:
        return (resolution or "2k").upper()

    @staticmethod
    def _extract_image_bytes(response: object) -> bytes:
        generated_images = getattr(response, "generated_images", None) or []
        for generated in generated_images:
            image = getattr(generated, "image", None)
            image_bytes = getattr(image, "image_bytes", None)
            if image_bytes:
                return image_bytes

        reasons = [
            getattr(generated, "rai_filtered_reason", None)
            for generated in generated_images
            if getattr(generated, "rai_filtered_reason", None)
        ]
        if reasons:
            raise RuntimeError(f"Gemini image filtered: {', '.join(reasons)}")

        raise RuntimeError("Gemini image response did not contain image bytes")

    def generate(
        self,
        prompt: str,
        images: list[str] | None = None,
        model_name: str | None = None,
        resolution: str = "2k",
        aspect_ratio: str = "3:4",
        **kwargs,
    ) -> bytes:
        if not self.is_available() or self._types is None:
            raise ValueError("GeminiImageProvider not available - check GEMINI_API_KEY")

        selected_model = model_name or self.model_name or self.DEFAULT_MODEL
        logger.info(
            "Generating Gemini image with model=%s mode=%s prompt=%s",
            selected_model,
            "image-to-image" if images else "text-to-image",
            prompt[:80],
        )

        if images:
            response = self.client.models.edit_image(
                model=selected_model,
                prompt=prompt,
                reference_images=self._load_reference_images(images),
                config=self._types.EditImageConfig(
                    number_of_images=1,
                    aspect_ratio=aspect_ratio,
                    output_mime_type="image/png",
                ),
            )
        else:
            response = self.client.models.generate_images(
                model=selected_model,
                prompt=prompt,
                config=self._types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio=aspect_ratio,
                    image_size=self._normalize_resolution(resolution),
                    output_mime_type="image/png",
                ),
            )

        return self._extract_image_bytes(response)


gemini_image_provider: GeminiImageProvider = GeminiImageProvider()
