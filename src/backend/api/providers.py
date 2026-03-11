"""
Provider API routes.
"""

import os
import time
import uuid
from typing import Any

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel, Field

from src.backend.services.provider_service import ImageService, LLMService, ProviderRegistry, VideoService


class LLMGenerateRequest(BaseModel):
    vendor: str = Field(..., description="LLM vendor")
    prompt: str = Field(..., description="Text prompt")
    parameters: dict[str, Any] = Field(default_factory=dict)


class ImageGenerateRequest(BaseModel):
    vendor: str = Field(..., description="Image vendor")
    prompt: str = Field(..., description="Image prompt")
    parameters: dict[str, Any] = Field(default_factory=dict)


class VideoGenerateRequest(BaseModel):
    vendor: str = Field(..., description="Video vendor")
    prompt: str = Field(..., description="Video prompt")
    parameters: dict[str, Any] = Field(default_factory=dict)


class GenerateResponse(BaseModel):
    success: bool
    content: Any | None = None
    format: str | None = None
    error: str | None = None
    vendor: str
    model: str | None = None


class ProviderInfo(BaseModel):
    vendor: str
    model: str
    available: bool
    info: dict[str, Any]


class ProvidersListResponse(BaseModel):
    llm: list[ProviderInfo] = Field(default_factory=list)
    image: list[ProviderInfo] = Field(default_factory=list)
    video: list[ProviderInfo] = Field(default_factory=list)


router = APIRouter(prefix="/api/v1", tags=["providers"])


@router.post("/llm/generate", response_model=GenerateResponse)
async def generate_llm(request: LLMGenerateRequest) -> dict[str, Any]:
    return LLMService.generate(vendor=request.vendor, prompt=request.prompt, **request.parameters)


@router.get("/llm/providers", response_model=list[ProviderInfo])
async def list_llm_providers() -> list[dict[str, Any]]:
    return LLMService.get_providers()


@router.post("/image/generate", response_model=GenerateResponse)
async def generate_image(request: ImageGenerateRequest) -> dict[str, Any]:
    return ImageService.generate(
        vendor=request.vendor,
        prompt=request.prompt,
        return_format="base64",
        **request.parameters,
    )


@router.get("/image/providers", response_model=list[ProviderInfo])
async def list_image_providers() -> list[dict[str, Any]]:
    return ImageService.get_providers()


@router.post("/video/generate", response_model=GenerateResponse)
async def generate_video(request: VideoGenerateRequest) -> dict[str, Any]:
    return VideoService.generate(
        vendor=request.vendor,
        prompt=request.prompt,
        return_format="base64",
        **request.parameters,
    )


@router.get("/video/providers", response_model=list[ProviderInfo])
async def list_video_providers() -> list[dict[str, Any]]:
    return VideoService.get_providers()


@router.post("/upload/image")
async def upload_image(file: UploadFile = File(...)) -> dict[str, Any]:
    from src.backend.utils import BucketCommand, DEFAULT_OSS_CONFIG

    try:
        oss_client = BucketCommand.from_str_config(DEFAULT_OSS_CONFIG)
        if not oss_client:
            return {"success": False, "error": "OSS 未配置，请检查环境变量"}

        file_bytes = await file.read()
        ext = os.path.splitext(file.filename or "image.png")[1].lstrip(".") or "png"
        remote_filename = f"upload_{int(time.time())}_{uuid.uuid4()}.{ext}"
        url = oss_client.upload_file_bytes(file_bytes, remote_filename)
        return {"success": True, "url": url}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@router.get("/providers", response_model=ProvidersListResponse)
async def list_all_providers() -> dict[str, Any]:
    return ProviderRegistry.list_all_providers()
