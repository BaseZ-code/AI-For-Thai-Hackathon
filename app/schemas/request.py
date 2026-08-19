"""Request models for the extraction endpoint."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    """A single chat message from the conversation log."""

    role: Literal["customer", "agent", "system"] = Field(
        ..., description="Speaker role in the conversation."
    )
    content: str = Field(
        ...,
        min_length=1,
        max_length=10_000,
        description="Raw message text.",
    )
    timestamp: datetime | None = Field(
        default=None, description="ISO 8601 timestamp of the message."
    )


ExtractField = Literal["intent", "sentiment", "entities"]

DEFAULT_EXTRACT_FIELDS: list[ExtractField] = ["intent", "sentiment", "entities"]


class ExtractionRequest(BaseModel):
    """Payload sent to POST /v1/extractions."""

    source: Literal["line", "facebook", "other"] = Field(
        ..., description="Originating platform."
    )
    messages: list[Message] = Field(
        ...,
        min_length=1,
        description="Conversation messages to analyse (at least one).",
    )
    extract: list[ExtractField] = Field(
        default=DEFAULT_EXTRACT_FIELDS,
        description="Fields to extract. Defaults to all.",
    )
