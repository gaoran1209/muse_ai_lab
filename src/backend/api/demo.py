"""
Spark and Land demo routes.
"""

from fastapi import APIRouter, HTTPException

from src.backend.database import get_demo_store
from src.backend.schemas import AdoptShotRequest, CreateAssetRequest, CreateProjectRequest, GenerateShotRequest, PublishContentRequest, RecommendBoardsRequest, TryOnRequest
from src.backend.services.canvas_service import ProjectService
from src.backend.services.generation_service import GenerationService, LandService
from src.backend.services.outfit_service import OutfitService


router = APIRouter(prefix="/api/v1", tags=["demo"])


@router.get("/demo/bootstrap")
async def get_bootstrap() -> dict:
    snapshot = get_demo_store().read()
    return snapshot.model_dump(mode="json")


@router.get("/projects")
async def list_projects():
    return [project.model_dump(mode="json") for project in ProjectService.list_projects()]


@router.post("/projects")
async def create_project(payload: CreateProjectRequest):
    project = ProjectService.create_project(payload)
    return project.model_dump(mode="json")


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    try:
        project = ProjectService.get_project(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    return project.model_dump(mode="json")


@router.post("/projects/{project_id}/assets")
async def add_asset(project_id: str, payload: CreateAssetRequest):
    try:
        asset = ProjectService.add_asset(project_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    return asset.model_dump(mode="json")


@router.post("/projects/{project_id}/boards/recommend")
async def recommend_boards(project_id: str, payload: RecommendBoardsRequest):
    try:
        boards = OutfitService.recommend_boards(project_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    return [board.model_dump(mode="json") for board in boards]


@router.post("/projects/{project_id}/boards/{board_id}/shots")
async def generate_shot(project_id: str, board_id: str, payload: GenerateShotRequest):
    try:
        shot = GenerationService.generate_shot(project_id, board_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Board or project not found") from exc
    return shot.model_dump(mode="json")


@router.post("/projects/{project_id}/shots/{shot_id}/adopt")
async def adopt_shot(project_id: str, shot_id: str, payload: AdoptShotRequest):
    try:
        shot = GenerationService.adopt_shot(project_id, shot_id, payload.adopted)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Shot or project not found") from exc
    return shot.model_dump(mode="json")


@router.post("/projects/{project_id}/boards/{board_id}/publish")
async def publish_content(project_id: str, board_id: str, payload: PublishContentRequest):
    try:
        content = LandService.publish_content(project_id, board_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project or board not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return content.model_dump(mode="json")


@router.get("/land/feed")
async def list_feed():
    return [content.model_dump(mode="json") for content in LandService.list_feed()]


@router.post("/contents/{content_id}/like")
async def like_content(content_id: str):
    try:
        content = LandService.like_content(content_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Content not found") from exc
    return content.model_dump(mode="json")


@router.post("/contents/{content_id}/bookmark")
async def bookmark_content(content_id: str):
    try:
        content = LandService.bookmark_content(content_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Content not found") from exc
    return content.model_dump(mode="json")


@router.post("/contents/{content_id}/try-on")
async def create_try_on(content_id: str, payload: TryOnRequest):
    try:
        record = LandService.create_try_on(content_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Content not found") from exc
    return record.model_dump(mode="json")
