"""
Pydantic schemas for MUSE AI Lab API request/response validation.

Naming convention:
    - *Create  : POST request body
    - *Update  : PATCH request body
    - *Response: API response body
    - *Brief   : Lightweight response (list items)
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ===========================================================================
# Shared types
# ===========================================================================

AssetCategory = Literal["product", "model", "background", "pose"]
ShotType = Literal["image", "video"]
TaskStatus = Literal["queued", "processing", "completed", "failed"]
InteractionType = Literal["like", "favorite", "comment"]
OutfitMode = Literal["auto", "complete", "group"]


# ===========================================================================
# Asset tags (stored as JSON in Asset.tags column)
# ===========================================================================

class AssetTags(BaseModel):
    category: str = "product"
    subcategory: str | None = None  # top / bottom / dress / shoes / bag / accessory
    color: str | None = None
    style: str | None = None
    season: str | None = None
    occasion: str | None = None


# ===========================================================================
# Project
# ===========================================================================

class ProjectCreate(BaseModel):
    name: str = Field(default="Untitled Project", max_length=200)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    cover_url: str | None = None


class ProjectBrief(BaseModel):
    id: str
    name: str
    cover_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectResponse(ProjectBrief):
    asset_count: int = 0
    look_count: int = 0


# ===========================================================================
# Asset
# ===========================================================================

class AssetCreate(BaseModel):
    """Used internally after file upload + OSS storage."""
    url: str
    thumbnail_url: str | None = None
    category: AssetCategory = "product"
    tags: AssetTags | None = None
    original_filename: str | None = None


class AssetUpdate(BaseModel):
    category: AssetCategory | None = None
    tags: AssetTags | None = None


class AssetResponse(BaseModel):
    id: str
    project_id: str
    url: str
    thumbnail_url: str | None
    category: str
    tags: AssetTags | None
    original_filename: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ===========================================================================
# Look / LookItem
# ===========================================================================

class LookItemResponse(BaseModel):
    id: str
    look_id: str
    asset_id: str | None
    category: str
    placeholder_desc: str | None
    sort_order: int
    asset_url: str | None = None  # populated from joined Asset

    model_config = {"from_attributes": True}


class LookGenerateRequest(BaseModel):
    asset_ids: list[str] = Field(default_factory=list)
    mode: OutfitMode = "auto"
    count: int = Field(default=2, ge=1, le=5)


class LookItemUpdate(BaseModel):
    asset_id: str | None = None
    category: str
    placeholder_desc: str | None = None
    sort_order: int = Field(default=0, ge=0)


class LookUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    style_tags: list[str] | None = None
    board_position: dict[str, Any] | None = None  # {x, y, width, height}
    items: list[LookItemUpdate] | None = None


class LookResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None
    style_tags: list[str]
    board_position: dict[str, Any] | None
    items: list[LookItemResponse]
    created_at: datetime

    model_config = {"from_attributes": True}


class LookBrief(BaseModel):
    id: str
    project_id: str
    name: str
    style_tags: list[str]
    item_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class LookGenerateResponse(BaseModel):
    looks: list[LookResponse]


# ===========================================================================
# Shot (generation result)
# ===========================================================================

class ShotGenerateRequest(BaseModel):
    type: ShotType = "image"
    action: str = "custom"  # change_model / change_background / tryon / custom
    vendor: str | None = None
    preset_id: str | None = None
    custom_prompt: str | None = None
    reference_image_url: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class ShotAdoptRequest(BaseModel):
    adopted: bool = True


class ShotResponse(BaseModel):
    id: str
    look_id: str
    content_id: str | None
    type: str
    url: str | None
    thumbnail_url: str | None
    prompt: str | None
    parameters: dict[str, Any] | None
    vendor: str | None
    status: str
    adopted: bool
    canvas_position: dict[str, Any] | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ===========================================================================
# Content (published to Muse Land)
# ===========================================================================

class ContentPublishRequest(BaseModel):
    look_id: str
    shot_ids: list[str] = Field(default_factory=list)
    title: str = Field(default="", max_length=200)
    description: str | None = None
    tags: list[str] = Field(default_factory=list)


class ContentResponse(BaseModel):
    id: str
    look_id: str
    title: str
    description: str | None
    tags: list[str]
    cover_url: str | None
    shot_ids: list[str]
    like_count: int
    favorite_count: int
    comment_count: int
    published_at: datetime

    model_config = {"from_attributes": True}


class ContentBrief(BaseModel):
    """Lightweight card for Feed list."""
    id: str
    title: str
    cover_url: str | None
    tags: list[str]
    like_count: int
    favorite_count: int
    published_at: datetime

    model_config = {"from_attributes": True}


class ContentDetailResponse(ContentResponse):
    items: list[LookItemResponse] = Field(default_factory=list)
    shots: list["ShotResponse"] = Field(default_factory=list)


# ===========================================================================
# Land interactions
# ===========================================================================

class InteractionToggleRequest(BaseModel):
    user_identifier: str = Field(default="anonymous", max_length=100)


class InteractionToggleResponse(BaseModel):
    content_id: str
    interaction_type: InteractionType
    active: bool
    count: int


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    user_identifier: str = Field(default="anonymous", max_length=100)


class InteractionResponse(BaseModel):
    id: str
    content_id: str
    type: str
    user_identifier: str
    comment_text: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ===========================================================================
# TryOn
# ===========================================================================

class TryOnCreateRequest(BaseModel):
    user_photo_url: str


class TryOnResponse(BaseModel):
    id: str
    content_id: str
    user_photo_url: str
    result_url: str | None
    status: str
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ===========================================================================
# Land content detail (enriched response for detail page)
# ===========================================================================

class LandContentDetailResponse(ContentResponse):
    """Land 内容详情页响应，含搭配单品列表和互动状态。"""
    items: list[LookItemResponse] = Field(default_factory=list)
    shots: list[ShotResponse] = Field(default_factory=list)
    comments: list[InteractionResponse] = Field(default_factory=list)
    user_liked: bool = False
    user_favorited: bool = False


# ===========================================================================
# Promote (mock)
# ===========================================================================

class PromoteResponse(BaseModel):
    content_id: str
    promote_url: str
    qr_code_url: str | None = None


# ===========================================================================
# Shot generate response (immediate ack)
# ===========================================================================

class ShotGenerateResponse(BaseModel):
    """Returned immediately after submitting a generation task."""
    shot_id: str
    status: str = "queued"


# ===========================================================================
# Feed query params
# ===========================================================================

class FeedQueryParams(BaseModel):
    tag: str | None = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)


# ===========================================================================
# Generic paginated response wrapper
# ===========================================================================

class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    limit: int


# ===========================================================================
# Generic API envelope
# ===========================================================================

class ApiResponse(BaseModel):
    success: bool = True
    data: Any | None = None
    error: str | None = None
