"""
Look generation and management service.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session, selectinload

from src.backend.models import Asset, Look, LookItem, Project
from src.backend.schemas import AssetTags, LookGenerateRequest, LookGenerateResponse, LookItemUpdate, LookResponse, LookUpdate
from src.backend.logger import get_logger
from src.backend.services._helpers import DEFAULT_IMAGE_VENDOR, DEFAULT_LLM_VENDOR, dumps_json, image_data_url, loads_json, look_to_response
from src.backend.services.prompt_templates import render_outfit_prompt, summarize_asset_tags
from src.backend.services.provider_service import ImageService, LLMService

logger = get_logger(__name__)


def _extract_json_object(content: str) -> dict[str, Any] | None:
    match = re.search(r"\{.*\}", content, re.S)
    if not match:
        return None
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if isinstance(payload, dict):
        return payload
    return None


class OutfitService:
    CATEGORY_ORDER = ["top", "bottom", "dress", "shoes", "bag", "accessory"]

    @staticmethod
    def _get_project(db: Session, project_id: str) -> Project:
        project = (
            db.query(Project)
            .options(selectinload(Project.assets), selectinload(Project.looks).selectinload(Look.items))
            .filter(Project.id == project_id)
            .first()
        )
        if project is None:
            raise KeyError(project_id)
        return project

    @staticmethod
    def _asset_tags(asset: Asset) -> AssetTags:
        return AssetTags.model_validate(loads_json(asset.tags, {"category": asset.category}))

    @staticmethod
    def _decide_mode(payload: LookGenerateRequest, selected_assets: list[Asset]) -> str:
        if payload.mode != "auto":
            return payload.mode
        product_assets = [asset for asset in selected_assets if asset.category == "product"]
        if len(product_assets) <= 2:
            return "complete"
        return "group"

    @staticmethod
    def _style_tags(assets: list[Asset]) -> list[str]:
        tags: list[str] = []
        for asset in assets:
            asset_tags = OutfitService._asset_tags(asset)
            for candidate in (asset_tags.style, asset_tags.season, asset_tags.occasion, asset_tags.color):
                if candidate and candidate not in tags:
                    tags.append(candidate)
        return tags[:4] or ["fashion", "editorial"]

    @staticmethod
    def _llm_look_meta(selected_assets: list[Asset], mode: str) -> tuple[str, str, list[str]] | None:
        summary = "\n".join(
            summarize_asset_tags(asset.original_filename or asset.id, OutfitService._asset_tags(asset))
            for asset in selected_assets
        )
        prompt = render_outfit_prompt(mode, summary)
        result = LLMService.generate(DEFAULT_LLM_VENDOR, prompt)
        if not result.get("success") or not result.get("content"):
            return None
        payload = _extract_json_object(result["content"])
        if payload is None:
            return None
        name = (payload.get("name") or "").strip()
        description = (payload.get("description") or "").strip()
        style_tags = [str(item).strip() for item in payload.get("style_tags", []) if str(item).strip()]
        if not name:
            return None
        return name, description, style_tags

    @staticmethod
    def _build_items(project_assets: list[Asset], selected_assets: list[Asset], mode: str, look_index: int) -> list[LookItemUpdate]:
        grouped: dict[str, list[Asset]] = defaultdict(list)
        for asset in project_assets:
            tags = OutfitService._asset_tags(asset)
            if asset.category != "product":
                continue
            subcategory = tags.subcategory or "top"
            grouped[subcategory].append(asset)

        chosen_items: list[LookItemUpdate] = []
        used_asset_ids: set[str] = set()

        for order, category in enumerate(OutfitService.CATEGORY_ORDER):
            candidates = grouped.get(category, [])
            if not candidates:
                if category in {"shoes", "bag", "accessory"} or mode == "complete":
                    chosen_items.append(
                        LookItemUpdate(
                            category=category,
                            placeholder_desc=f"建议补充一件适合该风格的{category}",
                            sort_order=order,
                        )
                    )
                continue

            offset = (look_index + order) % len(candidates)
            selected = None
            for index in range(len(candidates)):
                candidate = candidates[(offset + index) % len(candidates)]
                if candidate.id not in used_asset_ids:
                    selected = candidate
                    break
            if selected is None:
                selected = candidates[offset]
            used_asset_ids.add(selected.id)
            chosen_items.append(
                LookItemUpdate(
                    asset_id=selected.id,
                    category=category,
                    placeholder_desc=None,
                    sort_order=order,
                )
            )

        if not chosen_items:
            for order, asset in enumerate(selected_assets[:3]):
                tags = OutfitService._asset_tags(asset)
                chosen_items.append(
                    LookItemUpdate(
                        asset_id=asset.id,
                        category=tags.subcategory or "top",
                        placeholder_desc=None,
                        sort_order=order,
                    )
                )
        return chosen_items

    @staticmethod
    def _fill_placeholder_items(db: Session, project_id: str, looks: list[Look], style_tags: list[str]) -> None:
        """Generate images for LookItems that have placeholder_desc but no asset.

        PRD 5.1.4.4: 如商品图是上衣，则调用图像生成模型生成对应裤子和鞋子的效果图。
        """
        CATEGORY_LABELS = {
            "top": "上衣",
            "bottom": "裤子/下装",
            "dress": "连衣裙",
            "shoes": "鞋子",
            "bag": "包袋",
            "accessory": "配饰",
        }

        placeholder_items: list[LookItem] = []
        for look in looks:
            for item in look.items:
                if item.placeholder_desc and not item.asset_id:
                    placeholder_items.append(item)

        if not placeholder_items:
            return

        style_hint = "、".join(style_tags[:3]) if style_tags else "时尚"
        for item in placeholder_items:
            label = CATEGORY_LABELS.get(item.category, item.category or "单品")
            prompt = (
                f"专业电商产品图，白色背景，干净简约，一件{label}，"
                f"风格：{style_hint}，适合搭配穿搭内容。高品质商业摄影，无模特。"
            )
            try:
                result = ImageService.generate(DEFAULT_IMAGE_VENDOR, prompt)
                if not result.get("success") or not result.get("content"):
                    logger.warning("Failed to generate placeholder image for item %s", item.id)
                    continue

                url = image_data_url(result["content"])
                if not url:
                    continue

                asset = Asset(
                    project_id=project_id,
                    url=url,
                    thumbnail_url=url,
                    category="product",
                    tags=dumps_json({
                        "category": "product",
                        "subcategory": item.category,
                        "style": style_hint,
                    }),
                    original_filename=f"AI 生成 - {label}",
                )
                db.add(asset)
                db.flush()

                item.asset_id = asset.id
                item.placeholder_desc = None
            except Exception:
                logger.exception("Error generating placeholder image for item %s", item.id)

        db.commit()

    @staticmethod
    def generate_looks(db: Session, project_id: str, payload: LookGenerateRequest) -> LookGenerateResponse:
        project = OutfitService._get_project(db, project_id)
        selected_assets = [asset for asset in project.assets if asset.id in payload.asset_ids]
        if not selected_assets:
            selected_assets = list(project.assets[:3])
        if not selected_assets:
            raise ValueError("At least one asset is required to generate looks.")

        mode = OutfitService._decide_mode(payload, selected_assets)
        looks: list[Look] = []

        for index in range(payload.count):
            items = OutfitService._build_items(list(project.assets), selected_assets, mode, index)
            meta = OutfitService._llm_look_meta(selected_assets, mode)
            style_tags = meta[2] if meta and meta[2] else OutfitService._style_tags(selected_assets)
            name = meta[0] if meta else f"{style_tags[0].title()} Look {index + 1}"
            description = meta[1] if meta and meta[1] else f"围绕 {'、'.join(style_tags[:2])} 打造的内容型搭配方案。"
            look = Look(
                project_id=project_id,
                name=name,
                description=description,
                style_tags=dumps_json(style_tags),
                board_position=dumps_json(
                    {"x": 80 + index * 80, "y": 120 + index * 60, "width": 320, "height": 440}
                ),
            )
            db.add(look)
            db.flush()

            for item in items:
                db.add(
                    LookItem(
                        look_id=look.id,
                        asset_id=item.asset_id,
                        category=item.category,
                        placeholder_desc=item.placeholder_desc,
                        sort_order=item.sort_order,
                    )
                )
            looks.append(look)

        db.commit()
        for look in looks:
            db.refresh(look)

        # PRD 5.1.4.4: 为缺失品类生成单品效果图
        hydrated = (
            db.query(Look)
            .options(selectinload(Look.items).selectinload(LookItem.asset))
            .filter(Look.id.in_([look.id for look in looks]))
            .order_by(Look.created_at.desc())
            .all()
        )
        hydrated.reverse()

        all_style_tags = style_tags if looks else []
        try:
            OutfitService._fill_placeholder_items(db, project_id, hydrated, all_style_tags)
        except Exception:
            logger.exception("Placeholder image generation failed, looks still usable")

        # Re-hydrate after potential asset creation
        hydrated = (
            db.query(Look)
            .options(selectinload(Look.items).selectinload(LookItem.asset))
            .filter(Look.id.in_([look.id for look in looks]))
            .order_by(Look.created_at.desc())
            .all()
        )
        hydrated.reverse()
        return LookGenerateResponse(looks=[look_to_response(look) for look in hydrated])

    @staticmethod
    def list_looks(db: Session, project_id: str) -> list[LookResponse]:
        OutfitService._get_project(db, project_id)
        looks = (
            db.query(Look)
            .options(selectinload(Look.items).selectinload(LookItem.asset))
            .filter(Look.project_id == project_id)
            .order_by(Look.created_at.desc())
            .all()
        )
        return [look_to_response(look) for look in looks]

    @staticmethod
    def get_look(db: Session, look_id: str) -> Look:
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
    def update_look(db: Session, look_id: str, payload: LookUpdate) -> LookResponse:
        look = OutfitService.get_look(db, look_id)
        if payload.name is not None:
            look.name = payload.name.strip() or look.name
        if payload.description is not None:
            look.description = payload.description.strip() or None
        if payload.style_tags is not None:
            look.style_tags = dumps_json(payload.style_tags)
        if payload.board_position is not None:
            look.board_position = dumps_json(payload.board_position)
        if payload.items is not None:
            for item in list(look.items):
                db.delete(item)
            db.flush()
            for item in payload.items:
                db.add(
                    LookItem(
                        look_id=look.id,
                        asset_id=item.asset_id,
                        category=item.category,
                        placeholder_desc=item.placeholder_desc,
                        sort_order=item.sort_order,
                    )
                )
        db.commit()
        db.refresh(look)
        return look_to_response(OutfitService.get_look(db, look_id))

    @staticmethod
    def delete_look(db: Session, look_id: str) -> None:
        look = OutfitService.get_look(db, look_id)
        db.delete(look)
        db.commit()
