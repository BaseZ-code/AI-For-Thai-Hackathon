"""Global exception handlers and middleware (RFC 7807 error responses)."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import LLMTimeoutError, LLMUpstreamError, ValidationError
from app.schemas.errors import FieldError, ProblemDetail

logger = logging.getLogger(__name__)

_ERROR_BASE = "https://chaitoke.dev/errors"


def _problem_response(problem: ProblemDetail) -> JSONResponse:
    """Build a JSONResponse with RFC 7807 content type."""
    return JSONResponse(
        status_code=problem.status,
        content=problem.model_dump(exclude_none=True),
        media_type="application/problem+json",
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all global exception handlers to the FastAPI app."""

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        field_errors = [
            FieldError(
                field=" → ".join(str(loc) for loc in err["loc"]),
                message=err["msg"],
            )
            for err in exc.errors()
        ]
        problem = ProblemDetail(
            type=f"{_ERROR_BASE}/validation-error",
            title="Validation Error",
            status=422,
            detail="One or more request fields failed validation.",
            instance=str(_request.url.path),
            errors=field_errors,
        )
        return _problem_response(problem)

    @app.exception_handler(LLMUpstreamError)
    async def llm_upstream_handler(_request: Request, exc: LLMUpstreamError) -> JSONResponse:
        logger.error("LLM upstream error: %s", exc.detail)
        problem = ProblemDetail(
            type=f"{_ERROR_BASE}/llm-upstream-error",
            title="LLM Upstream Error",
            status=502,
            detail=exc.detail,
            instance=str(_request.url.path),
        )
        return _problem_response(problem)

    @app.exception_handler(LLMTimeoutError)
    async def llm_timeout_handler(_request: Request, exc: LLMTimeoutError) -> JSONResponse:
        logger.error("LLM timeout: %s", exc.detail)
        problem = ProblemDetail(
            type=f"{_ERROR_BASE}/llm-timeout",
            title="LLM Timeout",
            status=504,
            detail=exc.detail,
            instance=str(_request.url.path),
        )
        return _problem_response(problem)

    @app.exception_handler(ValidationError)
    async def custom_validation_handler(_request: Request, exc: ValidationError) -> JSONResponse:
        problem = ProblemDetail(
            type=f"{_ERROR_BASE}/validation-error",
            title="Validation Error",
            status=422,
            detail=exc.detail,
            instance=str(_request.url.path),
        )
        return _problem_response(problem)

    @app.exception_handler(Exception)
    async def catch_all_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception: %s", exc)
        problem = ProblemDetail(
            type=f"{_ERROR_BASE}/internal-error",
            title="Internal Server Error",
            status=500,
            detail="An unexpected error occurred.",
            instance=str(_request.url.path),
        )
        return _problem_response(problem)
