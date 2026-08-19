"""Tests for POST /v1/audio/analyze."""

from __future__ import annotations

import io

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_audio_happy_path(client: AsyncClient) -> None:
    """Upload a dummy WAV file and get a valid extraction response."""
    # Create a minimal WAV-like file (the mock ASR ignores content)
    fake_audio = io.BytesIO(b"\x00" * 1024)
    fake_audio.name = "test.wav"

    resp = await client.post(
        "/v1/audio/analyze",
        files={"file": ("test.wav", fake_audio, "audio/wav")},
        data={"source": "line"},
    )
    assert resp.status_code == 200

    body = resp.json()
    assert "data" in body
    assert "meta" in body

    data = body["data"]
    assert data["extraction_id"].startswith("ext_")
    assert data["source"] == "line"
    assert data["reconstructed_transcript"] is not None
    assert data["intent"] is not None
    assert data["sentiment"] is not None
    assert isinstance(data["entities"], list)

    meta = body["meta"]
    assert meta["input_type"] == "audio"
    assert meta["raw_transcript"] is not None
    assert len(meta["raw_transcript"]) > 0


@pytest.mark.asyncio
async def test_audio_unsupported_format(client: AsyncClient) -> None:
    """Reject unsupported audio formats."""
    fake = io.BytesIO(b"\x00" * 100)
    resp = await client.post(
        "/v1/audio/analyze",
        files={"file": ("test.ogg", fake, "audio/ogg")},
    )
    assert resp.status_code == 422
    assert "Unsupported audio format" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_audio_too_large(client: AsyncClient) -> None:
    """Reject files exceeding the size limit."""
    # Create a file that's just over the limit (default 10 MB)
    big_file = io.BytesIO(b"\x00" * (11 * 1024 * 1024))
    resp = await client.post(
        "/v1/audio/analyze",
        files={"file": ("large.wav", big_file, "audio/wav")},
    )
    assert resp.status_code == 422
    assert "too large" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_audio_mock_extracts_entities(client: AsyncClient) -> None:
    """The mock ASR transcript should produce extractable entities."""
    fake_audio = io.BytesIO(b"\x00" * 512)
    resp = await client.post(
        "/v1/audio/analyze",
        files={"file": ("test.mp3", fake_audio, "audio/mpeg")},
    )
    assert resp.status_code == 200

    data = resp.json()["data"]
    # The mock transcript has "ออเดอร์ TH55123" and "โทร 0812345678"
    crm = data["crm_fields"]
    assert crm["order_id"] is not None
    assert crm["phone"] is not None
