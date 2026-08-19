"""RFC 7807 Problem Details error model."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FieldError(BaseModel):
    """Individual field-level validation error."""

    field: str
    message: str


class ProblemDetail(BaseModel):
    """RFC 7807 Problem Details for HTTP APIs.

    See: https://www.rfc-editor.org/rfc/rfc7807
    """

    type: str = Field(
        ...,
        description="A URI reference identifying the problem type.",
        examples=["https://chaitoke.dev/errors/validation-error"],
    )
    title: str = Field(
        ...,
        description="A short, human-readable summary of the problem.",
        examples=["Validation Error"],
    )
    status: int = Field(
        ...,
        description="The HTTP status code.",
        examples=[422],
    )
    detail: str = Field(
        ...,
        description="A human-readable explanation specific to this occurrence.",
        examples=["Field 'messages' must contain at least one message."],
    )
    instance: str | None = Field(
        default=None,
        description="A URI reference identifying the specific occurrence.",
        examples=["/v1/extractions"],
    )
    errors: list[FieldError] | None = Field(
        default=None,
        description="Field-level validation errors (for 422 responses).",
    )
