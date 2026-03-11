"""Video Provider 模块

提供视频生成服务，支持多种视频生成模型。

可用提供商:
    - 302.AI Kling 可灵（图生视频）

示例:
    >>> from src.backend.providers.video import ai302_kling
    >>> provider = ai302_kling.ai302_kling_provider
    >>> if provider.is_available():
    ...     video = provider.generate(
    ...         "让画面动起来，展现微妙的动态",
    ...         images=["https://example.com/image.jpg"]
    ...     )
"""

from .base import BaseVideoProvider
from .ai302_kling import AI302KlingProvider, ai302_kling_provider

__all__ = [
    "BaseVideoProvider",
    "AI302KlingProvider",
    "ai302_kling_provider",
]
