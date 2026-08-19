"""Tests for GET /v1/health."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_returns_200(client: AsyncClient) -> None:
    resp = await client.get("/v1/health")
    assert resp.status_code == 200

    body = resp.json()
    assert body["status"] == "healthy"
    assert body["version"] == "0.1.0"
    assert body["llm_reachable"] is True  # mock mode always true
