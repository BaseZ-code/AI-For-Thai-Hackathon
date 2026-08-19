"""Tests for POST /v1/chat/analyze."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


_VALID_PAYLOAD = {
    "source": "line",
    "messages": [
        {
            "role": "customer",
            "content": "สวัสดีค่ะ สอบถามเรื่อง order #TH12345 ค่ะ",
            "timestamp": "2026-08-19T03:00:00Z",
        }
    ],
}


@pytest.mark.asyncio
async def test_extraction_happy_path(client: AsyncClient) -> None:
    resp = await client.post("/v1/chat/analyze", json=_VALID_PAYLOAD)
    assert resp.status_code == 200

    body = resp.json()
    # Top-level envelope
    assert "data" in body
    assert "meta" in body

    data = body["data"]
    assert data["source"] == "line"
    assert data["extraction_id"].startswith("ext_")
    assert data["intent"] is not None
    assert data["sentiment"] is not None
    assert isinstance(data["entities"], list)
    assert isinstance(data["crm_fields"], dict)

    meta = body["meta"]
    assert meta["model"]  # non-empty model string
    assert meta["processing_time_ms"] >= 0


@pytest.mark.asyncio
async def test_extraction_empty_messages_returns_422(client: AsyncClient) -> None:
    payload = {"source": "line", "messages": []}
    resp = await client.post("/v1/chat/analyze", json=payload)
    assert resp.status_code == 422

    body = resp.json()
    assert body["type"].endswith("/validation-error")
    assert body["title"] == "Validation Error"
    assert body["status"] == 422


@pytest.mark.asyncio
async def test_extraction_invalid_source_returns_422(client: AsyncClient) -> None:
    payload = {
        "source": "whatsapp",
        "messages": [{"role": "customer", "content": "hello"}],
    }
    resp = await client.post("/v1/chat/analyze", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_extraction_missing_body_returns_422(client: AsyncClient) -> None:
    resp = await client.post("/v1/chat/analyze", content=b"not json", headers={"Content-Type": "application/json"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_extraction_selective_fields(client: AsyncClient) -> None:
    payload = {**_VALID_PAYLOAD, "extract": ["intent"]}
    resp = await client.post("/v1/chat/analyze", json=payload)
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert data["intent"] is not None
    # sentiment and entities should be None/empty when not requested
    assert data["sentiment"] is None
    assert data["entities"] == []


@pytest.mark.asyncio
async def test_extraction_cancellation_with_phone(client: AsyncClient) -> None:
    """Phone numbers must not be confused with order IDs (user-reported bug)."""
    payload = {
        "source": "line",
        "messages": [
            {"role": "customer", "content": "ต้องการยกเลิกแพ็กเกจรายเดือนค่ะ รหัสสมาชิก 885432"},
            {"role": "customer", "content": "เบอร์ 099-999-9999 ค่ะ"},
        ],
    }
    resp = await client.post("/v1/chat/analyze", json=payload)
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert data["intent"]["primary"] == "order_cancellation"

    # Should have exactly one order_id (885432) and one phone_number
    order_ids = [e for e in data["entities"] if e["type"] == "order_id"]
    phones = [e for e in data["entities"] if e["type"] == "phone_number"]
    assert len(order_ids) == 1
    assert order_ids[0]["value"] == "885432"
    assert len(phones) == 1
    assert "099" in phones[0]["value"]


@pytest.mark.asyncio
async def test_extraction_different_input_produces_different_output(client: AsyncClient) -> None:
    """The mock LLM should analyse actual input, not return static data."""
    complaint_payload = {
        "source": "facebook",
        "messages": [
            {"role": "customer", "content": "ไม่พอใจมากค่ะ สินค้าเสียหาย order #FB99001"},
        ],
    }
    resp = await client.post("/v1/chat/analyze", json=complaint_payload)
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert data["source"] == "facebook"
    assert data["intent"]["primary"] == "complaint"
    assert data["sentiment"]["overall"] == "negative"
    assert data["crm_fields"]["priority"] == "high"
    assert data["crm_fields"]["order_id"] is not None

    # Now send a positive greeting — should differ
    greeting_payload = {
        "source": "line",
        "messages": [
            {"role": "customer", "content": "สวัสดีค่ะ ขอบคุณมากค่ะ ดีมากเลย"},
        ],
    }
    resp2 = await client.post("/v1/chat/analyze", json=greeting_payload)
    data2 = resp2.json()["data"]
    assert data2["intent"]["primary"] != "complaint"
    assert data2["sentiment"]["overall"] == "positive"
    assert data2["crm_fields"]["priority"] == "normal"
