"""
Content publishing API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.backend.database import get_db
from src.backend.schemas import ContentDetailResponse, ContentPublishRequest, ContentResponse
from src.backend.services.content_service import ContentService

router = APIRouter(tags=["contents"])


@router.post("/api/v1/contents", response_model=ContentResponse, status_code=status.HTTP_201_CREATED)
def publish_content(payload: ContentPublishRequest, db: Session = Depends(get_db)) -> ContentResponse:
    try:
        return ContentService.publish_content(db, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Look not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/v1/contents/{content_id}", response_model=ContentDetailResponse)
def get_content(content_id: str, db: Session = Depends(get_db)) -> ContentDetailResponse:
    try:
        return ContentService.get_content(db, content_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Content not found") from exc
