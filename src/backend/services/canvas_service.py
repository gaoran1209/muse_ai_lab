"""
Spark-oriented project, asset, and board services.
"""

from __future__ import annotations

from src.backend.database import get_demo_store
from src.backend.models import infer_asset_metadata, new_id, utc_now_iso
from src.backend.schemas import AssetRecord, AssetTags, BoardRecord, CreateAssetRequest, CreateProjectRequest, ProjectRecord


class ProjectService:
    @staticmethod
    def list_projects() -> list[ProjectRecord]:
        snapshot = get_demo_store().read()
        return sorted(snapshot.projects, key=lambda item: item.updated_at, reverse=True)

    @staticmethod
    def create_project(payload: CreateProjectRequest) -> ProjectRecord:
        def mutator(snapshot):
            now = utc_now_iso()
            project = ProjectRecord(
                id=new_id("project"),
                name=payload.name.strip() or "Untitled Project",
                summary=payload.summary.strip() or "A fresh Spark workspace for look exploration.",
                cover_url=None,
                status="draft",
                assets=[],
                boards=[],
                shots=[],
                updated_at=now,
            )
            snapshot.projects.insert(0, project)
            return project

        return get_demo_store().mutate(mutator)

    @staticmethod
    def get_project(project_id: str) -> ProjectRecord:
        snapshot = get_demo_store().read()
        project = next((item for item in snapshot.projects if item.id == project_id), None)
        if project is None:
            raise KeyError(project_id)
        return project

    @staticmethod
    def add_asset(project_id: str, payload: CreateAssetRequest) -> AssetRecord:
        def mutator(snapshot):
            project = next((item for item in snapshot.projects if item.id == project_id), None)
            if project is None:
                raise KeyError(project_id)

            inferred = infer_asset_metadata(payload.name, payload.category)
            asset = AssetRecord(
                id=new_id("asset"),
                name=payload.name.strip(),
                image_url=payload.image_url,
                tags=AssetTags(
                    category=payload.category or inferred["category"],
                    colors=payload.colors or inferred["colors"],
                    styles=payload.styles or inferred["styles"],
                    seasons=payload.seasons or inferred["seasons"],
                    occasions=payload.occasions or inferred["occasions"],
                ),
                created_at=utc_now_iso(),
            )
            project.assets.insert(0, asset)
            project.cover_url = project.cover_url or asset.image_url
            project.updated_at = utc_now_iso()
            return asset

        return get_demo_store().mutate(mutator)

    @staticmethod
    def save_boards(project_id: str, boards: list[BoardRecord]) -> list[BoardRecord]:
        def mutator(snapshot):
            project = next((item for item in snapshot.projects if item.id == project_id), None)
            if project is None:
                raise KeyError(project_id)
            project.boards = [*boards, *project.boards]
            project.updated_at = utc_now_iso()
            return boards

        return get_demo_store().mutate(mutator)

    @staticmethod
    def save_shot(project_id: str, shot):
        def mutator(snapshot):
            project = next((item for item in snapshot.projects if item.id == project_id), None)
            if project is None:
                raise KeyError(project_id)
            project.shots.insert(0, shot)
            project.updated_at = utc_now_iso()
            return shot

        return get_demo_store().mutate(mutator)

    @staticmethod
    def update_shot(project_id: str, shot_id: str, *, adopted: bool):
        def mutator(snapshot):
            project = next((item for item in snapshot.projects if item.id == project_id), None)
            if project is None:
                raise KeyError(project_id)
            shot = next((item for item in project.shots if item.id == shot_id), None)
            if shot is None:
                raise KeyError(shot_id)
            shot.adopted = adopted
            project.updated_at = utc_now_iso()
            return shot

        return get_demo_store().mutate(mutator)
