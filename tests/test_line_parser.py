"""Tests for the LINE log parser endpoint."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

_SAMPLE_LOG = """\
2026.08.15 Saturday
15:06\tcustomer1\tสวัสดีครับ ได้รับโต๊ะแล้วแต่ขาหัก
15:08\tagent1\tต้องขออภัยด้วยนะคะ ขอทราบเลขที่ใบเสร็จได้ไหมคะ
15:10\tcustomer1\tHP-INV-99824 ครับ
15:12\tagent1\tรบกวนส่งรูปมาทาง LINE OA นะคะ
"""

_THREE_PARTICIPANT_LOG = """\
2026.08.15 Saturday
15:06\tuser1\tHello
15:08\tuser2\tHi
15:10\tuser3\tHey
"""


@pytest.mark.asyncio
async def test_line_parse_happy_path(client: AsyncClient) -> None:
    """Parser should map usernames to customer/agent roles."""
    resp = await client.post(
        "/v1/line/parse",
        json={
            "source": "line",
            "messages": _SAMPLE_LOG,
            "customer_name": "customer1",
            "agent_name": "agent1",
        },
    )
    assert resp.status_code == 200

    body = resp.json()
    assert body["source"] == "line"
    msgs = body["messages"]
    assert len(msgs) == 4

    # Roles should be mapped
    assert msgs[0]["role"] == "customer"
    assert msgs[1]["role"] == "agent"
    assert msgs[2]["role"] == "customer"
    assert msgs[3]["role"] == "agent"

    # Content preserved
    assert "ขาหัก" in msgs[0]["content"]
    assert msgs[0]["timestamp"] is not None

    # Output should be directly compatible with /v1/chat/analyze
    assert "metadata" not in body
    assert "extract" in body


@pytest.mark.asyncio
async def test_line_parse_rejects_three_participants(client: AsyncClient) -> None:
    """Logs with more than 2 participants should be rejected."""
    resp = await client.post(
        "/v1/line/parse",
        json={
            "source": "line",
            "messages": _THREE_PARTICIPANT_LOG,
            "customer_name": "user1",
            "agent_name": "user2",
        },
    )
    assert resp.status_code == 422
    assert "3 participants" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_line_parse_missing_names(client: AsyncClient) -> None:
    """customer_name and agent_name are required fields."""
    resp = await client.post(
        "/v1/line/parse",
        json={"source": "line", "messages": _SAMPLE_LOG},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_line_parse_multiline_message(client: AsyncClient) -> None:
    """Multi-line messages should be concatenated."""
    log = """\
2026.08.15 Saturday
15:06\tuser1\tFirst line
Second line of the same message
16:00\tuser2\tAnother message
"""
    resp = await client.post(
        "/v1/line/parse",
        json={
            "source": "line",
            "messages": log,
            "customer_name": "user1",
            "agent_name": "user2",
        },
    )
    assert resp.status_code == 200
    msgs = resp.json()["messages"]
    assert len(msgs) == 2
    assert "First line\nSecond line" in msgs[0]["content"]
    assert msgs[0]["role"] == "customer"
    assert msgs[1]["role"] == "agent"


@pytest.mark.asyncio
async def test_line_parse_filters_system_messages(client: AsyncClient) -> None:
    """System messages and stickers should be filtered out."""
    log = """\
2026.08.15 Saturday
12:56\tuser1\tuser1 added user2 to the group.
15:06\tuser1\tHello
15:08\tuser2\tStickers
15:10\tuser2\tHi there
"""
    resp = await client.post(
        "/v1/line/parse",
        json={
            "source": "line",
            "messages": log,
            "customer_name": "user1",
            "agent_name": "user2",
        },
    )
    assert resp.status_code == 200
    assert len(resp.json()["messages"]) == 2
