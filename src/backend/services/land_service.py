"""
Muse Land feed, interaction, and try-on service.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session, selectinload

from src.backend.database import SessionLocal
from src.backend.logger import get_logger
from src.backend.models import Content, Interaction, Look, LookItem, TryOnTask
from src.backend.schemas import (
    CommentCreate,
    InteractionToggleRequest,
    InteractionToggleResponse,
    LandContentDetailResponse,
    PaginatedResponse,
    PromoteResponse,
    TryOnCreateRequest,
    TryOnResponse,
)
from src.backend.services._helpers import (
    DEFAULT_IMAGE_VENDOR,
    TRANSPARENT_PIXEL_DATA_URL,
    content_to_brief,
    image_data_url,
    interaction_to_response,
    land_content_to_detail_response,
    loads_json,
    tryon_to_response,
)
from src.backend.services.prompt_templates import render_land_tryon_prompt
from src.backend.services.provider_service import ImageService

logger = get_logger(__name__)


class LandService:
    @staticmethod
    def _get_content(db: Session, content_id: str) -> Content:
        db.expire_all()
        content = (
            db.query(Content)
            .options(
                selectinload(Content.look).selectinload(Look.items).selectinload(LookItem.asset),
                selectinload(Content.interactions),
                selectinload(Content.shots),
                selectinload(Content.tryon_tasks),
            )
            .filter(Content.id == content_id)
            .first()
        )
        if content is None:
            raise KeyError(content_id)
        return content

    @staticmethod
    def list_feed(db: Session, tag: str | None, page: int, limit: int) -> PaginatedResponse:
        query = db.query(Content).order_by(Content.published_at.desc())
        items = query.all()
        if tag:
            items = [item for item in items if tag in loads_json(item.tags, [])]
        total = len(items)
        start = (page - 1) * limit
        paged = items[start:start + limit]
        return PaginatedResponse(
            items=[content_to_brief(item).model_dump() for item in paged],
            total=total,
            page=page,
            limit=limit,
        )

    @staticmethod
    def get_content_detail(db: Session, content_id: str, user_identifier: str) -> LandContentDetailResponse:
        content = LandService._get_content(db, content_id)
        user_liked = any(
            interaction.type == "like" and interaction.user_identifier == user_identifier
            for interaction in content.interactions
        )
        user_favorited = any(
            interaction.type == "favorite" and interaction.user_identifier == user_identifier
            for interaction in content.interactions
        )
        return land_content_to_detail_response(
            content,
            user_liked=user_liked,
            user_favorited=user_favorited,
        )

    @staticmethod
    def toggle_interaction(
        db: Session,
        content_id: str,
        interaction_type: str,
        payload: InteractionToggleRequest,
    ) -> InteractionToggleResponse:
        content = LandService._get_content(db, content_id)
        existing = next(
            (
                interaction
                for interaction in content.interactions
                if interaction.type == interaction_type and interaction.user_identifier == payload.user_identifier
            ),
            None,
        )
        count_field = "like_count" if interaction_type == "like" else "favorite_count"
        if existing is not None:
            db.delete(existing)
            setattr(content, count_field, max(0, getattr(content, count_field) - 1))
            active = False
        else:
            db.add(
                Interaction(
                    content_id=content.id,
                    type=interaction_type,
                    user_identifier=payload.user_identifier,
                )
            )
            setattr(content, count_field, getattr(content, count_field) + 1)
            active = True
        db.commit()
        db.refresh(content)
        return InteractionToggleResponse(
            content_id=content.id,
            interaction_type=interaction_type,
            active=active,
            count=getattr(content, count_field),
        )

    @staticmethod
    def add_comment(db: Session, content_id: str, payload: CommentCreate):
        content = LandService._get_content(db, content_id)
        interaction = Interaction(
            content_id=content.id,
            type="comment",
            user_identifier=payload.user_identifier,
            comment_text=payload.text,
        )
        db.add(interaction)
        content.comment_count += 1
        db.commit()
        db.refresh(interaction)
        return interaction_to_response(interaction)

    @staticmethod
    def create_tryon_task(db: Session, content_id: str, payload: TryOnCreateRequest) -> TryOnResponse:
        content = LandService._get_content(db, content_id)
        task = TryOnTask(
            content_id=content.id,
            user_photo_url=payload.user_photo_url,
            status="queued",
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return tryon_to_response(task)

    @staticmethod
    def process_tryon_task(task_id: str) -> None:
        db = SessionLocal()
        try:
            task = (
                db.query(TryOnTask)
                .options(selectinload(TryOnTask.content))
                .filter(TryOnTask.id == task_id)
                .first()
            )
            if task is None:
                return
            content = LandService._get_content(db, task.content_id)
            task.status = "processing"
            db.commit()

            result = ImageService.generate(
                DEFAULT_IMAGE_VENDOR,
                render_land_tryon_prompt(content.title, content.description, loads_json(content.tags, [])),
                images=[task.user_photo_url],
            )
            if result.get("success"):
                task.result_url = image_data_url(result.get("content"))
            else:
                logger.warning("Try-on generation failed for task %s, using cover image fallback.", task.id)
                task.result_url = content.cover_url or TRANSPARENT_PIXEL_DATA_URL
            task.status = "completed"
            task.completed_at = datetime.now(UTC)
            db.commit()
        except Exception:
            logger.exception("Failed to process try-on task %s", task_id)
            task = db.query(TryOnTask).filter(TryOnTask.id == task_id).first()
            if task is not None:
                task.status = "failed"
                db.commit()
        finally:
            db.close()

    @staticmethod
    def get_tryon_task(db: Session, task_id: str) -> TryOnResponse:
        task = db.query(TryOnTask).filter(TryOnTask.id == task_id).first()
        if task is None:
            raise KeyError(task_id)
        return tryon_to_response(task)

    @staticmethod
    def get_promote_link(db: Session, content_id: str) -> PromoteResponse:
        content = LandService._get_content(db, content_id)
        return PromoteResponse(
            content_id=content.id,
            promote_url=f"https://muse-land.demo/promo/{content.id}",
            qr_code_url=None,
        )
