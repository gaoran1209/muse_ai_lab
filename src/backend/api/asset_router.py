"""
Asset API routes.
"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from src.backend.database import get_db
from src.backend.schemas import AssetResponse, AssetUpdate
from src.backend.services.asset_service import AssetService

router = APIRouter(tags=["assets"])


@router.post("/api/v1/projects/{project_id}/assets", response_model=list[AssetResponse], status_code=status.HTTP_201_CREATED)
async def upload_assets(
    project_id: str,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> list[AssetResponse]:
    try:
        payload = [
            (upload.filename or "asset.bin", upload.content_type, await upload.read())
            for upload in files
        ]
        return AssetService.upload_assets(db, project_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc


@router.get("/api/v1/projects/{project_id}/assets", response_model=list[AssetResponse])
def list_assets(
    project_id: str,
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[AssetResponse]:
    try:
        return AssetService.list_assets(db, project_id, category)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc


@router.patch("/api/v1/assets/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: str, payload: AssetUpdate, db: Session = Depends(get_db)) -> AssetResponse:
    try:
        return AssetService.update_asset(db, asset_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Asset not found") from exc


@router.delete("/api/v1/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: str, db: Session = Depends(get_db)) -> Response:
    try:
        AssetService.delete_asset(db, asset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Asset not found") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
