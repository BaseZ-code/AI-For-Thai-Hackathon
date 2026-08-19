"""FastAPI application factory and lifespan management."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import v1_router
from app.config import settings
from app.core.middleware import register_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage application-wide resources (httpx client for LLM calls)."""
    app.state.http_client = httpx.AsyncClient(timeout=settings.thaillm_timeout_seconds)
    yield
    await app.state.http_client.aclose()


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    application = FastAPI(
        title="ChaiToke",
        description="AI-powered Thai customer service data extraction API",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # --- CORS (wide-open for local dev) ----------------------------------
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Exception handlers (RFC 7807) -----------------------------------
    register_exception_handlers(application)

    # --- Routers ---------------------------------------------------------
    application.include_router(v1_router, prefix="/v1")

    return application


app = create_app()
