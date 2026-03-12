"""
Asset API routes.
"""

import ipaddress
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from src.backend.database import get_db
from src.backend.schemas import AssetResponse, AssetUpdate
from src.backend.services.asset_service import AssetService

router = APIRouter(tags=["assets"])


def _assert_public_asset_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Only public http(s) asset URLs are supported.")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid asset host.")

    if hostname in {"localhost", "127.0.0.1", "::1"} or hostname.endswith(".local"):
        raise HTTPException(status_code=400, detail="Local asset hosts are not allowed.")

    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        return

    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_unspecified:
        raise HTTPException(status_code=400, detail="Private asset hosts are not allowed.")


def _proxy_headers(url: str) -> dict[str, str]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    }
    host = urlparse(url).hostname or ""
    if "alicdn.com" in host or "aliexpress" in host:
        headers["Referer"] = "https://www.aliexpress.com/"
    return headers


@router.get("/api/v1/assets/proxy")
def proxy_asset(url: str = Query(..., min_length=8, max_length=4000)) -> Response:
    _assert_public_asset_url(url)
    request = Request(url, headers=_proxy_headers(url))

    try:
        with urlopen(request, timeout=15) as upstream:
            content = upstream.read()
            content_type = upstream.headers.get_content_type()
    except HTTPError as exc:
        raise HTTPException(status_code=exc.code, detail="Upstream asset request failed.") from exc
    except URLError as exc:
        raise HTTPException(status_code=502, detail="Upstream asset is unavailable.") from exc

    return Response(
        content=content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


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
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
