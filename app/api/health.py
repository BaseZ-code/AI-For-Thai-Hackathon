"""GET /v1/health — liveness and readiness probe."""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Request

from app.config import settings
from app.schemas.response import HealthResponse

logger = logging.getLogger(__name__)

health_router = APIRouter()


@health_router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Returns service health status and LLM reachability.",
)
async def health_check(request: Request) -> HealthResponse:
    """Check if the API and its upstream LLM dependency are operational."""
    llm_ok = True

    if settings.thaillm_api_key != "mock":
        try:
            client: httpx.AsyncClient = request.app.state.http_client
            resp = await client.get(
                f"{settings.thaillm_base_url}/health",
                timeout=5.0,
            )
            llm_ok = resp.status_code < 500
        except Exception:
            logger.warning("LLM health check failed", exc_info=True)
            llm_ok = False

    return HealthResponse(
        status="healthy",
        version="0.1.0",
        llm_reachable=llm_ok,
    )
