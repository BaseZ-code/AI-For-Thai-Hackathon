"""POST /v1/chat/analyze — chat log extraction endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.config import settings
from app.schemas.request import ExtractionRequest
from app.schemas.response import ExtractionResponse
from app.services import pii as pii_service
from app.services import llm as llm_service

chat_router = APIRouter()


@chat_router.post(
    "/chat/analyze",
    response_model=ExtractionResponse,
    summary="Extract structured data from chat logs",
    description=(
        "Accepts raw Thai chat messages and returns structured CRM fields "
        "with intent recognition, sentiment analysis, and entity extraction."
    ),
)
async def analyze_chat(
    body: ExtractionRequest,
    request: Request,
) -> ExtractionResponse:
    """Pipeline: validate → (optional PII scrub) → LLM extract → serialise."""

    scrub_count = 0

    # PII scrub — only runs when enabled via config / env var
    if settings.pii_scrub_enabled:
        raw_messages = [msg.model_dump() for msg in body.messages]
        scrubbed_messages, scrub_count = pii_service.scrub_messages(raw_messages)
        for i, msg in enumerate(body.messages):
            object.__setattr__(msg, "content", scrubbed_messages[i]["content"])

    # Call ThaiLLM (or mock)
    http_client = request.app.state.http_client
    result = await llm_service.extract(
        http_client,
        body,
        pii_scrub_count=scrub_count,
    )

    return result
