"""Shared pytest fixtures for ChaiToke tests."""

from __future__ import annotations

import os
from typing import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Force mock mode for all tests
os.environ["THAILLM_API_KEY"] = "mock"
os.environ["GOOGLE_STT_API_KEY"] = "mock"

from app.main import app  # noqa: E402 — import after env override


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Provide an async httpx test client with lifespan initialised."""
    # Manually trigger the lifespan so app.state.http_client is available
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
