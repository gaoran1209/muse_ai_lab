"""AI302NanoBananaProvider generate 函数测试

需要配置 AI302_API_KEY 环境变量才能运行。
"""

import os
from datetime import datetime
from pathlib import Path

import pytest

from src.backend.providers.image.ai302_nano_banana import AI302NanoBananaProvider
from src.backend.logger import logger

# 输出目录
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def save_image(image_data: bytes, prefix: str) -> Path:
    """保存图片到输出目录"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{prefix}_{timestamp}.png"
    filepath = OUTPUT_DIR / filename

    with open(filepath, "wb") as f:
        f.write(image_data)

    logger.info(f"[IMAGE SAVED] {filepath}")
    return filepath


@pytest.mark.skipif(
    not os.getenv("AI302_API_KEY"),
    reason="需要配置 AI302_API_KEY"
)
class TestThirtyTwoNanoBananaGenerate:
    """测试 generate 函数"""

    def test_generate_text_to_image_default_params(self):
        """测试文生图：仅使用提示词，其他参数使用默认值"""
        model_name = "google/nano-banana-2"
        provider = AI302NanoBananaProvider()
        provider.model_name = model_name
        prompt = "一只可爱的橘猫坐在窗台上，阳光洒在它身上"

        logger.info(f"[IMAGE INPUT] Model: {provider.model_name}, Prompt: {prompt}")
        image_data = provider.generate(prompt)
        logger.info(f"[IMAGE OUTPUT] Generated image size: {len(image_data)} bytes")

        save_image(image_data, "banana_text_to_image")

        assert image_data
        assert isinstance(image_data, bytes)
        assert len(image_data) > 1000

    def test_generate_with_single_image(self):
        """测试图生图：提示词 + 单张图片，其他参数使用默认值"""
        model_name = "google/nano-banana-2"
        provider = AI302NanoBananaProvider()
        provider.model_name = model_name
        prompt = "变成卡通风格"
        images = ["https://common-oss-cdn.tiangong.tech/application-data/prod/2025-12-16/tiangong_ea8ac72e6cf142669421d85ab9bdcc9.png"]

        logger.info(f"[IMAGE INPUT] Model: {provider.model_name}, Prompt: {prompt}, Images: {images}")
        image_data = provider.generate(prompt, images=images)
        logger.info(f"[IMAGE OUTPUT] Generated image size: {len(image_data)} bytes")

        save_image(image_data, "banana_single_image_to_image")

        assert image_data
        assert isinstance(image_data, bytes)
        assert len(image_data) > 1000

    def test_generate_with_multiple_images(self):
        """测试图生图：提示词 + 多张图片，其他参数使用默认值"""
        model_name = "google/nano-banana-2"
        provider = AI302NanoBananaProvider()
        provider.model_name = model_name
        prompt = "融合这两张图片的风格"
        images = [
            "https://common-oss-cdn.tiangong.tech/application-data/prod/2025-12-16/tiangong_ea8ac72e6cf142669421d85ab9bdcc9.png",
            "https://jv-comfyui-image.tiangong.tech/dify_upload/dify_upload_1767515452_233867f6-ec5d-474d-8cb5-e426c0b62767.png"
        ]

        logger.info(f"[IMAGE INPUT] Model: {provider.model_name}, Prompt: {prompt}, Images count: {len(images)}")
        image_data = provider.generate(prompt, images=images)
        logger.info(f"[IMAGE OUTPUT] Generated image size: {len(image_data)} bytes")

        save_image(image_data, "banana_multiple_images_to_image")

        assert image_data
        assert isinstance(image_data, bytes)
        assert len(image_data) > 1000
