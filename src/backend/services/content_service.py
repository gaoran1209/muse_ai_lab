"""
Content publishing service.
"""

from __future__ import annotations

from sqlalchemy.orm import Session, selectinload

from src.backend.models import Content, Look, LookItem, Shot
from src.backend.schemas import ContentDetailResponse, ContentPublishRequest, ContentResponse
from src.backend.services._helpers import (
    DEFAULT_LLM_VENDOR,
    content_to_detail_response,
    content_to_response,
    dumps_json,
    loads_json,
)
from src.backend.services.prompt_templates import render_content_desc_prompt, render_content_title_prompt
from src.backend.services.provider_service import LLMService


class ContentService:
    @staticmethod
    def _get_look(db: Session, look_id: str) -> Look:
        look = (
            db.query(Look)
            .options(selectinload(Look.items).selectinload(LookItem.asset), selectinload(Look.shots))
            .filter(Look.id == look_id)
            .first()
        )
        if look is None:
            raise KeyError(look_id)
        return look

    @staticmethod
    def _generate_copy(look: Look, title: str, description: str | None) -> tuple[str, str]:
        style_tags = loads_json(look.style_tags, [])
        resolved_title = (title or "").strip()
        resolved_description = (description or "").strip()

        if not resolved_title:
            result = LLMService.generate(DEFAULT_LLM_VENDOR, render_content_title_prompt(look.name, style_tags))
            resolved_title = (result.get("content") or "").strip() or f"{look.name} 灵感发布"
        if not resolved_description:
            result = LLMService.generate(
                DEFAULT_LLM_VENDOR,
                render_content_desc_prompt(look.name, look.description, style_tags),
            )
            resolved_description = (result.get("content") or "").strip() or (look.description or "一组可直接发布的风格内容。")
        return resolved_title, resolved_description

    @staticmethod
    def publish_content(db: Session, payload: ContentPublishRequest) -> ContentResponse:
        look = ContentService._get_look(db, payload.look_id)
        if not payload.shot_ids:
            raise ValueError("shot_ids is required for publishing.")

        shots = (
            db.query(Shot)
            .filter(Shot.id.in_(payload.shot_ids))
            .order_by(Shot.created_at.asc())
            .all()
        )
        if len(shots) != len(payload.shot_ids):
            raise ValueError("Some shots do not exist.")
        if any(shot.look_id != look.id for shot in shots):
            raise ValueError("All shots must belong to the same look.")

        title, description = ContentService._generate_copy(look, payload.title, payload.description)
        ordered_shots = [next(shot for shot in shots if shot.id == shot_id) for shot_id in payload.shot_ids]
        cover_url = next((shot.thumbnail_url or shot.url for shot in ordered_shots if shot.url), None)

        content = Content(
            look_id=look.id,
            title=title,
            description=description,
            tags=dumps_json(payload.tags or loads_json(look.style_tags, [])),
            cover_url=cover_url,
            shot_ids=dumps_json(payload.shot_ids),
        )
        db.add(content)
        db.flush()
        for shot in ordered_shots:
            shot.content_id = content.id
        db.commit()
        db.refresh(content)
        return content_to_response(content)

    @staticmethod
    def get_content(db: Session, content_id: str) -> ContentDetailResponse:
        content = (
            db.query(Content)
            .options(
                selectinload(Content.look).selectinload(Look.items).selectinload(LookItem.asset),
                selectinload(Content.shots),
            )
            .filter(Content.id == content_id)
            .first()
        )
        if content is None:
            raise KeyError(content_id)
        return content_to_detail_response(content)
