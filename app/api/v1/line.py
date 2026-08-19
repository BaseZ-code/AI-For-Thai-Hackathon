"""POST /v1/line/parse — parse raw LINE chat log into structured JSON."""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.exceptions import ValidationError
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
    customer_name: str = Field(
        ...,
        min_length=1,
        description="LINE username of the customer.",
    )
    agent_name: str = Field(
        ...,
        min_length=1,
        description="LINE username of the agent.",
    )
    extract: list[str] = Field(
        default=["intent", "sentiment", "entities"],
        description="Fields to extract (passed through to the output).",
    )


class ParsedMessage(BaseModel):
    """A single parsed message."""

    role: str = Field(..., description="Speaker role: 'customer' or 'agent'.")
    content: str = Field(..., description="Message text content.")
    timestamp: str | None = Field(
        default=None, description="ISO 8601 timestamp."
    )


class LineParseResponse(BaseModel):
    """Parsed LINE log ready for /v1/chat/analyze."""

    source: str = "line"
    messages: list[ParsedMessage]
    extract: list[str]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@line_router.post(
    "/line/parse",
    response_model=LineParseResponse,
    summary="Parse raw LINE chat log",
    description=(
        "Accepts a raw LINE chat export (plain text) and parses it into "
        "structured JSON compatible with POST /v1/chat/analyze. "
        "Requires customer_name and agent_name to map LINE usernames to roles. "
        "Only 2-participant conversations are allowed."
    ),
)
async def parse_line_log_endpoint(body: LineLogRequest) -> LineParseResponse:
    """Parse a raw LINE log export into structured messages."""
    logger.info(
        "Parsing LINE log (%d chars) — customer=%s, agent=%s",
        len(body.messages),
        body.customer_name,
        body.agent_name,
    )

    # Build role mapping: username → "customer" / "agent"
    role_map = {
        body.customer_name: "customer",
        body.agent_name: "agent",
    }

    try:
        result = parse_line_log(body.messages, role_map=role_map)
    except ValueError as exc:
        raise ValidationError(detail=str(exc)) from exc

    return LineParseResponse(
        source=body.source,
        messages=[ParsedMessage(**m) for m in result["messages"]],
        extract=body.extract,
    )
