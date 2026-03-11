"""Provider 参数元数据测试

测试 Provider 的参数规范定义和获取对外暴露参数功能。
"""

import pytest

from src.backend.providers.llm.zhipu import ZhipuProvider
from src.backend.providers.llm.gemini import GeminiProvider
from src.backend.providers.llm.ai302 import AI302Provider
from src.backend.providers.image.gemini import GeminiImageProvider
from src.backend.providers.image.ai302_seedream import AI302SeedreamProvider
from src.backend.providers.image.ai302_nano_banana import AI302NanoBananaProvider
from src.backend.providers.video.ai302_kling import AI302KlingProvider


class TestLLMParamSpec:
    """测试 LLM Provider 参数规范"""

    def test_zhipu_provider_params(self):
        """测试 ZhipuProvider 参数规范"""
        assert ZhipuProvider.GENERATE_PARAMS, "ZhipuProvider 应该有参数定义"

        exposed = ZhipuProvider.get_exposed_params()
        assert len(exposed) == 1, f"应该有 1 个对外暴露参数，实际: {len(exposed)}"

        param_names = [p.name for p in exposed]
        assert "thinking_enabled" in param_names
        # temperature 和 max_tokens 不再对外暴露
        assert "temperature" not in param_names
        assert "max_tokens" not in param_names

        # 验证 thinking_enabled 参数
        thinking_param = ZhipuProvider.get_param_dict()["thinking_enabled"]
        assert thinking_param.type == bool
        assert thinking_param.default is False
        assert thinking_param.exposed is True
        assert "深度思考" in thinking_param.description

    def test_gemini_provider_params(self):
        """测试 GeminiProvider 参数规范"""
        assert GeminiProvider.GENERATE_PARAMS, "GeminiProvider 应该有参数定义"

        exposed = GeminiProvider.get_exposed_params()
        param_names = [p.name for p in exposed]

        # 只有 thinking_level 对外暴露
        assert "thinking_level" in param_names
        # temperature 和 max_tokens 不再对外暴露
        assert "temperature" not in param_names
        assert "max_tokens" not in param_names

        # 验证 thinking_level 参数的可选值
        thinking_param = GeminiProvider.get_param_dict()["thinking_level"]
        assert thinking_param.choices == ["minimal", "low", "medium", "high"]

    def test_ai302_provider_params(self):
        """测试 AI302Provider 参数规范"""
        assert AI302Provider.GENERATE_PARAMS, "AI302Provider 应该有参数定义"

        exposed = AI302Provider.get_exposed_params()
        param_names = [p.name for p in exposed]

        # 302.AI LLM 没有对外暴露的参数
        assert len(exposed) == 0, f"应该有 0 个对外暴露参数，实际: {len(exposed)}"

        # stream 不应该对外暴露
        assert "stream" not in param_names

        # temperature 和 max_tokens 也不对外暴露
        assert "temperature" not in param_names
        assert "max_tokens" not in param_names

    def test_provider_info_structure(self):
        """测试 get_provider_info 返回结构"""
        info = ZhipuProvider.get_provider_info()

        assert "provider_type" in info
        assert info["provider_type"] == "llm"
        assert "params" in info
        assert "exposed_params" in info

        # 验证 exposed_params 不包含 exposed=False 的参数
        exposed_param_names = [p["name"] for p in info["exposed_params"]]
        for param in info["params"]:
            if param["exposed"]:
                assert param["name"] in exposed_param_names
            else:
                assert param["name"] not in exposed_param_names


class TestImageParamSpec:
    """测试 Image Provider 参数规范"""

    def test_ai302_seedream_params(self):
        """测试 AI302SeedreamProvider 参数规范"""
        assert AI302SeedreamProvider.GENERATE_PARAMS, "应该有参数定义"

        exposed = AI302SeedreamProvider.get_exposed_params()
        param_names = [p.name for p in exposed]

        # 内部参数不应对外暴露
        assert "response_format" not in param_names
        assert "model" not in param_names
        assert "watermark" not in param_names  # watermark 也不再对外暴露
        assert "size" not in param_names

        # 用户参数应该暴露
        assert "image" in param_names
        assert "aspect_ratio" in param_names

        # 验证 aspect_ratio 的可选值
        aspect_ratio_param = AI302SeedreamProvider.get_param_dict()["aspect_ratio"]
        assert "1:1" in aspect_ratio_param.choices
        assert "16:9" in aspect_ratio_param.choices

    def test_gemini_image_params(self):
        """测试 GeminiImageProvider 参数规范"""
        assert GeminiImageProvider.GENERATE_PARAMS, "应该有参数定义"

        exposed = GeminiImageProvider.get_exposed_params()
        param_names = [p.name for p in exposed]

        assert "images" in param_names
        assert "model_name" in param_names
        assert "resolution" in param_names
        assert "aspect_ratio" in param_names

        model_param = GeminiImageProvider.get_param_dict()["model_name"]
        assert model_param.default == "imagen-4.0-generate-001"
        assert model_param.choices == [
            "gemini-3.1-flash-image-preview",
            "gemini-3-pro-image-preview",
            "imagen-4.0-fast-generate-001",
            "imagen-4.0-generate-001",
            "imagen-4.0-ultra-generate-001",
        ]

    def test_ai302_nano_banana_params(self):
        """测试 AI302NanoBananaProvider 参数规范"""
        assert AI302NanoBananaProvider.GENERATE_PARAMS, "应该有参数定义"

        exposed = AI302NanoBananaProvider.get_exposed_params()
        param_names = [p.name for p in exposed]

        # 内部参数不应对外暴露
        assert "enable_sync_mode" not in param_names
        assert "enable_base64_output" not in param_names

        # 用户参数应该暴露
        assert "images" in param_names
        assert "resolution" in param_names
        assert "aspect_ratio" in param_names


class TestVideoParamSpec:
    """测试 Video Provider 参数规范"""

    def test_ai302_kling_params(self):
        """测试 AI302KlingProvider 参数规范"""
        assert AI302KlingProvider.GENERATE_PARAMS, "应该有参数定义"

        exposed = AI302KlingProvider.get_exposed_params()
        param_names = [p.name for p in exposed]

        # 内部参数不应对外暴露
        assert "wait_for_result" not in param_names

        # 用户参数应该暴露
        assert "images" in param_names
        assert "model_name" in param_names  # 现已对外暴露
        assert "mode" in param_names
        assert "aspect_ratio" in param_names
        assert "duration" in param_names

        # 验证 duration 的可选值
        duration_param = AI302KlingProvider.get_param_dict()["duration"]
        assert duration_param.choices == [5, 10]

        # 验证 mode 的可选值
        mode_param = AI302KlingProvider.get_param_dict()["mode"]
        assert mode_param.choices == ["std", "pro"]


class TestParamSpecDataclass:
    """测试 ParamSpec 数据类"""

    def test_param_spec_attributes(self):
        """测试 ParamSpec 属性"""
        from src.backend.providers.param_spec import ParamSpec

        param = ParamSpec(
            name="test_param",
            type=str,
            exposed=True,
            default="default_value",
            description="测试参数",
            choices=["a", "b"],
            required=False,
        )

        assert param.name == "test_param"
        assert param.type == str
        assert param.exposed is True
        assert param.default == "default_value"
        assert param.description == "测试参数"
        assert param.choices == ["a", "b"]
        assert param.required is False

    def test_param_spec_immutability(self):
        """测试 ParamSpec 不可变性"""
        from dataclasses import FrozenInstanceError
        from src.backend.providers.param_spec import ParamSpec

        param = ParamSpec(
            name="test_param",
            type=str,
            exposed=True,
            default="default_value",
            description="测试参数",
            choices=["a", "b"],
            required=False,
        )

        # frozen dataclass 应该是不可变的
        with pytest.raises(FrozenInstanceError):
            param.name = "new_name"
