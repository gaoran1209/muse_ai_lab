"""
Root API router composed from provider and business domain modules.
"""

from fastapi import APIRouter

from .asset_router import router as asset_router
from .content_router import router as content_router
from .generation_router import router as generation_router
from .land_router import router as land_router
from .look_router import router as look_router
from .project_router import router as project_router
from .providers import router as providers_router


router = APIRouter()
router.include_router(providers_router)
router.include_router(project_router)
router.include_router(asset_router)
router.include_router(look_router)
router.include_router(generation_router)
router.include_router(content_router)
router.include_router(land_router)
