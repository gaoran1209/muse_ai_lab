"""
Shot generation service for Spark.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session, selectinload

from src.backend.database import SessionLocal
from src.backend.logger import get_logger
from src.backend.models import Look, LookItem, Shot
from src.backend.schemas import ShotAdoptRequest, ShotGenerateRequest, ShotGenerateResponse, ShotResponse
from src.backend.services._helpers import (
    DEFAULT_IMAGE_VENDOR,
    DEFAULT_VIDEO_VENDOR,
    TRANSPARENT_PIXEL_DATA_URL,
    dumps_json,
    image_data_url,
    shot_to_response,
    video_data_url,
)
from src.backend.services.outfit_service import OutfitService
from src.backend.services.prompt_templates import render_shooting_prompt
from src.backend.services.provider_service import ImageService, VideoService

logger = get_logger(__name__)

MODEL_PRESETS = {
    "model_01": "亚洲女性模特，利落短发，168cm，适合都市时装内容。",
    "model_02": "欧洲男性模特，185cm，冷静商业时尚风格。",
    "model_03": "中性模特，极简高级感造型，适合品牌视觉。",
}

SCENE_PRESETS = {
    "scene_01": "城市街拍，自然光，轻微动态，适合通勤风。",
    "scene_02": "白色摄影棚，柔光，正面站姿，适合电商主图。",
    "scene_03": "室内生活方式场景，暖色灯光，适合内容社区分发。",
}


class GenerationService:
    @staticmethod
    def list_project_shots(db: Session, project_id: str) -> list[ShotResponse]:
        OutfitService._get_project(db, project_id)
        shots = (
            db.query(Shot)
            .join(Look, Shot.look_id == Look.id)
            .filter(Look.project_id == project_id)
            .order_by(Shot.created_at.desc())
            .all()
        )
        return [shot_to_response(shot) for shot in shots]

    @staticmethod
    def _get_look(db: Session, look_id: str) -> Look:
        return OutfitService.get_look(db, look_id)

    @staticmethod
    def _preset_description(action: str, preset_id: str | None) -> str | None:
        if not preset_id:
            return None
        if action == "change_model":
            return MODEL_PRESETS.get(preset_id)
        if action == "change_background":
            return SCENE_PRESETS.get(preset_id)
        return MODEL_PRESETS.get(preset_id) or SCENE_PRESETS.get(preset_id)

    @staticmethod
    def _build_prompt(look: Look, payload: ShotGenerateRequest) -> str:
        preset_description = GenerationService._preset_description(payload.action, payload.preset_id)
        return render_shooting_prompt(
            action=payload.action,
            look_name=look.name,
            look_description=look.description,
            preset_description=preset_description,
            custom_prompt=payload.custom_prompt,
            reference_image_url=payload.reference_image_url,
        )

    @staticmethod
    def create_shot(db: Session, look_id: str, payload: ShotGenerateRequest) -> ShotGenerateResponse:
        look = GenerationService._get_look(db, look_id)
        if payload.action == "tryon" and not payload.reference_image_url:
            raise ValueError("reference_image_url is required when action=tryon")

        vendor = payload.vendor or (
            DEFAULT_VIDEO_VENDOR if payload.type == "video" else DEFAULT_IMAGE_VENDOR
        )
        prompt = GenerationService._build_prompt(look, payload)
        shot = Shot(
            look_id=look.id,
            type=payload.type,
            prompt=prompt,
            parameters=dumps_json(
                {
                    "action": payload.action,
                    "preset_id": payload.preset_id,
                    "reference_image_url": payload.reference_image_url,
                    "parameters": payload.parameters,
                }
            ),
            vendor=vendor,
            status="queued",
            adopted=False,
            canvas_position=dumps_json({"x": 420, "y": 180}),
        )
        db.add(shot)
        db.commit()
        db.refresh(shot)
        return ShotGenerateResponse(shot_id=shot.id, status=shot.status)

    @staticmethod
    def process_shot(shot_id: str) -> None:
        db = SessionLocal()
        try:
            shot = (
                db.query(Shot)
                .options(selectinload(Shot.look).selectinload(Look.items).selectinload(LookItem.asset))
                .filter(Shot.id == shot_id)
                .first()
            )
            if shot is None:
                return

            shot.status = "processing"
            db.commit()

            payload = shot.prompt or ""
            params = (shot_to_response(shot).parameters or {}).get("parameters", {})

            if shot.type == "video":
                result = VideoService.generate(shot.vendor or DEFAULT_VIDEO_VENDOR, payload, **params)
                if result.get("success"):
                    shot.url = video_data_url(result.get("content"))
                    shot.thumbnail_url = TRANSPARENT_PIXEL_DATA_URL
                    shot.status = "completed"
                else:
                    shot.status = "failed"
            else:
                params = dict(params)
                meta = shot_to_response(shot).parameters or {}
                reference_image_url = meta.get("reference_image_url")
                if reference_image_url:
                    params.setdefault("images", [reference_image_url])
                result = ImageService.generate(shot.vendor or DEFAULT_IMAGE_VENDOR, payload, **params)
                if result.get("success"):
                    shot.url = image_data_url(result.get("content"))
                    shot.thumbnail_url = shot.url
                    shot.status = "completed"
                else:
                    logger.warning("Image generation failed for shot %s, using fallback image.", shot.id)
                    fallback = next(
                        (item.asset.url for item in shot.look.items if item.asset and item.asset.url),
                        TRANSPARENT_PIXEL_DATA_URL,
                    )
                    shot.url = fallback
                    shot.thumbnail_url = fallback
                    shot.status = "completed"

            db.commit()
        except Exception:
            logger.exception("Failed to process shot %s", shot_id)
            shot = db.query(Shot).filter(Shot.id == shot_id).first()
            if shot is not None:
                shot.status = "failed"
                db.commit()
        finally:
            db.close()

    @staticmethod
    def get_shot(db: Session, shot_id: str) -> ShotResponse:
        shot = db.query(Shot).filter(Shot.id == shot_id).first()
        if shot is None:
            raise KeyError(shot_id)
        return shot_to_response(shot)

    @staticmethod
    def adopt_shot(db: Session, shot_id: str, payload: ShotAdoptRequest) -> ShotResponse:
        shot = db.query(Shot).filter(Shot.id == shot_id).first()
        if shot is None:
            raise KeyError(shot_id)
        shot.adopted = payload.adopted
        db.commit()
        db.refresh(shot)
        return shot_to_response(shot)
