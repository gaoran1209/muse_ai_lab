"""
Generation, publish, and Land interaction services.
"""

from __future__ import annotations

from src.backend.database import get_demo_store
from src.backend.models import new_id, utc_now_iso
from src.backend.schemas import ContentMetrics, ContentRecord, GenerateShotRequest, PublishContentRequest, ShotRecord, TryOnRecord, TryOnRequest
from src.backend.services.canvas_service import ProjectService
from src.backend.services.provider_service import ImageService


class GenerationService:
    @staticmethod
    def generate_shot(project_id: str, board_id: str, payload: GenerateShotRequest) -> ShotRecord:
        project = ProjectService.get_project(project_id)
        board = next((item for item in project.boards if item.id == board_id), None)
        if board is None:
            raise KeyError(board_id)

        image_url = next((slot.image_url for slot in board.slots if slot.image_url), None) or "/example.png"
        source_vendor = payload.vendor or "mock"

        if payload.vendor:
            result = ImageService.generate(vendor=payload.vendor, prompt=payload.prompt, return_format="base64")
            if result.get("success") and result.get("content"):
                image_url = f"data:image/png;base64,{result['content']}"
                source_vendor = payload.vendor

        shot = ShotRecord(
            id=new_id("shot"),
            project_id=project_id,
            board_id=board_id,
            title=f"{board.name} Hero",
            prompt=payload.prompt,
            image_url=image_url,
            source_vendor=source_vendor,
            status="completed",
            adopted=False,
            created_at=utc_now_iso(),
        )
        return ProjectService.save_shot(project_id, shot)

    @staticmethod
    def adopt_shot(project_id: str, shot_id: str, adopted: bool) -> ShotRecord:
        return ProjectService.update_shot(project_id, shot_id, adopted=adopted)


class LandService:
    @staticmethod
    def list_feed() -> list[ContentRecord]:
        snapshot = get_demo_store().read()
        return sorted(snapshot.contents, key=lambda item: item.published_at, reverse=True)

    @staticmethod
    def publish_content(project_id: str, board_id: str, payload: PublishContentRequest) -> ContentRecord:
        def mutator(snapshot):
            project = next((item for item in snapshot.projects if item.id == project_id), None)
            if project is None:
                raise KeyError(project_id)
            board = next((item for item in project.boards if item.id == board_id), None)
            if board is None:
                raise KeyError(board_id)

            selected_shot_ids = payload.shot_ids or [
                shot.id for shot in project.shots if shot.board_id == board_id and shot.adopted
            ]
            selected_shots = [shot for shot in project.shots if shot.id in selected_shot_ids]
            if not selected_shots:
                raise ValueError("No adopted shots available for publishing.")

            content = ContentRecord(
                id=new_id("content"),
                project_id=project_id,
                board_id=board_id,
                shot_ids=[shot.id for shot in selected_shots],
                title=payload.title.strip(),
                description=payload.description.strip(),
                tags=payload.tags or board.tags,
                cover_url=selected_shots[0].image_url,
                published_at=utc_now_iso(),
                metrics=ContentMetrics(),
            )
            snapshot.contents.insert(0, content)
            board.status = "published"
            project.updated_at = utc_now_iso()
            return content

        return get_demo_store().mutate(mutator)

    @staticmethod
    def like_content(content_id: str) -> ContentRecord:
        def mutator(snapshot):
            content = next((item for item in snapshot.contents if item.id == content_id), None)
            if content is None:
                raise KeyError(content_id)
            content.metrics.likes += 1
            return content

        return get_demo_store().mutate(mutator)

    @staticmethod
    def bookmark_content(content_id: str) -> ContentRecord:
        def mutator(snapshot):
            content = next((item for item in snapshot.contents if item.id == content_id), None)
            if content is None:
                raise KeyError(content_id)
            content.metrics.bookmarks += 1
            return content

        return get_demo_store().mutate(mutator)

    @staticmethod
    def create_try_on(content_id: str, payload: TryOnRequest) -> TryOnRecord:
        def mutator(snapshot):
            content = next((item for item in snapshot.contents if item.id == content_id), None)
            if content is None:
                raise KeyError(content_id)
            content.metrics.try_on_requests += 1
            record = TryOnRecord(
                id=new_id("tryon"),
                content_id=content_id,
                image_url=payload.image_url,
                result_image_url=content.cover_url,
                note=payload.note,
                status="completed",
                created_at=utc_now_iso(),
            )
            snapshot.try_on_requests.insert(0, record)
            return record

        return get_demo_store().mutate(mutator)
