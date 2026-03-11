"""
Provider 服务测试

测试 ProviderRegistry、LLMService、ImageService、VideoService 的功能。
"""

import pytest

from src.backend.services.provider_service import (
    ImageService,
    LLMService,
    ProviderRegistry,
    VideoService,
    get_service,
)


class TestProviderRegistry:
    """测试 ProviderRegistry"""

    def test_get_llm_provider_existing(self):
        """测试获取存在的 LLM Provider"""
        provider = ProviderRegistry.get_llm_provider("zhipu")
        assert provider is not None
        assert provider.model_name is not None

    def test_get_llm_provider_not_existing(self):
        """测试获取不存在的 LLM Provider"""
        provider = ProviderRegistry.get_llm_provider("unknown")
        assert provider is None

    def test_get_image_provider_existing(self):
        """测试获取存在的 Image Provider"""
        provider = ProviderRegistry.get_image_provider("gemini")
        assert provider is not None
        assert provider.model_name is not None

    def test_get_image_provider_not_existing(self):
        """测试获取不存在的 Image Provider"""
        provider = ProviderRegistry.get_image_provider("unknown")
        assert provider is None

    def test_get_video_provider_existing(self):
        """测试获取存在的 Video Provider"""
        provider = ProviderRegistry.get_video_provider("302ai_kling")
        assert provider is not None
        assert provider.model_name is not None

    def test_get_video_provider_not_existing(self):
        """测试获取不存在的 Video Provider"""
        provider = ProviderRegistry.get_video_provider("unknown")
        assert provider is None

    def test_list_llm_providers(self):
        """测试列出 LLM Providers"""
        providers = ProviderRegistry.list_llm_providers()
        assert isinstance(providers, list)
        assert len(providers) > 0
        for p in providers:
            assert "vendor" in p
            assert "model" in p
            assert "available" in p
            assert "info" in p

    def test_list_image_providers(self):
        """测试列出 Image Providers"""
        providers = ProviderRegistry.list_image_providers()
        assert isinstance(providers, list)
        assert len(providers) > 0
        for p in providers:
            assert "vendor" in p
            assert "model" in p
            assert "available" in p

    def test_list_video_providers(self):
        """测试列出 Video Providers"""
        providers = ProviderRegistry.list_video_providers()
        assert isinstance(providers, list)
        assert len(providers) > 0
        for p in providers:
            assert "vendor" in p
            assert "model" in p
            assert "available" in p

    def test_list_all_providers(self):
        """测试列出所有 Providers"""
        all_providers = ProviderRegistry.list_all_providers()
        assert "llm" in all_providers
        assert "image" in all_providers
        assert "video" in all_providers


class TestLLMService:
    """测试 LLMService"""

    def test_get_providers(self):
        """测试获取 Providers"""
        providers = LLMService.get_providers()
        assert isinstance(providers, list)
        assert len(providers) > 0

    def test_generate_unknown_vendor(self):
        """测试生成时使用不存在的厂商"""
        result = LLMService.generate("unknown", "test prompt")
        assert result["success"] is False
        assert "error" in result
        assert result["vendor"] == "unknown"

    def test_generate_unavailable_vendor(self):
        """测试生成时使用不可用的厂商（无 API Key）"""
        result = LLMService.generate("zhipu", "test prompt")
        # 如果没有配置 API Key，应该返回失败
        if not result["success"]:
            assert "error" in result


class TestImageService:
    """测试 ImageService"""

    def test_get_providers(self):
        """测试获取 Providers"""
        providers = ImageService.get_providers()
        assert isinstance(providers, list)
        assert len(providers) > 0

    def test_generate_unknown_vendor(self):
        """测试生成时使用不存在的厂商"""
        result = ImageService.generate("unknown", "test prompt")
        assert result["success"] is False
        assert "error" in result
        assert result["vendor"] == "unknown"


class TestVideoService:
    """测试 VideoService"""

    def test_get_providers(self):
        """测试获取 Providers"""
        providers = VideoService.get_providers()
        assert isinstance(providers, list)
        assert len(providers) > 0

    def test_generate_unknown_vendor(self):
        """测试生成时使用不存在的厂商"""
        result = VideoService.generate("unknown", "test prompt")
        assert result["success"] is False
        assert "error" in result
        assert result["vendor"] == "unknown"


class TestGetService:
    """测试 get_service 工厂函数"""

    def test_get_llm_service(self):
        """测试获取 LLM 服务"""
        service = get_service("llm")
        assert service is LLMService

    def test_get_image_service(self):
        """测试获取 Image 服务"""
        service = get_service("image")
        assert service is ImageService

    def test_get_video_service(self):
        """测试获取 Video 服务"""
        service = get_service("video")
        assert service is VideoService

    def test_get_unknown_service(self):
        """测试获取不存在的服务"""
        service = get_service("unknown")
        assert service is None


class TestParamFiltering:
    """测试参数过滤功能"""

    def test_llm_zhipu_filter_exposed_params(self):
        """测试 zhipu LLM 参数过滤"""
        from src.backend.services.provider_service import ProviderRegistry

        provider = ProviderRegistry.get_llm_provider("zhipu")
        service = get_service("llm")

        # 输入参数包含暴露和未暴露的参数
        params = {
            "thinking_enabled": True,  # 暴露
            "temperature": 0.8,  # 未暴露
            "max_tokens": 1000,  # 未暴露
            "unknown_param": "value",  # 未暴露
        }

        filtered = service._filter_exposed_params(provider, params)

        # 应该只包含暴露的参数
        assert "thinking_enabled" in filtered
        assert "temperature" not in filtered
        assert "max_tokens" not in filtered
        assert "unknown_param" not in filtered

    def test_llm_gemini_filter_exposed_params(self):
        """测试 gemini LLM 参数过滤"""
        from src.backend.services.provider_service import ProviderRegistry

        provider = ProviderRegistry.get_llm_provider("gemini")
        service = get_service("llm")

        # 输入参数包含暴露和未暴露的参数
        params = {
            "thinking_level": "high",  # 暴露
            "temperature": 0.8,  # 未暴露
            "max_tokens": 1000,  # 未暴露
        }

        filtered = service._filter_exposed_params(provider, params)

        # 应该只包含暴露的参数
        assert "thinking_level" in filtered
        assert "temperature" not in filtered
        assert "max_tokens" not in filtered

    def test_llm_ai302_filter_exposed_params(self):
        """测试 302.AI LLM 参数过滤 - 无暴露参数"""
        from src.backend.services.provider_service import ProviderRegistry

        provider = ProviderRegistry.get_llm_provider("302ai")
        service = get_service("llm")

        # 输入参数
        params = {
            "temperature": 0.8,  # 未暴露
            "max_tokens": 1000,  # 未暴露
            "stream": False,  # 未暴露
        }

        filtered = service._filter_exposed_params(provider, params)

        # 应该为空，因为 302.AI LLM 没有暴露参数
        assert len(filtered) == 0

    def test_image_gemini_filter_exposed_params(self):
        """测试 gemini Image 参数过滤"""
        from src.backend.services.provider_service import ProviderRegistry

        provider = ProviderRegistry.get_image_provider("gemini")
        service = get_service("image")

        # 输入参数包含暴露和未暴露的参数
        params = {
            "images": ["url1"],  # 暴露
            "model_name": "gemini-3-pro-image-preview",  # 暴露
            "resolution": "2k",  # 暴露
            "aspect_ratio": "16:9",  # 暴露
            "internal_only": True,  # 未暴露
        }

        filtered = service._filter_exposed_params(provider, params)

        # 应该只包含暴露的参数
        assert "images" in filtered
        assert "model_name" in filtered
        assert "resolution" in filtered
        assert "aspect_ratio" in filtered
        assert "internal_only" not in filtered

    def test_video_kling_filter_exposed_params(self):
        """测试 302ai_kling Video 参数过滤"""
        from src.backend.services.provider_service import ProviderRegistry

        provider = ProviderRegistry.get_video_provider("302ai_kling")
        service = get_service("video")

        # 输入参数包含暴露和未暴露的参数
        params = {
            "images": ["url1"],  # 暴露
            "mode": "pro",  # 暴露
            "wait_for_result": True,  # 未暴露
        }

        filtered = service._filter_exposed_params(provider, params)

        # 应该只包含暴露的参数
        assert "images" in filtered
        assert "mode" in filtered
        assert "wait_for_result" not in filtered
