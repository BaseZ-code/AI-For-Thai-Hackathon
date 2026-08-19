"""Tests for the LINE log parser endpoint."""

from __future__ import annotations

import io

import pytest
from httpx import AsyncClient

_SAMPLE_LOG = """\
2026.08.15 Saturday
12:56\tnongtajkrub\tnongtajkrub added celi, วันตะ, Pattawan, data. to the group.
15:06\tnongtajkrub\t@All  หวัดดีจ้าชาวamerica เดี๋ยววันจันทร์ตอน 9:10 เราขอเรียกทุกคนมาประชุมที่ห้อง D11 นะ
15:08\tceli\tStickers
16:23\tdata.\tStickers
22:30\tdata.\tวันจันทร์หนูได้ถึง 5 โมงน้าาา @nongtajkrub
22:32\tnongtajkrub\tอะเคค
2026.08.17 Monday
09:17\tnongtajkrub\t@วันตะ เช้านี้มามั้ยย
"""

@pytest.mark.asyncio
async def test_line_parse_happy_path(client: AsyncClient) -> None:
    """Parser should extract text messages and filter stickers/system msgs."""
    resp = await client.post(
        "/v1/line/parse",
        json={"source": "line", "messages": _SAMPLE_LOG},
    )
    assert resp.status_code == 200

    body = resp.json()
    assert body["source"] == "line"
    assert isinstance(body["messages"], list)
    assert isinstance(body["metadata"], dict)

    # Should have filtered out: 1 system msg (added to group) + 2 stickers = 3 filtered
    meta = body["metadata"]
    assert meta["filtered_system_messages"] == 3

    # Should have 4 text messages remaining
    assert meta["total_messages"] == 4

    # Check participants
    assert "nongtajkrub" in meta["participants"]
    assert "data." in meta["participants"]

    # Check first message content
    msgs = body["messages"]
    assert msgs[0]["role"] == "nongtajkrub"
    assert "หวัดดีจ้า" in msgs[0]["content"]
    assert msgs[0]["timestamp"] is not None


@pytest.mark.asyncio
async def test_line_parse_empty_body(client: AsyncClient) -> None:
    """Empty messages should return 422."""
    resp = await client.post(
        "/v1/line/parse",
        json={"source": "line", "messages": ""},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_line_parse_multiline_message(client: AsyncClient) -> None:
    """Multi-line messages should be concatenated."""
    log = """\
2026.08.15 Saturday
15:06\tuser1\tFirst line
Second line of the same message
Third line too
16:00\tuser2\tAnother message
"""
    resp = await client.post(
        "/v1/line/parse",
        json={"source": "line", "messages": log},
    )
    assert resp.status_code == 200
    msgs = resp.json()["messages"]
    assert len(msgs) == 2
    assert "First line\nSecond line" in msgs[0]["content"]
    assert "Third line" in msgs[0]["content"]


@pytest.mark.asyncio
async def test_line_parse_includes_extract_fields(client: AsyncClient) -> None:
    """Extract fields should be passed through in response."""
    resp = await client.post(
        "/v1/line/parse",
        json={
            "source": "line",
            "messages": "2026.08.15 Saturday\n10:00\tuser\tHello",
            "extract": ["intent"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["extract"] == ["intent"]
