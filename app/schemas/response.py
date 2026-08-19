"""Response models for the extraction endpoint."""

from __future__ import annotations

from typing import Any

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


# ---------------------------------------------------------------------------
# HomePro-specific triage models
# ---------------------------------------------------------------------------


class Identity(BaseModel):
    """Customer identity verification fields."""

    customer_phone: str | None = None
    order_invoice_no: str | None = None
    product_sku_model: str | None = None


class IssueTriage(BaseModel):
    """Furniture damage triage classification."""

    furniture_damage_type: str | None = None
    photo_evidence_received: bool = False
    incident_description: str | None = None


class EscalationLogic(BaseModel):
    """Escalation routing decision."""

    escalation_required: bool = False
    escalation_target: str | None = None
    escalation_reason: str | None = None


class BlufNote(BaseModel):
    """Bottom-Line-Up-Front note for Tier-2 handoff."""

    bottom_line: str | None = None
    context: str | None = None
    next_steps: str | None = None
    formatted_text: str | None = None


class AfterCallWork(BaseModel):
    """After-call work (ACW) disposition and ticket tracking."""

    call_disposition: str | None = None
    ticket_status: str | None = None
    action_deadline: str | None = None
    bluf_note: BlufNote | None = None


# ---------------------------------------------------------------------------
# Core response models
# ---------------------------------------------------------------------------


class Meta(BaseModel):
    """Processing metadata."""

    model: str = Field(..., description="LLM model identifier used.")
    input_type: str = Field(
        default="chat", description="Input type: 'chat' or 'audio'."
    )
    raw_transcript: str | None = Field(
        default=None,
        description="Raw ASR transcript before LLM cleanup (audio only).",
    )
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
    reconstructed_transcript: str | None = Field(
        default=None,
        description="LLM-cleaned transcript (audio pipeline only).",
    )
    # HomePro triage fields (populated by real LLM, None in mock mode)
    identity: Identity | None = None
    issue_triage: IssueTriage | None = None
    escalation_logic: EscalationLogic | None = None
    after_call_work: AfterCallWork | None = None
    # Standard extraction fields
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
