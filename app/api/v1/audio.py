"""POST /v1/audio/analyze — audio transcription + extraction endpoint."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, File, Form, Request, UploadFile

from app.config import settings
from app.schemas.response import ExtractionResponse
from app.services import asr as asr_service
from app.services import llm as llm_service
from app.services import pii as pii_service

logger = logging.getLogger(__name__)

audio_router = APIRouter()

# Max upload size in bytes (from config, default 10 MB)
_MAX_BYTES = settings.audio_max_size_mb * 1024 * 1024


@audio_router.post(
    "/audio/analyze",
    response_model=ExtractionResponse,
    summary="Extract structured data from audio recordings",
    description=(
        "Accepts a Thai audio file (mp3/wav/m4a/flac), transcribes it via "
        "Google Cloud Speech-to-Text, then runs ThaiLLM extraction on the "
        "transcript to return structured CRM fields."
    ),
)
async def analyze_audio(
    request: Request,
    file: UploadFile = File(..., description="Audio file (.mp3, .wav, .m4a, .flac)"),
    source: str = Form(default="other", description="Platform: line, facebook, other"),
    extract: str = Form(
        default='["intent","sentiment","entities"]',
        description='JSON array of fields to extract',
    ),
) -> ExtractionResponse:
    """Pipeline: validate → ASR transcribe → (optional PII scrub) → LLM extract."""

    # --- Validate file extension -----------------------------------------
    filename = file.filename or "upload.wav"
    ext = filename[filename.rfind("."):].lower() if "." in filename else ""
    if ext not in asr_service.ALLOWED_EXTENSIONS:
        from app.core.exceptions import ValidationError
        raise ValidationError(
            detail=(
                f"Unsupported audio format '{ext}'. "
                f"Allowed: {', '.join(sorted(asr_service.ALLOWED_EXTENSIONS))}"
            )
        )

    # --- Read and validate file size -------------------------------------
    audio_bytes = await file.read()
    if len(audio_bytes) > _MAX_BYTES:
        from app.core.exceptions import ValidationError
        raise ValidationError(
            detail=f"File too large ({len(audio_bytes)} bytes). Max: {settings.audio_max_size_mb} MB."
        )

    # --- Parse extract fields --------------------------------------------
    try:
        extract_fields = json.loads(extract)
    except json.JSONDecodeError:
        extract_fields = ["intent", "sentiment", "entities"]

    # --- Transcribe via Google STT ---------------------------------------
    http_client = request.app.state.http_client
    transcript = await asr_service.transcribe(http_client, audio_bytes, filename)

    if not transcript:
        from app.core.exceptions import LLMUpstreamError
        raise LLMUpstreamError(detail="ASR returned empty transcript — audio may be silent or unrecognisable.")

    logger.info("ASR transcript (%d chars): %s...", len(transcript), transcript[:100])

    # --- Optional PII scrub on transcript --------------------------------
    scrub_count = 0
    if settings.pii_scrub_enabled:
        from app.services.pii import scrub_text
        transcript, scrub_count = scrub_text(transcript)

    # --- LLM extraction --------------------------------------------------
    result = await llm_service.extract_from_audio(
        http_client,
        transcript,
        source=source,
        extract_fields=extract_fields,
        pii_scrub_count=scrub_count,
    )

    return result
