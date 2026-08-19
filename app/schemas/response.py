"""Response models for the extraction endpoint."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Intent(BaseModel):
    """Detected conversation intent."""

    primary: str = Field(..., description="Primary intent label.")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence score (0-1)."
    )


class Sentiment(BaseModel):
    """Overall sentiment of the conversation."""

    overall: str = Field(
        ..., description="Sentiment label (positive, negative, neutral, mixed)."
    )
    score: float = Field(
        ..., ge=-1.0, le=1.0, description="Sentiment score (-1 to 1)."
    )


class Entity(BaseModel):
    """A single extracted entity."""

    type: str = Field(..., description="Entity type (e.g. order_id, person_name).")
    value: str = Field(..., description="Extracted value (redacted if PII).")
    span: str = Field(..., description="Original text span in which the entity was found.")
    pii_scrubbed: bool = Field(
        default=False, description="Whether PII scrubbing was applied to this entity."
    )


class CRMFields(BaseModel):
    """Pre-mapped CRM fields ready for frontend auto-population."""

    customer_name: str | None = None
    phone: str | None = None
    email: str | None = None
    order_id: str | None = None
    issue_category: str | None = None
    priority: str = "normal"


class Meta(BaseModel):
    """Processing metadata."""

    model: str = Field(..., description="LLM model identifier used.")
    processing_time_ms: int = Field(
        ..., ge=0, description="End-to-end processing time in milliseconds."
    )
    pii_fields_scrubbed: int = Field(
        default=0, ge=0, description="Number of PII fields that were redacted."
    )


class ExtractionData(BaseModel):
    """Core extraction result payload."""

    extraction_id: str = Field(..., description="Unique extraction identifier.")
    source: str = Field(..., description="Originating platform.")
    intent: Intent | None = None
    sentiment: Sentiment | None = None
    entities: list[Entity] = Field(default_factory=list)
    crm_fields: CRMFields = Field(default_factory=CRMFields)


class ExtractionResponse(BaseModel):
    """Top-level success envelope for POST /v1/extractions."""

    data: ExtractionData
    meta: Meta


class HealthResponse(BaseModel):
    """Response for GET /v1/health."""

    status: str = "healthy"
    version: str = "0.1.0"
    llm_reachable: bool = True
