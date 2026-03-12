"""
Project domain service.
"""

from __future__ import annotations

from sqlalchemy.orm import Session, selectinload

from src.backend.models import Look, LookItem, Project, ProjectAsset, Shot
from src.backend.schemas import ProjectCanvasStateResponse, ProjectCanvasStateUpdate, ProjectCreate, ProjectResponse, ProjectUpdate
from src.backend.services._helpers import dumps_json, loads_json, project_to_response, safe_text


class ProjectService:
    @staticmethod
    def list_projects(db: Session) -> list[ProjectResponse]:
        projects = (
            db.query(Project)
            .options(selectinload(Project.assets), selectinload(Project.looks))
            .order_by(Project.updated_at.desc())
            .all()
        )
        return [project_to_response(project) for project in projects]

    @staticmethod
    def create_project(db: Session, payload: ProjectCreate) -> ProjectResponse:
        project = Project(name=safe_text(payload.name, "Untitled Project"))
        db.add(project)
        db.commit()
        db.refresh(project)
        return project_to_response(project)

    @staticmethod
    def get_project(db: Session, project_id: str) -> Project:
        project = (
            db.query(Project)
            .options(selectinload(Project.assets), selectinload(Project.looks))
            .filter(Project.id == project_id)
            .first()
        )
        if project is None:
            raise KeyError(project_id)
        return project

    @staticmethod
    def get_project_response(db: Session, project_id: str) -> ProjectResponse:
        return project_to_response(ProjectService.get_project(db, project_id))

    @staticmethod
    def update_project(db: Session, project_id: str, payload: ProjectUpdate) -> ProjectResponse:
        project = ProjectService.get_project(db, project_id)
        if payload.name is not None:
            project.name = safe_text(payload.name, project.name)
        if payload.cover_url is not None:
            project.cover_url = payload.cover_url
        db.commit()
        db.refresh(project)
        return project_to_response(project)

    @staticmethod
    def get_canvas_state(db: Session, project_id: str) -> ProjectCanvasStateResponse:
        project = ProjectService.get_project(db, project_id)
        return ProjectCanvasStateResponse(
            project_id=project.id,
            canvas_state=loads_json(project.canvas_state, None),
        )

    @staticmethod
    def update_canvas_state(
        db: Session,
        project_id: str,
        payload: ProjectCanvasStateUpdate,
    ) -> ProjectCanvasStateResponse:
        project = ProjectService.get_project(db, project_id)
        project.canvas_state = dumps_json(payload.canvas_state)
        db.commit()
        db.refresh(project)
        return ProjectCanvasStateResponse(
            project_id=project.id,
            canvas_state=loads_json(project.canvas_state, None),
        )

    @staticmethod
    def delete_project(db: Session, project_id: str) -> None:
        project = ProjectService.get_project(db, project_id)
        db.delete(project)
        db.commit()

    @staticmethod
    def duplicate_project(db: Session, project_id: str) -> ProjectResponse:
        source = (
            db.query(Project)
            .options(
                selectinload(Project.assets),
                selectinload(Project.asset_links),
                selectinload(Project.looks).selectinload(Look.items),
                selectinload(Project.looks).selectinload(Look.shots),
            )
            .filter(Project.id == project_id)
            .first()
        )
        if source is None:
            raise KeyError(project_id)

        duplicate = Project(
            name=safe_text(f"{source.name} Copy", "Untitled Project Copy"),
            cover_url=source.cover_url,
            canvas_state=source.canvas_state,
        )
        db.add(duplicate)
        db.flush()

        for link in source.asset_links:
            db.add(ProjectAsset(project_id=duplicate.id, asset_id=link.asset_id))

        for look in source.looks:
            copied_look = Look(
                project_id=duplicate.id,
                name=look.name,
                description=look.description,
                style_tags=look.style_tags,
                board_position=look.board_position,
            )
            db.add(copied_look)
            db.flush()

            for item in look.items:
                db.add(
                    LookItem(
                        look_id=copied_look.id,
                        asset_id=item.asset_id,
                        category=item.category,
                        placeholder_desc=item.placeholder_desc,
                        sort_order=item.sort_order,
                    )
                )

            for shot in look.shots:
                db.add(
                    Shot(
                        look_id=copied_look.id,
                        type=shot.type,
                        url=shot.url,
                        thumbnail_url=shot.thumbnail_url,
                        prompt=shot.prompt,
                        parameters=shot.parameters,
                        vendor=shot.vendor,
                        status=shot.status,
                        adopted=shot.adopted,
                        canvas_position=shot.canvas_position,
                    )
                )

        db.commit()
        db.refresh(duplicate)
        return project_to_response(ProjectService.get_project(db, duplicate.id))
