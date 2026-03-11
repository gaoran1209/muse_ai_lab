"""
Provider API 路由测试

测试 FastAPI 路由端点的功能。
"""

import pytest
from fastapi.testclient import TestClient

from src.backend.main import app


client = TestClient(app)


class TestLLMAPI:
    """测试 LLM API 端点"""

    def test_list_llm_providers(self):
        """测试列出 LLM Providers"""
        response = client.get("/api/v1/llm/providers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        for item in data:
            assert "vendor" in item
            assert "model" in item
            assert "available" in item
            assert "info" in item
            # 验证 exposed_params 字段存在
            assert "exposed_params" in item["info"]

    def test_generate_llm_unknown_vendor(self):
        """测试 LLM 生成时使用不存在的厂商"""
        response = client.post(
            "/api/v1/llm/generate",
            json={
                "vendor": "unknown",
                "prompt": "test",
                "parameters": {},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "error" in data

    def test_generate_llm_missing_vendor(self):
        """测试 LLM 生成时缺少厂商参数"""
        response = client.post(
            "/api/v1/llm/generate",
            json={
                "prompt": "test",
                "parameters": {},
            },
        )
        assert response.status_code == 422  # Validation error

    def test_generate_llm_with_parameters(self):
        """测试 LLM 生成时传入 parameters"""
        response = client.post(
            "/api/v1/llm/generate",
            json={
                "vendor": "zhipu",
                "prompt": "test",
                "parameters": {
                    "temperature": 0.8,
                    "max_tokens": 1000,
                },
            },
        )
        # 应该返回 200，即使没有配置 API Key
        assert response.status_code == 200
        data = response.json()
        # 没有配置 API Key 时会失败
        if not data["success"]:
            assert "error" in data


class TestImageAPI:
    """测试 Image API 端点"""

    def test_list_image_providers(self):
        """测试列出 Image Providers"""
        response = client.get("/api/v1/image/providers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        for item in data:
            assert "vendor" in item
            assert "model" in item
            assert "available" in item
            assert "info" in item
            # 验证 exposed_params 字段存在
            assert "exposed_params" in item["info"]

    def test_generate_image_unknown_vendor(self):
        """测试 Image 生成时使用不存在的厂商"""
        response = client.post(
            "/api/v1/image/generate",
            json={
                "vendor": "unknown",
                "prompt": "test",
                "parameters": {},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "error" in data

    def test_generate_image_with_parameters(self):
        """测试 Image 生成时传入 parameters"""
        response = client.post(
            "/api/v1/image/generate",
            json={
                "vendor": "gemini",
                "prompt": "a cute cat",
                "parameters": {
                    "model_name": "gemini-3.1-flash-image-preview",
                    "resolution": "2k",
                    "aspect_ratio": "16:9",
                },
            },
        )
        # 应该返回 200，即使没有配置 API Key
        assert response.status_code == 200


class TestVideoAPI:
    """测试 Video API 端点"""

    def test_list_video_providers(self):
        """测试列出 Video Providers"""
        response = client.get("/api/v1/video/providers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        for item in data:
            assert "vendor" in item
            assert "model" in item
            assert "available" in item
            assert "info" in item
            # 验证 exposed_params 字段存在
            assert "exposed_params" in item["info"]

    def test_generate_video_unknown_vendor(self):
        """测试 Video 生成时使用不存在的厂商"""
        response = client.post(
            "/api/v1/video/generate",
            json={
                "vendor": "unknown",
                "prompt": "test",
                "parameters": {},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "error" in data

    def test_generate_video_with_parameters(self):
        """测试 Video 生成时传入 parameters"""
        response = client.post(
            "/api/v1/video/generate",
            json={
                "vendor": "thirtytwo_kling",
                "prompt": "clouds moving",
                "parameters": {
                    "aspect_ratio": "16:9",
                    "duration": 5,
                },
            },
        )
        # 应该返回 200，即使没有配置 API Key
        assert response.status_code == 200


class TestUnifiedAPI:
    """测试统一 API 端点"""

    def test_list_all_providers(self):
        """测试列出所有 Providers"""
        response = client.get("/api/v1/providers")
        assert response.status_code == 200
        data = response.json()
        assert "llm" in data
        assert "image" in data
        assert "video" in data


class TestRootEndpoints:
    """测试根路径端点"""

    def test_root(self):
        """测试根路径"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data

    def test_health_check(self):
        """测试健康检查"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestExposedParams:
    """测试暴露参数功能"""

    def test_zhipu_exposed_params(self):
        """测试 zhipu 暴露参数"""
        response = client.get("/api/v1/llm/providers")
        assert response.status_code == 200
        providers = response.json()
        zhipu = next((p for p in providers if p["vendor"] == "zhipu"), None)
        assert zhipu is not None
        exposed_params = zhipu["info"]["exposed_params"]
        exposed_names = [p["name"] for p in exposed_params]
        # zhipu 只暴露 thinking_enabled
        assert "thinking_enabled" in exposed_names
        # temperature 和 max_tokens 不再暴露
        assert "temperature" not in exposed_names
        assert "max_tokens" not in exposed_names

    def test_gemini_exposed_params(self):
        """测试 gemini 暴露参数"""
        response = client.get("/api/v1/llm/providers")
        assert response.status_code == 200
        providers = response.json()
        gemini = next((p for p in providers if p["vendor"] == "gemini"), None)
        assert gemini is not None
        exposed_params = gemini["info"]["exposed_params"]
        exposed_names = [p["name"] for p in exposed_params]
        # gemini 只有 thinking_level 暴露
        assert "thinking_level" in exposed_names
        # temperature 和 max_tokens 不应该暴露
        assert "temperature" not in exposed_names
        assert "max_tokens" not in exposed_names

    def test_thirtytwo_llm_no_exposed_params(self):
        """测试 thirtytwo LLM 无暴露参数"""
        response = client.get("/api/v1/llm/providers")
        assert response.status_code == 200
        providers = response.json()
        thirtytwo = next((p for p in providers if p["vendor"] == "thirtytwo"), None)
        assert thirtytwo is not None
        exposed_params = thirtytwo["info"]["exposed_params"]
        # thirtytwo LLM 没有暴露参数
        assert len(exposed_params) == 0
