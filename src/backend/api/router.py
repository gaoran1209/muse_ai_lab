"""
Root API router composed from provider and demo modules.
"""

from fastapi import APIRouter

from .demo import router as demo_router
from .providers import router as providers_router


router = APIRouter()
router.include_router(providers_router)
router.include_router(demo_router)
