"""
Provider 服务层

统一封装 LLM/Image/Video Provider 的业务逻辑，提供更高层次的抽象。
"""

import base64
import io
from typing import Any

from src.backend.config import config
from src.backend.providers.llm import (
    BaseLLMProvider,
    gemini_provider,
    ai302_provider,
    zhipu_provider,
)
from src.backend.providers.image import (
    BaseImageProvider,
    gemini_image_provider,
    ai302_gemini_image_provider,
    ai302_nano_banana_provider,
    ai302_seedream_provider,
)
from src.backend.providers.video import (
    BaseVideoProvider,
    ai302_kling_provider,
)


# =============================================================================
# Provider 注册表
# =============================================================================

class ProviderRegistry:
    """Provider 注册表

    管理所有可用的 Provider 实例，提供按类型和厂商查询的能力。
    """

    # LLM Providers
    _llm_providers: dict[str, BaseLLMProvider] = {
        "zhipu": zhipu_provider,
        "gemini": gemini_provider,
        "302ai": ai302_provider,
    }

    # Image Providers
    _image_providers: dict[str, BaseImageProvider] = {
        "gemini": gemini_image_provider,
        "302ai_gemini": ai302_gemini_image_provider,
        "302ai_nano_banana": ai302_nano_banana_provider,
        "302ai_seedream": ai302_seedream_provider,
    }

    # Video Providers
    _video_providers: dict[str, BaseVideoProvider] = {
        "302ai_kling": ai302_kling_provider,
    }

    @classmethod
    def get_llm_provider(cls, vendor: str) -> BaseLLMProvider | None:
        """获取 LLM Provider

        Args:
            vendor: 厂商名称 (zhipu, gemini, 302ai)

        Returns:
            Provider 实例，不存在则返回 None
        """
        return cls._llm_providers.get(vendor)

    @classmethod
    def get_image_provider(cls, vendor: str) -> BaseImageProvider | None:
        """获取 Image Provider

        Args:
            vendor: 厂商名称 (gemini, 302ai_gemini, 302ai_nano_banana, 302ai_seedream)

        Returns:
            Provider 实例，不存在则返回 None
        """
        return cls._image_providers.get(vendor)

    @classmethod
    def get_video_provider(cls, vendor: str) -> BaseVideoProvider | None:
        """获取 Video Provider

        Args:
            vendor: 厂商名称 (302ai_kling)

        Returns:
            Provider 实例，不存在则返回 None
        """
        return cls._video_providers.get(vendor)

    @classmethod
    def list_llm_providers(cls) -> list[dict[str, Any]]:
        """列出所有 LLM Provider 信息

        Returns:
            Provider 信息列表
        """
        return [
            {
                "vendor": vendor,
                "model": provider.model_name,
                "available": provider.is_available(),
                "info": provider.get_provider_info(),
            }
            for vendor, provider in cls._llm_providers.items()
        ]

    @classmethod
    def list_image_providers(cls) -> list[dict[str, Any]]:
        """列出所有 Image Provider 信息

        Returns:
            Provider 信息列表
        """
        return [
            {
                "vendor": vendor,
                "model": provider.model_name,
                "available": provider.is_available(),
                "info": provider.get_provider_info(),
            }
            for vendor, provider in cls._image_providers.items()
        ]

    @classmethod
    def list_video_providers(cls) -> list[dict[str, Any]]:
        """列出所有 Video Provider 信息

        Returns:
            Provider 信息列表
        """
        return [
            {
                "vendor": vendor,
                "model": provider.model_name,
                "available": provider.is_available(),
                "info": provider.get_provider_info(),
            }
            for vendor, provider in cls._video_providers.items()
        ]

    @classmethod
    def list_all_providers(cls) -> dict[str, Any]:
        """列出所有 Provider 信息

        Returns:
            按类型分组的信息字典
        """
        return {
            "llm": cls.list_llm_providers(),
            "image": cls.list_image_providers(),
            "video": cls.list_video_providers(),
        }


# =============================================================================
# LLM 服务
# =============================================================================

class LLMService:
    """LLM 生成服务

    封装 LLM Provider 的调用逻辑，提供统一的服务接口。
    """

    @staticmethod
    def _filter_exposed_params(
        provider: BaseLLMProvider,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """过滤出暴露的参数

        Args:
            provider: Provider 实例
            params: 输入参数字典

        Returns:
            只包含暴露参数的字典
        """
        exposed_names = {p.name for p in provider.get_exposed_params()}
        return {k: v for k, v in params.items() if k in exposed_names}

    @staticmethod
    def generate(
        vendor: str,
        prompt: str,
        **kwargs,
    ) -> dict[str, Any]:
        """生成文本

        Args:
            vendor: 厂商名称
            prompt: 输入提示词
            **kwargs: 厂商特定参数

        Returns:
            包含生成结果的字典:
                - success: 是否成功
                - content: 生成内容（成功时）
                - error: 错误信息（失败时）
                - vendor: 实际使用的厂商
                - model: 模型名称

        Note:
            只传递 Provider 暴露的参数，未暴露的参数将被过滤。
        """
        provider = ProviderRegistry.get_llm_provider(vendor)

        if provider is None:
            return {
                "success": False,
                "error": f"Unknown LLM vendor: {vendor}",
                "vendor": vendor,
            }

        if not provider.is_available():
            return {
                "success": False,
                "error": f"LLM provider '{vendor}' is not available (check API key)",
                "vendor": vendor,
            }

        # 过滤参数，只传递暴露的参数
        filtered_params = LLMService._filter_exposed_params(provider, kwargs)

        try:
            content = provider.generate(prompt, **filtered_params)
            return {
                "success": True,
                "content": content,
                "vendor": vendor,
                "model": provider.model_name,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "vendor": vendor,
                "model": provider.model_name,
            }

    @staticmethod
    def get_providers() -> list[dict[str, Any]]:
        """获取所有 LLM Provider 信息

        Returns:
            Provider 信息列表
        """
        return ProviderRegistry.list_llm_providers()


# =============================================================================
# Image 服务
# =============================================================================

class ImageService:
    """Image 生成服务

    封装 Image Provider 的调用逻辑，处理图片数据的编码和传输。
    """

    @staticmethod
    def _encode_image(image_bytes: bytes) -> str:
        """将图片字节编码为 base64

        Args:
            image_bytes: 图片二进制数据

        Returns:
            base64 编码的字符串
        """
        return base64.b64encode(image_bytes).decode("utf-8")

    @staticmethod
    def _filter_exposed_params(
        provider: BaseImageProvider,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """过滤出暴露的参数

        Args:
            provider: Provider 实例
            params: 输入参数字典

        Returns:
            只包含暴露参数的字典
        """
        exposed_names = {p.name for p in provider.get_exposed_params()}
        return {k: v for k, v in params.items() if k in exposed_names}

    @staticmethod
    def generate(
        vendor: str,
        prompt: str,
        return_format: str = "base64",
        **kwargs,
    ) -> dict[str, Any]:
        """生成图片

        Args:
            vendor: 厂商名称
            prompt: 图片描述提示词
            return_format: 返回格式 (base64, bytes)
            **kwargs: 厂商特定参数

        Returns:
            包含生成结果的字典:
                - success: 是否成功
                - content: 图片内容（格式取决于 return_format）
                - format: 内容格式 (base64, bytes)
                - error: 错误信息（失败时）
                - vendor: 实际使用的厂商
                - model: 模型名称

        Note:
            只传递 Provider 暴露的参数，未暴露的参数将被过滤。
        """
        provider = ProviderRegistry.get_image_provider(vendor)

        if provider is None:
            return {
                "success": False,
                "error": f"Unknown image vendor: {vendor}",
                "vendor": vendor,
                "format": return_format,
            }

        if not provider.is_available():
            return {
                "success": False,
                "error": f"Image provider '{vendor}' is not available (check API key)",
                "vendor": vendor,
                "format": return_format,
            }

        # 过滤参数，只传递暴露的参数
        filtered_params = ImageService._filter_exposed_params(provider, kwargs)
        resolved_model = (
            filtered_params.get("model_name")
            if isinstance(filtered_params.get("model_name"), str) and filtered_params.get("model_name")
            else provider.model_name
        )

        try:
            image_bytes = provider.generate(prompt, **filtered_params)

            if return_format == "base64":
                content = ImageService._encode_image(image_bytes)
            else:
                content = image_bytes

            return {
                "success": True,
                "content": content,
                "format": return_format,
                "vendor": vendor,
                "model": resolved_model,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "vendor": vendor,
                "model": resolved_model,
                "format": return_format,
            }

    @staticmethod
    def get_providers() -> list[dict[str, Any]]:
        """获取所有 Image Provider 信息

        Returns:
            Provider 信息列表
        """
        return ProviderRegistry.list_image_providers()


# =============================================================================
# Video 服务
# =============================================================================

class VideoService:
    """Video 生成服务

    封装 Video Provider 的调用逻辑，处理视频数据的编码和传输。
    """

    @staticmethod
    def _encode_video(video_bytes: bytes) -> str:
        """将视频字节编码为 base64

        Args:
            video_bytes: 视频二进制数据

        Returns:
            base64 编码的字符串
        """
        return base64.b64encode(video_bytes).decode("utf-8")

    @staticmethod
    def _filter_exposed_params(
        provider: BaseVideoProvider,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """过滤出暴露的参数

        Args:
            provider: Provider 实例
            params: 输入参数字典

        Returns:
            只包含暴露参数的字典
        """
        exposed_names = {p.name for p in provider.get_exposed_params()}
        return {k: v for k, v in params.items() if k in exposed_names}

    @staticmethod
    def generate(
        vendor: str,
        prompt: str,
        return_format: str = "base64",
        **kwargs,
    ) -> dict[str, Any]:
        """生成视频

        Args:
            vendor: 厂商名称
            prompt: 视频描述提示词
            return_format: 返回格式 (base64, bytes)
            **kwargs: 厂商特定参数

        Returns:
            包含生成结果的字典:
                - success: 是否成功
                - content: 视频内容（格式取决于 return_format）
                - format: 内容格式 (base64, bytes)
                - error: 错误信息（失败时）
                - vendor: 实际使用的厂商
                - model: 模型名称

        Note:
            只传递 Provider 暴露的参数，未暴露的参数将被过滤。
        """
        provider = ProviderRegistry.get_video_provider(vendor)

        if provider is None:
            return {
                "success": False,
                "error": f"Unknown video vendor: {vendor}",
                "vendor": vendor,
                "format": return_format,
            }

        if not provider.is_available():
            return {
                "success": False,
                "error": f"Video provider '{vendor}' is not available (check API key)",
                "vendor": vendor,
                "format": return_format,
            }

        # 过滤参数，只传递暴露的参数
        filtered_params = VideoService._filter_exposed_params(provider, kwargs)

        try:
            video_bytes = provider.generate(prompt, **filtered_params)

            if return_format == "base64":
                content = VideoService._encode_video(video_bytes)
            else:
                content = video_bytes

            return {
                "success": True,
                "content": content,
                "format": return_format,
                "vendor": vendor,
                "model": provider.model_name,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "vendor": vendor,
                "model": provider.model_name,
                "format": return_format,
            }

    @staticmethod
    def get_providers() -> list[dict[str, Any]]:
        """获取所有 Video Provider 信息

        Returns:
            Provider 信息列表
        """
        return ProviderRegistry.list_video_providers()


# =============================================================================
# 统一服务入口
# =============================================================================

def get_service(provider_type: str) -> type[LLMService] | type[ImageService] | type[VideoService] | None:
    """根据 Provider 类型获取对应的服务类

    Args:
        provider_type: Provider 类型 (llm, image, video)

    Returns:
        对应的服务类
    """
    services = {
        "llm": LLMService,
        "image": ImageService,
        "video": VideoService,
    }
    return services.get(provider_type)
