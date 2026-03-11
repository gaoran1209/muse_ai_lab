"""
Muse Land API routes.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.backend.database import get_db
from src.backend.schemas import (
    CommentCreate,
    InteractionResponse,
    InteractionToggleRequest,
    InteractionToggleResponse,
    LandContentDetailResponse,
    PaginatedResponse,
    PromoteResponse,
    TryOnCreateRequest,
    TryOnResponse,
)
from src.backend.services.land_service import LandService

router = APIRouter(prefix="/api/v1/land", tags=["land"])


@router.get("/feed", response_model=PaginatedResponse)
def get_feed(
    tag: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedResponse:
    return LandService.list_feed(db, tag, page, limit)


@router.get("/contents/{content_id}", response_model=LandContentDetailResponse)
def get_content_detail(
    content_id: str,
    user_identifier: str = Query(default="anonymous"),
    db: Session = Depends(get_db),
) -> LandContentDetailResponse:
    try:
        return LandService.get_content_detail(db, content_id, user_identifier)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Content not found") from exc


@router.post("/contents/{content_id}/like", response_model=InteractionToggleResponse)
def toggle_like(
    content_id: str,
    payload: InteractionToggleRequest,
    db: Session = Depends(get_db),
) -> InteractionToggleResponse:
    try:
        return LandService.toggle_interaction(db, content_id, "like", payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Content not found") from exc


@router.post("/contents/{content_id}/favorite", response_model=InteractionToggleResponse)
def toggle_favorite(
    content_id: str,
    payload: InteractionToggleRequest,
    db: Session = Depends(get_db),
) -> InteractionToggleResponse:
    try:
        return LandService.toggle_interaction(db, content_id, "favorite", payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Content not found") from exc


@router.post("/contents/{content_id}/comment", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
def add_comment(
    content_id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
) -> InteractionResponse:
    try:
        return LandService.add_comment(db, content_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Content not found") from exc


@router.post("/contents/{content_id}/tryon", response_model=TryOnResponse, status_code=status.HTTP_202_ACCEPTED)
def create_tryon(
    content_id: str,
    payload: TryOnCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> TryOnResponse:
    try:
        response = LandService.create_tryon_task(db, content_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Content not found") from exc
    background_tasks.add_task(LandService.process_tryon_task, response.id)
    return response


@router.get("/tryon/{task_id}", response_model=TryOnResponse)
def get_tryon(task_id: str, db: Session = Depends(get_db)) -> TryOnResponse:
    try:
        return LandService.get_tryon_task(db, task_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="TryOn task not found") from exc


@router.get("/contents/{content_id}/promote", response_model=PromoteResponse)
def get_promote_link(content_id: str, db: Session = Depends(get_db)) -> PromoteResponse:
    try:
        return LandService.get_promote_link(db, content_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Content not found") from exc
