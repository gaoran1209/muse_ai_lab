"""
Project domain service.
"""

from __future__ import annotations

from sqlalchemy.orm import Session, selectinload

from src.backend.models import Project
from src.backend.schemas import ProjectCreate, ProjectResponse, ProjectUpdate
from src.backend.services._helpers import project_to_response, safe_text


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
    def delete_project(db: Session, project_id: str) -> None:
        project = ProjectService.get_project(db, project_id)
        db.delete(project)
        db.commit()
