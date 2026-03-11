"""AI302KlingProvider generate 函数测试

需要配置 AI302_API_KEY 环境变量才能运行。
"""

import os
from datetime import datetime
from pathlib import Path

import pytest

from src.backend.providers.video.ai302_kling import AI302KlingProvider
from src.backend.logger import logger

# 输出目录
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def save_video(video_data: bytes, prefix: str) -> Path:
    """保存视频到输出目录"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{prefix}_{timestamp}.mp4"
    filepath = OUTPUT_DIR / filename

    with open(filepath, "wb") as f:
        f.write(video_data)

    logger.info(f"[VIDEO SAVED] {filepath}")
    return filepath


# 测试图片 URL
TEST_IMAGE_URL = "https://common-oss-cdn.tiangong.tech/application-data/prod/2025-12-16/tiangong_ea8ac72e6cf142669421d85ab9bdcc9.png"
TEST_IMAGE_URL_2 = "https://jv-comfyui-image.tiangong.tech/dify_upload/dify_upload_1767515452_233867f6-ec5d-474d-8cb5-e426c0b62767.png"


@pytest.mark.skipif(
    not os.getenv("AI302_API_KEY"),
    reason="需要配置 AI302_API_KEY"
)
class TestThirtyTwoKlingGenerate:
    """测试 generate 函数"""

    def test_generate_prompt_only_sync(self):
        """测试文生视频（同步模式，等待结果）"""
        model_name = "kling-v2-5-turbo"
        provider = AI302KlingProvider()
        provider.model_name = model_name
        prompt = "一只可爱的小鸟在树枝上唱歌，阳光透过树叶洒下"

        logger.info(f"[VIDEO INPUT] Model: {provider.model_name}, Prompt: {prompt}")

        video_data = provider.generate(
            prompt,
            duration=5,
            aspect_ratio="16:9",
            wait_for_result=True
        )

        logger.info(f"[VIDEO OUTPUT] Generated video size: {len(video_data)} bytes")

        save_video(video_data, "kling_text2video")

        assert video_data
        assert isinstance(video_data, bytes)
        assert len(video_data) > 10000

    def test_generate_with_first_frame(self):
        """测试图生视频：提示词 + 首帧图（单图生成视频）"""
        model_name = "kling-v2-5-turbo"
        provider = AI302KlingProvider()
        provider.model_name = model_name
        prompt = "让画面动起来，展现微妙的动态，猫咪轻轻摇动尾巴"
        images = TEST_IMAGE_URL

        logger.info(f"[VIDEO INPUT] Model: {provider.model_name}, Prompt: {prompt}, Image: {images}")

        video_data = provider.generate(
            prompt,
            images=images,
            duration=5,
            aspect_ratio="16:9"
        )

        logger.info(f"[VIDEO OUTPUT] Generated video size: {len(video_data)} bytes")

        save_video(video_data, "kling_first_frame")

        assert video_data
        assert isinstance(video_data, bytes)
        assert len(video_data) > 10000

    def test_generate_with_first_and_last_frames(self):
        """测试图生视频：提示词 + 首尾帧图（多图生成视频）"""
        model_name = "kling-v2-5-turbo"
        provider = AI302KlingProvider()
        provider.model_name = model_name
        prompt = "从第一帧的场景过渡到第二帧的场景，展现平滑的转场效果"
        images = [TEST_IMAGE_URL, TEST_IMAGE_URL_2]

        logger.info(f"[VIDEO INPUT] Model: {provider.model_name}, Prompt: {prompt}, Images count: {len(images)}")

        video_data = provider.generate(
            prompt,
            images=images,
            duration=5,
            aspect_ratio="16:9"
        )

        logger.info(f"[VIDEO OUTPUT] Generated video size: {len(video_data)} bytes")

        save_video(video_data, "kling_first_last_frames")

        assert video_data
        assert isinstance(video_data, bytes)
        assert len(video_data) > 10000
