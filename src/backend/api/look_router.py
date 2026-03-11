"""
Look API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from src.backend.database import get_db
from src.backend.schemas import LookGenerateRequest, LookGenerateResponse, LookResponse, LookUpdate
from src.backend.services.outfit_service import OutfitService

router = APIRouter(tags=["looks"])


@router.post("/api/v1/projects/{project_id}/looks/generate", response_model=LookGenerateResponse, status_code=status.HTTP_201_CREATED)
def generate_looks(
    project_id: str,
    payload: LookGenerateRequest,
    db: Session = Depends(get_db),
) -> LookGenerateResponse:
    try:
        return OutfitService.generate_looks(db, project_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/v1/projects/{project_id}/looks", response_model=list[LookResponse])
def list_looks(project_id: str, db: Session = Depends(get_db)) -> list[LookResponse]:
    try:
        return OutfitService.list_looks(db, project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc


@router.patch("/api/v1/looks/{look_id}", response_model=LookResponse)
def update_look(look_id: str, payload: LookUpdate, db: Session = Depends(get_db)) -> LookResponse:
    try:
        return OutfitService.update_look(db, look_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Look not found") from exc


@router.delete("/api/v1/looks/{look_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_look(look_id: str, db: Session = Depends(get_db)) -> Response:
    try:
        OutfitService.delete_look(db, look_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Look not found") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
