"""
Asset domain service.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.backend.config import config
from src.backend.models import Asset, ProjectAsset
from src.backend.schemas import AssetLinkRequest, AssetResponse, AssetTags, AssetUpdate
from src.backend.services._helpers import DEFAULT_LLM_VENDOR, asset_to_response, dumps_json
from src.backend.services.prompt_templates import render_asset_tagging_prompt
from src.backend.services.project_service import ProjectService
from src.backend.services.provider_service import LLMService
from src.backend.utils import upload_local_image


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


def _detect_image_extension(content: bytes, content_type: str | None, filename: str) -> str:
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if content.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if content.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return ".webp"

    lowered_type = (content_type or "").lower()
    mapped = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    if lowered_type in mapped:
        return mapped[lowered_type]

    lowered_name = filename.lower()
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        if lowered_name.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext

    raise ValueError("Only png/jpg/webp/gif images are supported.")


def _store_uploaded_asset(project_id: str, filename: str, content_type: str | None, content: bytes) -> dict[str, str]:
    extension = _detect_image_extension(content, content_type, filename)
    project_dir = Path(config.MEDIA_ROOT) / "assets" / project_id
    project_dir.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex}{extension}"
    stored_path = project_dir / stored_name
    stored_path.write_bytes(content)
    public_url = f"/media/assets/{project_id}/{stored_name}"
    return {
        "local_path": str(stored_path),
        "local_url": public_url,
        "extension": extension,
    }


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _delete_media_file(path_or_url: str | None) -> None:
    if not path_or_url or not path_or_url.startswith("/media/"):
        return
    relative = path_or_url.removeprefix("/media/")
    path = Path(config.MEDIA_ROOT) / relative
    if path.exists():
        path.unlink()


def _extract_storage_key(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.scheme in {"http", "https"}:
        return parsed.path.lstrip("/") or None
    if url.startswith("/media/"):
        return url.removeprefix("/media/")
    return None


def _build_oss_config() -> str | None:
    if not config.oss_enabled:
        return None
    payload = {
        "endpoint": config.OSS_ENDPOINT,
        "bucket_name": config.OSS_BUCKET_NAME,
        "access_key_id": config.OSS_ACCESS_KEY_ID,
        "secret_access_key": config.OSS_SECRET_ACCESS_KEY,
        "display_host": config.OSS_DISPLAY_HOST or "",
        "remote_dir": config.OSS_REMOTE_DIR,
    }
    return json.dumps(payload)


def _persist_uploaded_asset(project_id: str, filename: str, content_type: str | None, content: bytes) -> dict[str, str]:
    stored = _store_uploaded_asset(project_id, filename, content_type, content)
    local_url = stored["local_url"]
    local_path = stored["local_path"]

    oss_config = _build_oss_config()
    if not oss_config:
        return {
            "url": local_url,
            "thumbnail_url": local_url,
            "storage_provider": "local",
            "storage_key": _extract_storage_key(local_url) or "",
        }

    try:
        remote_url = upload_local_image(local_path, oss_config)
    except Exception:
        return {
            "url": local_url,
            "thumbnail_url": local_url,
            "storage_provider": "local",
            "storage_key": _extract_storage_key(local_url) or "",
        }

    Path(local_path).unlink(missing_ok=True)

    return {
        "url": remote_url,
        "thumbnail_url": remote_url,
        "storage_provider": "oss",
        "storage_key": _extract_storage_key(remote_url) or "",
    }


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
    DEFAULT_OWNER_USER_ID = "demo_user_001"

    @staticmethod
    def _ensure_project_link(db: Session, project_id: str, asset_id: str) -> None:
        exists = (
            db.query(ProjectAsset)
            .filter(ProjectAsset.project_id == project_id, ProjectAsset.asset_id == asset_id)
            .first()
        )
        if exists is None:
            db.add(ProjectAsset(project_id=project_id, asset_id=asset_id))

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
        return AssetService.upload_library_assets(db, project_id, files)

    @staticmethod
    def upload_library_assets(
        db: Session,
        project_id: str,
        files: list[tuple[str, str | None, bytes]],
        owner_user_id: str | None = None,
    ) -> list[AssetResponse]:
        ProjectService.get_project(db, project_id)
        created: list[Asset] = []
        owner = owner_user_id or AssetService.DEFAULT_OWNER_USER_ID
        for filename, content_type, content in files:
            stored = _persist_uploaded_asset(project_id, filename, content_type, content)
            tags = AssetService.auto_tag_asset(filename)
            asset = Asset(
                project_id=project_id,
                url=stored["url"],
                thumbnail_url=stored["thumbnail_url"],
                category=tags.category,
                tags=dumps_json(tags.model_dump()),
                original_filename=filename,
                library_scope="user",
                owner_user_id=owner,
                source_type="upload",
                storage_provider=stored["storage_provider"],
                storage_key=stored["storage_key"],
                status="active",
                last_used_at=_utcnow(),
            )
            db.add(asset)
            db.flush()
            AssetService._ensure_project_link(db, project_id, asset.id)
            created.append(asset)

        db.commit()
        for asset in created:
            db.refresh(asset)
        return [asset_to_response(asset) for asset in created]

    @staticmethod
    def list_library_assets(
        db: Session,
        scope: str = "all",
        category: str | None = None,
        owner_user_id: str | None = None,
    ) -> list[AssetResponse]:
        owner = owner_user_id or AssetService.DEFAULT_OWNER_USER_ID
        query = db.query(Asset).filter(Asset.status != "deleted")
        if scope == "public":
            query = query.filter(Asset.library_scope == "public")
        elif scope == "user":
            query = query.filter(Asset.library_scope == "user", Asset.owner_user_id == owner)
        else:
            query = query.filter(
                or_(
                    Asset.library_scope == "public",
                    (Asset.library_scope == "user") & (Asset.owner_user_id == owner),
                )
            )
        if category:
            query = query.filter(Asset.category == category)
        assets = query.order_by(Asset.last_used_at.desc().nullslast(), Asset.created_at.desc()).all()
        return [asset_to_response(asset) for asset in assets]

    @staticmethod
    def list_assets(db: Session, project_id: str, category: str | None = None) -> list[AssetResponse]:
        project = ProjectService.get_project(db, project_id)
        assets = list(project.assets)
        if category:
            assets = [asset for asset in assets if asset.category == category]
        assets.sort(key=lambda asset: asset.created_at, reverse=True)
        return [asset_to_response(asset) for asset in assets]

    @staticmethod
    def link_asset_to_project(db: Session, project_id: str, payload: AssetLinkRequest) -> AssetResponse:
        ProjectService.get_project(db, project_id)
        asset = AssetService.get_asset(db, payload.asset_id)
        AssetService._ensure_project_link(db, project_id, asset.id)
        asset.last_used_at = _utcnow()
        db.commit()
        db.refresh(asset)
        return asset_to_response(asset)

    @staticmethod
    def unlink_asset_from_project(db: Session, project_id: str, asset_id: str) -> None:
        ProjectService.get_project(db, project_id)
        link = (
            db.query(ProjectAsset)
            .filter(ProjectAsset.project_id == project_id, ProjectAsset.asset_id == asset_id)
            .first()
        )
        if link is None:
            raise KeyError(asset_id)
        db.delete(link)
        db.commit()

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
        if payload.original_filename is not None:
            asset.original_filename = payload.original_filename
        asset.tags = dumps_json(current_tags.model_dump())
        db.commit()
        db.refresh(asset)
        return asset_to_response(asset)

    @staticmethod
    def delete_asset(db: Session, asset_id: str) -> None:
        asset = AssetService.get_asset(db, asset_id)
        if asset.library_scope == "public":
            raise ValueError("Public assets cannot be deleted.")
        _delete_media_file(asset.url)
        if asset.thumbnail_url != asset.url:
            _delete_media_file(asset.thumbnail_url)
        db.delete(asset)
        db.commit()
