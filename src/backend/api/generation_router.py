"""
Shot generation API routes.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from src.backend.database import get_db
from src.backend.schemas import ShotAdoptRequest, ShotGenerateRequest, ShotGenerateResponse, ShotResponse, ShotUpdate
from src.backend.services.generation_service import GenerationService

router = APIRouter(tags=["generation"])


@router.get("/api/v1/projects/{project_id}/shots", response_model=list[ShotResponse])
def list_project_shots(project_id: str, db: Session = Depends(get_db)) -> list[ShotResponse]:
    try:
        return GenerationService.list_project_shots(db, project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc


@router.post("/api/v1/looks/{look_id}/generate", response_model=ShotGenerateResponse)
def generate_shot(
    look_id: str,
    payload: ShotGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ShotGenerateResponse:
    try:
        response = GenerationService.create_shot(db, look_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Look not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    background_tasks.add_task(GenerationService.process_shot, response.shot_id)
    return response


@router.get("/api/v1/shots/{shot_id}", response_model=ShotResponse)
def get_shot(shot_id: str, db: Session = Depends(get_db)) -> ShotResponse:
    try:
        return GenerationService.get_shot(db, shot_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Shot not found") from exc


@router.patch("/api/v1/shots/{shot_id}", response_model=ShotResponse)
def update_shot(shot_id: str, payload: ShotUpdate, db: Session = Depends(get_db)) -> ShotResponse:
    try:
        return GenerationService.update_shot(db, shot_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Shot not found") from exc


@router.patch("/api/v1/shots/{shot_id}/adopt", response_model=ShotResponse)
def adopt_shot(shot_id: str, payload: ShotAdoptRequest, db: Session = Depends(get_db)) -> ShotResponse:
    try:
        return GenerationService.adopt_shot(db, shot_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Shot not found") from exc
