"""
Look board recommendation service for the Spark workspace.
"""

from __future__ import annotations

from src.backend.models import new_id, utc_now_iso
from src.backend.schemas import BoardRecord, BoardSlot, RecommendBoardsRequest
from src.backend.services.canvas_service import ProjectService


def _collect_tags(selected_assets) -> list[str]:
    tags: list[str] = []
    for asset in selected_assets:
        for group in (asset.tags.styles, asset.tags.colors, asset.tags.seasons):
            for item in group:
                if item not in tags:
                    tags.append(item)
    return tags[:4] or ["fashion", "demo"]


class OutfitService:
    BOARD_BLUEPRINTS = (
        ("City Layer", "Structured anchor with softened balance for an editorial street look."),
        ("After Hours", "Sharper shape language with a polished finish for quick publishing."),
        ("Weekend Edit", "Relaxed proportions tuned for social-first fashion content."),
    )

    @classmethod
    def recommend_boards(cls, project_id: str, payload: RecommendBoardsRequest) -> list[BoardRecord]:
        project = ProjectService.get_project(project_id)
        selected_assets = [
            asset for asset in project.assets if asset.id in payload.asset_ids
        ] or project.assets[:2]
        tags = _collect_tags(selected_assets)
        now = utc_now_iso()

        boards: list[BoardRecord] = []
        for index in range(payload.board_count):
            title_prefix, description = cls.BOARD_BLUEPRINTS[index]
            slots: list[BoardSlot] = []
            for asset in selected_assets[:3]:
                slots.append(
                    BoardSlot(
                        id=new_id("slot"),
                        label=asset.name,
                        asset_id=asset.id,
                        image_url=asset.image_url,
                        source="asset",
                        note=f"Keep {asset.tags.category} as a visible styling anchor.",
                    )
                )

            if payload.mode == "complete" and len(slots) < 3:
                slots.append(
                    BoardSlot(
                        id=new_id("slot"),
                        label="Suggested Addition",
                        asset_id=None,
                        image_url=None,
                        source="placeholder",
                        note="Suggested addition: tonal shoe or compact bag to finish the look.",
                    )
                )

            boards.append(
                BoardRecord(
                    id=new_id("board"),
                    project_id=project_id,
                    name=f"{title_prefix} {index + 1:02d}",
                    description=description,
                    tags=tags,
                    asset_ids=[asset.id for asset in selected_assets],
                    slots=slots,
                    status="ready",
                    created_at=now,
                    updated_at=now,
                )
            )

        return ProjectService.save_boards(project_id, boards)
