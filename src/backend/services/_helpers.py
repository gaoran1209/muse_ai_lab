"""
Shared backend service helpers for JSON fields, prompt fallbacks, and response mapping.
"""

from __future__ import annotations

import base64
import json
from typing import Any

from src.backend.models import Asset, Content, Interaction, Look, LookItem, Project, Shot, TryOnTask
from src.backend.schemas import (
    AssetResponse,
    AssetTags,
    ContentBrief,
    ContentDetailResponse,
    ContentResponse,
    InteractionResponse,
    LandContentDetailResponse,
    LookItemResponse,
    LookResponse,
    ProjectResponse,
    ShotResponse,
    TryOnResponse,
)

DEFAULT_LLM_VENDOR = "gemini"
DEFAULT_IMAGE_VENDOR = "gemini"
DEFAULT_VIDEO_VENDOR = "302ai_kling"

TRANSPARENT_PIXEL_DATA_URL = (
    "data:image/gif;base64,"
    "R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs="
)


def dumps_json(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def loads_json(raw: str | None, default: Any) -> Any:
    if raw in (None, ""):
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def coerce_asset_tags(raw: str | None) -> AssetTags | None:
    payload = loads_json(raw, None)
    if payload is None:
        return None
    return AssetTags.model_validate(payload)


def file_to_data_url(content: bytes, content_type: str | None) -> str:
    mime = content_type or "application/octet-stream"
    encoded = base64.b64encode(content).decode("utf-8")
    return f"data:{mime};base64,{encoded}"


def image_data_url(content: str | None) -> str | None:
    if not content:
        return None
    if content.startswith("data:"):
        return content
    return f"data:image/png;base64,{content}"


def video_data_url(content: str | None) -> str | None:
    if not content:
        return None
    if content.startswith("data:"):
        return content
    return f"data:video/mp4;base64,{content}"


def safe_text(value: str | None, default: str = "") -> str:
    stripped = (value or "").strip()
    return stripped or default


def asset_to_response(asset: Asset) -> AssetResponse:
    return AssetResponse(
        id=asset.id,
        project_id=asset.project_id,
        url=asset.url,
        thumbnail_url=asset.thumbnail_url,
        category=asset.category,
        tags=coerce_asset_tags(asset.tags),
        original_filename=asset.original_filename,
        library_scope=asset.library_scope,
        owner_user_id=asset.owner_user_id,
        source_type=asset.source_type,
        storage_provider=asset.storage_provider,
        storage_key=asset.storage_key,
        status=asset.status,
        created_at=asset.created_at,
        last_used_at=asset.last_used_at,
    )


def look_item_to_response(item: LookItem) -> LookItemResponse:
    return LookItemResponse(
        id=item.id,
        look_id=item.look_id,
        asset_id=item.asset_id,
        category=item.category,
        placeholder_desc=item.placeholder_desc,
        sort_order=item.sort_order,
        asset_url=item.asset.url if item.asset else None,
    )


def look_to_response(look: Look) -> LookResponse:
    items = sorted(look.items, key=lambda item: item.sort_order)
    return LookResponse(
        id=look.id,
        project_id=look.project_id,
        name=look.name,
        description=look.description,
        style_tags=loads_json(look.style_tags, []),
        board_position=loads_json(look.board_position, None),
        items=[look_item_to_response(item) for item in items],
        created_at=look.created_at,
    )


def shot_to_response(shot: Shot) -> ShotResponse:
    return ShotResponse(
        id=shot.id,
        look_id=shot.look_id,
        content_id=shot.content_id,
        type=shot.type,
        url=shot.url,
        thumbnail_url=shot.thumbnail_url,
        prompt=shot.prompt,
        parameters=loads_json(shot.parameters, None),
        vendor=shot.vendor,
        status=shot.status,
        adopted=shot.adopted,
        canvas_position=loads_json(shot.canvas_position, None),
        created_at=shot.created_at,
    )


def content_to_response(content: Content) -> ContentResponse:
    return ContentResponse(
        id=content.id,
        look_id=content.look_id,
        title=content.title,
        description=content.description,
        tags=loads_json(content.tags, []),
        cover_url=content.cover_url,
        shot_ids=loads_json(content.shot_ids, []),
        like_count=content.like_count,
        favorite_count=content.favorite_count,
        comment_count=content.comment_count,
        published_at=content.published_at,
    )


def content_to_brief(content: Content) -> ContentBrief:
    return ContentBrief(
        id=content.id,
        title=content.title,
        cover_url=content.cover_url,
        tags=loads_json(content.tags, []),
        like_count=content.like_count,
        favorite_count=content.favorite_count,
        published_at=content.published_at,
    )


def interaction_to_response(interaction: Interaction) -> InteractionResponse:
    return InteractionResponse(
        id=interaction.id,
        content_id=interaction.content_id,
        type=interaction.type,
        user_identifier=interaction.user_identifier,
        comment_text=interaction.comment_text,
        created_at=interaction.created_at,
    )


def tryon_to_response(task: TryOnTask) -> TryOnResponse:
    return TryOnResponse(
        id=task.id,
        content_id=task.content_id,
        user_photo_url=task.user_photo_url,
        result_url=task.result_url,
        status=task.status,
        created_at=task.created_at,
        completed_at=task.completed_at,
    )


def project_to_response(project: Project) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        name=project.name,
        cover_url=project.cover_url,
        created_at=project.created_at,
        updated_at=project.updated_at,
        asset_count=len(project.assets),
        look_count=len(project.looks),
    )


def content_to_detail_response(content: Content) -> ContentDetailResponse:
    look = content.look
    items = sorted(look.items, key=lambda item: item.sort_order) if look else []
    shot_order = loads_json(content.shot_ids, [])
    indexed = {shot_id: index for index, shot_id in enumerate(shot_order)}
    shots = sorted(content.shots, key=lambda shot: indexed.get(shot.id, len(indexed)))
    return ContentDetailResponse(
        **content_to_response(content).model_dump(),
        items=[look_item_to_response(item) for item in items],
        shots=[shot_to_response(shot) for shot in shots],
    )


def land_content_to_detail_response(
    content: Content,
    *,
    user_liked: bool,
    user_favorited: bool,
) -> LandContentDetailResponse:
    detail = content_to_detail_response(content)
    comments = [
        interaction_to_response(interaction)
        for interaction in sorted(content.interactions, key=lambda record: record.created_at)
        if interaction.type == "comment"
    ]
    return LandContentDetailResponse(
        **detail.model_dump(),
        comments=comments,
        user_liked=user_liked,
        user_favorited=user_favorited,
    )
