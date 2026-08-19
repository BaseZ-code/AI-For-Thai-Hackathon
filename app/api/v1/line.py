"""POST /v1/line/parse — parse raw LINE chat log into structured JSON."""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.line_parser import parse_line_log

logger = logging.getLogger(__name__)

line_router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class LineLogRequest(BaseModel):
    """Raw LINE chat log submission."""

    source: Literal["line"] = Field(
        default="line", description="Originating platform (always 'line')."
    )
    messages: str = Field(
        ...,
        min_length=1,
        description="Raw LINE chat export text.",
    )
    extract: list[str] = Field(
        default=["intent", "sentiment", "entities"],
        description="Fields to extract (passed through to the output).",
    )


class ParsedMessage(BaseModel):
    """A single parsed message."""

    role: str = Field(..., description="Speaker username from the LINE log.")
    content: str = Field(..., description="Message text content.")
    timestamp: str | None = Field(
        default=None, description="ISO 8601 timestamp."
    )


class ParseMetadata(BaseModel):
    """Parsing statistics."""

    total_messages: int = Field(..., description="Number of text messages parsed.")
    filtered_system_messages: int = Field(
        ..., description="Number of system/non-text messages filtered out."
    )
    participants: list[str] = Field(
        ..., description="Unique participant usernames found."
    )


class LineParseResponse(BaseModel):
    """Parsed LINE log ready for /v1/chat/analyze."""

    source: str = "line"
    messages: list[ParsedMessage]
    extract: list[str]
    metadata: ParseMetadata


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@line_router.post(
    "/line/parse",
    response_model=LineParseResponse,
    summary="Parse raw LINE chat log",
    description=(
        "Accepts a raw LINE chat export (plain text) and parses it into "
        "structured JSON compatible with POST /v1/chat/analyze."
    ),
)
async def parse_line_log_endpoint(body: LineLogRequest) -> LineParseResponse:
    """Parse a raw LINE log export into structured messages."""
    logger.info(
        "Parsing LINE log (%d chars)",
        len(body.messages),
    )

    result = parse_line_log(body.messages)

    return LineParseResponse(
        source=body.source,
        messages=[ParsedMessage(**m) for m in result["messages"]],
        extract=body.extract,
        metadata=ParseMetadata(**result["metadata"]),
    )
