"""302.AI Kling 可灵视频生成提供商

使用 302.AI 的 Kling 可灵模型生成视频（支持文生视频和图生视频）。

API 文档:
    - 文生视频提交: https://doc.302.ai/305339559e0
    - 文生视频获取结果: https://doc.302.ai/305524734e0
    - 图生视频提交: https://doc.302.ai/305333480e0
    - 图生视频获取结果: https://doc.302.ai/305527618e0

价格:
    1 积分 = 0.15 PTC
    详细价格: https://app.klingai.com/cn/dev/document-api/productBilling/prePaidResourcePackage

环境变量:
    THIRTYTWO_KLING_API_KEY: 302.AI Kling API 密钥（优先）
    THIRTYTWO_API_KEY: 302.AI 通用 API 密钥（备选）
    THIRTYTWO_VIDEO_MODEL: 视频生成模型名称

可用模型:
    Kling 系列:
        - kling-v1-6          # Kling 1.6 标准版
        - kling-v1-6-hq       # Kling 1.6 高清版
        - kling-v2-0          # Kling 2.0 高清版
        - kling-v2-1          # Kling 2.1 高清版
        - kling-v2-1-master   # Kling 2.1 大师版
        - kling-v2-5-turbo    # Kling 2.5 Turbo（快速版）

示例:
    >>> provider = ThirtyTwoKlingProvider()
    >>> if provider.is_available():
    ...     # 文生视频（仅提示词）
    ...     video = provider.generate("在海滩上度假的快乐场景")
    ...     # 图生视频（提示词 + 图片）
    ...     video = provider.generate("让画面动起来", images="https://example.com/image.jpg")
"""

import time
from typing import Any

import requests
from src.backend.config import config
from src.backend.logger import logger
from ..param_spec import ParamSpec
from .base import BaseVideoProvider


class ThirtyTwoKlingProvider(BaseVideoProvider):
    """302.AI Kling 可灵视频生成提供商

    使用 302.AI 的 Kling 可灵模型生成视频。

    特性:
        - 支持文生视频（text-to-video）
        - 支持图生视频（image-to-video）
        - 支持多图参考
        - 支持 5秒/10秒 时长
        - 支持多种宽高比
        - 异步任务模式，支持轮询获取结果

    Attributes:
        default_duration: 默认视频时长（秒）
        default_aspect_ratio: 默认宽高比
        default_mode: 默认模式（图生视频）
        polling_interval: 轮询间隔（秒）
        max_polling_time: 最大轮询时间（秒）

    可用模型:
        Kling 系列:
            文生视频支持:
                - kling-v1-6           # Kling 1.6 标准版
                - kling-v1-6-hq        # Kling 1.6 高清版
                - kling-v2-0           # Kling 2.0 高清版
                - kling-v2-1           # Kling 2.1 高清版
                - kling-v2-1-master    # Kling 2.1 大师版
                - kling-v2-5-turbo     # Kling 2.5 Turbo（快速版，仅文生视频）
            图生视频支持:
                - kling-v1-6           # Kling 1.6 标准版
                - kling-v1-6-hq        # Kling 1.6 高清版
                - kling-v2-0           # Kling 2.0 高清版
                - kling-v2-1           # Kling 2.1 高清版
    """

    API_BASE_TEXT2VIDEO = "https://api.302.ai/klingai/v1/videos/text2video"
    API_BASE_IMAGE2VIDEO = "https://api.302.ai/klingai/v1/videos/image2video"
    FETCH_API_BASE_TEXT2VIDEO = "https://api.302.ai/klingai/v1/videos/text2video"
    FETCH_API_BASE_IMAGE2VIDEO = "https://api.302.ai/klingai/v1/videos/image2video"

    # generate 方法参数规范
    GENERATE_PARAMS = (
        ParamSpec(
            name="images",
            type=str | list[str],
            exposed=True,
            default=None,
            description="参考图片 URL，支持单个 URL 字符串或 URL 列表。不提供时使用文生视频模式",
            choices=None,
            required=False,
        ),
        ParamSpec(
            name="model_name",
            type=str,
            exposed=True,
            default=None,
            description="模型名称，允许前端按需切换可灵模型版本",
            choices=None,
            required=False,
        ),
        ParamSpec(
            name="mode",
            type=str,
            exposed=True,
            default="std",
            description="生成模式，仅图生视频有效",
            choices=["std", "pro"],
            required=False,
        ),
        ParamSpec(
            name="aspect_ratio",
            type=str,
            exposed=True,
            default="9:16",
            description="宽高比",
            choices=["16:9", "9:16", "1:1"],
            required=False,
        ),
        ParamSpec(
            name="duration",
            type=int,
            exposed=True,
            default=5,
            description="视频时长（秒）",
            choices=[5, 10],
            required=False,
        ),
        ParamSpec(
            name="wait_for_result",
            type=bool,
            exposed=False,
            default=True,
            description="是否等待任务完成并返回视频数据，内部使用",
            choices=None,
            required=False,
        ),
    )

    def __init__(self):
        super().__init__(
            api_key=config.THIRTYTWO_API_KEY or "",
            model_name=config.THIRTYTWO_VIDEO_MODEL
        )
        self.default_duration = 5
        self.default_aspect_ratio = "16:9"
        self.default_mode = "std"
        self.polling_interval = 5  # 轮询间隔（秒）
        self.max_polling_time = 1000  # 最大轮询时间（秒）

        if self.api_key:
            self.client = True
            logger.info(f"ThirtyTwoKlingProvider initialized with model: {self.model_name}")
        else:
            self.client = None
            logger.debug("ThirtyTwoKlingProvider not initialized - THIRTYTWO_KLING_API_KEY or THIRTYTWO_API_KEY not configured")

    def generate(
        self,
        prompt: str,
        images: list[str] | str | None = None,
        model_name: str | None = None,
        mode: str = "std",
        aspect_ratio: str = "9:16",
        duration: int = 5,
        wait_for_result: bool = True,
        **kwargs
    ) -> bytes:
        """生成视频

        支持两种模式:
        1. 文生视频: 仅提供 prompt，不提供 images
        2. 图生视频: 提供 prompt 和 images

        Args:
            prompt: 视频描述提示词（必填）
            images: 参考图片 URL，支持单个 URL 字符串或 URL 列表（可选）
                   不提供时使用文生视频模式
            model_name: 模型名称，默认使用初始化时的模型
            mode: 生成模式，可选值: "std"（标准）, "pro"（高清），仅图生视频有效
            aspect_ratio: 宽高比，可选值: "16:9", "9:16", "1:1"
            duration: 视频时长（秒），可选值: 5, 10
            wait_for_result: 是否等待任务完成并返回视频数据
                           True: 等待完成后返回视频二进制数据
                           False: 立即返回任务信息字典
            **kwargs: 其他厂商特定参数（如 camera_control_enabled, camera_json 等）

        Returns:
            bytes: 视频二进制数据（当 wait_for_result=True 时）
            dict: 任务信息（当 wait_for_result=False 时）

        Raises:
            ValueError: API 密钥未配置或参数无效
            RuntimeError: API 请求失败或任务执行失败

        示例:
            >>> provider = ThirtyTwoKlingProvider()
            >>> # 文生视频
            >>> video = provider.generate("在海滩上度假的快乐场景")
            >>> # 图生视频（单图）
            >>> video = provider.generate(
            ...     "让画面动起来，展现微妙的动态",
            ...     images="https://example.com/image.jpg"
            ... )
            >>> # 图生视频（多图）
            >>> task = provider.generate(
            ...     "壮观的山脉景色，云雾缭绕",
            ...     images=["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
            ...     wait_for_result=False
            ... )
        """
        if not self.is_available():
            raise ValueError("ThirtyTwoKlingProvider not available - check THIRTYTWO_KLING_API_KEY or THIRTYTWO_API_KEY")

        # 参数验证
        if not prompt:
            raise ValueError("prompt is required")

        if duration not in (5, 10):
            raise ValueError("duration must be 5 or 10")

        if aspect_ratio not in ("16:9", "9:16", "1:1"):
            raise ValueError("aspect_ratio must be one of: '16:9', '9:16', '1:1'")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # 确定使用的模型
        # kling-v2-5-turbo 不支持图生视频，需要使用兼容的模型
        selected_model = model_name or self.model_name
        if images and selected_model in ("kling-v2-5-turbo", "kling-v2-1-master"):
            # 图生视频时，自动切换到兼容的模型
            selected_model = "kling-v1-6"
            logger.info(f"Model {model_name or self.model_name} not supported for image2video, using kling-v1-6 instead")

        # 判断是文生视频还是图生视频
        if images:
            # 图生视频模式
            # 处理 images 参数
            image_list = []
            if isinstance(images, str):
                image_list = [{"image": images}]
            elif isinstance(images, list):
                image_list = [{"image": img} for img in images]
            else:
                raise ValueError("images must be a string URL or a list of URLs")

            api_base = self.API_BASE_IMAGE2VIDEO
            payload = {
                "model_name": selected_model,
                "image_list": image_list,
                "mode": mode or self.default_mode,
                "prompt": prompt,
                "aspect_ratio": aspect_ratio or self.default_aspect_ratio,
                "duration": duration,
            }
        else:
            # 文生视频模式
            api_base = self.API_BASE_TEXT2VIDEO
            payload = {
                "prompt": prompt,
                "model_name": selected_model,
                "aspect_ratio": aspect_ratio or self.default_aspect_ratio,
                "duration": duration,
            }

        # 添加额外的参数
        payload.update(kwargs)

        # 确定模式（用于日志）
        mode_str = "text2video" if not images else "image2video"

        try:
            logger.info(f"Submitting Kling video generation task ({mode_str}) with prompt: {prompt[:50]}...")

            response = requests.post(
                api_base,
                headers=headers,
                json=payload,
                timeout=60
            )
            response.raise_for_status()

            data = response.json()
            logger.debug(f"API response: {data}")

            # 检查响应是否成功
            # API 返回格式: {"status": 200, "result": 1, "data": {...}, "message": "成功"}
            is_success = (
                data.get("status") == 200 or
                data.get("result") == 1 or
                response.status_code == 200
            )

            if is_success:
                task_data = data.get("data", {})

                # 处理不同的响应格式
                # text2video: data.task_id (直接在 data 下)
                # image2video: data.task.id (在 task 对象下)
                task_id = (
                    task_data.get("task_id") or
                    task_data.get("task", {}).get("id")
                )

                # 获取任务状态
                task_status = (
                    task_data.get("task_status") or
                    task_data.get("task", {}).get("status")
                )

                # 获取完整任务信息
                task_info = task_data.get("task") or task_data

                if not task_id:
                    logger.error(f"API response: {data}")
                    raise RuntimeError("No task ID in response")

                logger.info(f"Kling video task submitted successfully: {task_id}")

                if not wait_for_result:
                    # 返回任务信息
                    return {
                        "task_id": task_id,
                        "status": task_status,
                        "task_info": task_info
                    }

                # 轮询等待任务完成，根据模式选择正确的 fetch 端点
                is_text2video = not bool(images)
                return self._fetch_video_result(task_id, is_text2video=is_text2video)

            else:
                error_msg = data.get("message", "Unknown error")
                logger.debug(f"API error response: {data}")
                raise RuntimeError(f"API error: {error_msg}")

        except requests.RequestException as e:
            logger.error(f"HTTP error during video generation: {e}")
            raise RuntimeError(f"HTTP error: {e}") from e
        except Exception as e:
            logger.error(f"Error during video generation: {e}")
            raise RuntimeError(f"Error generating video: {e}") from e

    def _fetch_video_result(self, task_id: str, is_text2video: bool = True) -> bytes:
        """获取视频生成结果

        Args:
            task_id: 任务 ID
            is_text2video: 是否为文生视频模式（True）或图生视频模式（False）

        Returns:
            bytes: 视频二进制数据

        Raises:
            RuntimeError: 获取结果失败或超时
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }

        # 根据模式选择正确的 fetch 端点
        fetch_api_base = (
            self.FETCH_API_BASE_TEXT2VIDEO if is_text2video
            else self.FETCH_API_BASE_IMAGE2VIDEO
        )

        start_time = time.time()

        try:
            while True:
                elapsed = time.time() - start_time
                if elapsed > self.max_polling_time:
                    raise RuntimeError(f"Video generation timeout after {self.max_polling_time} seconds")

                logger.debug(f"Polling task status: {task_id} (elapsed: {int(elapsed)}s)")

                response = requests.get(
                    f"{fetch_api_base}/{task_id}",
                    headers=headers,
                    timeout=600
                )
                response.raise_for_status()

                data = response.json()

                # 检查响应是否成功
                # API 返回格式: {"code": 0, "data": {...}, "message": "SUCCEED"}
                is_success = (
                    data.get("code") == 0 or
                    data.get("status") == 200 or
                    data.get("result") == 1 or
                    response.status_code == 200
                )

                if is_success:
                    task_data = data.get("data", {})

                    # 处理响应格式
                    # 官方 API: data.task_status (字符串: "processing", "succeed", "failed")
                    task_status = task_data.get("task_status")

                    logger.debug(f"Task status: {task_status}")

                    # 任务成功 (官方 API 使用 "succeed" 而非 "succeeded")
                    if task_status == "succeed":
                        task_result = task_data.get("task_result", {})

                        # 视频在 task_result.videos 数组中
                        videos = task_result.get("videos", [])
                        if videos and isinstance(videos, list):
                            video_url = videos[0].get("url")
                            if video_url:
                                logger.info(f"Video generated successfully: {video_url}")

                                # 下载视频并返回二进制数据
                                video_response = requests.get(video_url, timeout=120)
                                video_response.raise_for_status()
                                return video_response.content

                        raise RuntimeError("No video URL in completed task")

                    elif task_status == "processing":
                        # 任务处理中，继续轮询
                        time.sleep(self.polling_interval)
                        continue

                    elif task_status == "failed":
                        error_msg = (
                            task_data.get("task_status_msg") or
                            "Unknown error"
                        )
                        raise RuntimeError(f"Video generation failed: {error_msg}")

                # 响应状态异常，继续重试
                time.sleep(self.polling_interval)

        except requests.RequestException as e:
            logger.error(f"HTTP error while fetching video result: {e}")
            raise RuntimeError(f"HTTP error: {e}") from e

    def fetch_task(self, task_id: str, is_text2video: bool = True) -> dict[str, Any]:
        """获取任务状态

        Args:
            task_id: 任务 ID
            is_text2video: 是否为文生视频模式（True）或图生视频模式（False）

        Returns:
            dict: 任务状态信息
        """
        if not self.is_available():
            raise ValueError("ThirtyTwoKlingProvider not available")

        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }

        # 根据模式选择正确的 fetch 端点
        fetch_api_base = (
            self.FETCH_API_BASE_TEXT2VIDEO if is_text2video
            else self.FETCH_API_BASE_IMAGE2VIDEO
        )

        try:
            response = requests.get(
                f"{fetch_api_base}/{task_id}",
                headers=headers,
                timeout=30
            )
            response.raise_for_status()

            data = response.json()
            return data.get("data", {})

        except requests.RequestException as e:
            logger.error(f"HTTP error while fetching task: {e}")
            raise RuntimeError(f"HTTP error: {e}") from e


# 单例实例
thirtytwo_kling_provider: ThirtyTwoKlingProvider = ThirtyTwoKlingProvider()
