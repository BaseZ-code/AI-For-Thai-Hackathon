"""v1 API router — mounts all v1 endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.health import health_router
from app.api.v1.extractions import extractions_router

v1_router = APIRouter()
v1_router.include_router(health_router, tags=["Health"])
v1_router.include_router(extractions_router, tags=["Extractions"])
