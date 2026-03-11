"""
Asset domain service.
"""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy.orm import Session

from src.backend.models import Asset
from src.backend.schemas import AssetResponse, AssetTags, AssetUpdate
from src.backend.services._helpers import DEFAULT_LLM_VENDOR, asset_to_response, dumps_json, file_to_data_url
from src.backend.services.prompt_templates import render_asset_tagging_prompt
from src.backend.services.project_service import ProjectService
from src.backend.services.provider_service import LLMService


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _extract_json_object(content: str) -> dict[str, Any] | None:
    match = re.search(r"\{.*\}", content, re.S)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if isinstance(parsed, dict):
        return parsed
    return None


def _heuristic_tags(filename: str) -> AssetTags:
    normalized = _normalize_text(filename)

    category = "product"
    if any(token in normalized for token in ("model", "person", "girl", "boy", "woman", "man")):
        category = "model"
    elif any(token in normalized for token in ("background", "scene", "street", "studio")):
        category = "background"
    elif any(token in normalized for token in ("pose", "action", "gesture")):
        category = "pose"

    subcategory = None
    if category == "product":
        mapping = {
            "dress": ("dress",),
            "shoes": ("shoe", "sneaker", "heel", "boot"),
            "bag": ("bag", "tote", "purse"),
            "bottom": ("pant", "trouser", "jean", "skirt", "short"),
            "top": ("shirt", "tee", "jacket", "coat", "top", "hoodie", "knit"),
            "accessory": ("hat", "belt", "scarf", "necklace", "ring", "earring"),
        }
        for name, keywords in mapping.items():
            if any(keyword in normalized for keyword in keywords):
                subcategory = name
                break

    def detect(choices: dict[str, tuple[str, ...]]) -> str | None:
        for label, keywords in choices.items():
            if any(keyword in normalized for keyword in keywords):
                return label
        return None

    color = detect(
        {
            "black": ("black",),
            "white": ("white",),
            "blue": ("blue", "navy"),
            "red": ("red", "burgundy"),
            "green": ("green", "olive"),
            "beige": ("beige", "khaki", "tan"),
        }
    )
    style = detect(
        {
            "casual": ("casual", "daily", "denim"),
            "minimal": ("minimal", "clean"),
            "street": ("street", "urban"),
            "elegant": ("elegant", "tailored", "formal"),
            "sport": ("sport", "active", "running"),
        }
    )
    season = detect(
        {
            "spring": ("spring",),
            "summer": ("summer",),
            "autumn": ("autumn", "fall"),
            "winter": ("winter",),
        }
    )
    occasion = detect(
        {
            "work": ("office", "work", "formal"),
            "weekend": ("weekend", "casual", "daily"),
            "party": ("party", "night", "evening"),
            "travel": ("travel", "holiday", "vacation"),
        }
    )

    return AssetTags(
        category=category,
        subcategory=subcategory,
        color=color,
        style=style,
        season=season,
        occasion=occasion,
    )


class AssetService:
    @staticmethod
    def auto_tag_asset(filename: str) -> AssetTags:
        fallback = _heuristic_tags(filename)
        prompt = render_asset_tagging_prompt(filename, fallback.category)
        result = LLMService.generate(DEFAULT_LLM_VENDOR, prompt)
        if not result.get("success") or not result.get("content"):
            return fallback

        payload = _extract_json_object(result["content"])
        if payload is None:
            return fallback

        try:
            candidate = AssetTags.model_validate(payload)
        except Exception:
            return fallback

        merged = candidate.model_dump()
        for key, value in fallback.model_dump().items():
            if merged.get(key) in (None, "", []):
                merged[key] = value
        return AssetTags.model_validate(merged)

    @staticmethod
    def upload_assets(
        db: Session,
        project_id: str,
        files: list[tuple[str, str | None, bytes]],
    ) -> list[AssetResponse]:
        ProjectService.get_project(db, project_id)
        created: list[Asset] = []
        for filename, content_type, content in files:
            url = file_to_data_url(content, content_type)
            tags = AssetService.auto_tag_asset(filename)
            asset = Asset(
                project_id=project_id,
                url=url,
                thumbnail_url=url,
                category=tags.category,
                tags=dumps_json(tags.model_dump()),
                original_filename=filename,
            )
            db.add(asset)
            created.append(asset)

        db.commit()
        for asset in created:
            db.refresh(asset)
        return [asset_to_response(asset) for asset in created]

    @staticmethod
    def list_assets(db: Session, project_id: str, category: str | None = None) -> list[AssetResponse]:
        ProjectService.get_project(db, project_id)
        query = db.query(Asset).filter(Asset.project_id == project_id).order_by(Asset.created_at.desc())
        if category:
            query = query.filter(Asset.category == category)
        return [asset_to_response(asset) for asset in query.all()]

    @staticmethod
    def get_asset(db: Session, asset_id: str) -> Asset:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if asset is None:
            raise KeyError(asset_id)
        return asset

    @staticmethod
    def update_asset(db: Session, asset_id: str, payload: AssetUpdate) -> AssetResponse:
        asset = AssetService.get_asset(db, asset_id)
        current_tags = AssetTags.model_validate(
            json.loads(asset.tags) if asset.tags else AssetTags(category=asset.category).model_dump()
        )
        if payload.category is not None:
            asset.category = payload.category
            current_tags.category = payload.category
        if payload.tags is not None:
            current_tags = payload.tags
            asset.category = payload.tags.category
        asset.tags = dumps_json(current_tags.model_dump())
        db.commit()
        db.refresh(asset)
        return asset_to_response(asset)

    @staticmethod
    def delete_asset(db: Session, asset_id: str) -> None:
        asset = AssetService.get_asset(db, asset_id)
        db.delete(asset)
        db.commit()
