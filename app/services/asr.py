"""Google Cloud Speech-to-Text integration for audio transcription."""

from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supported audio formats → Google Cloud STT encoding names
# ---------------------------------------------------------------------------

_ENCODING_MAP: dict[str, str] = {
    ".wav": "LINEAR16",
    ".flac": "FLAC",
    ".mp3": "MP3",
    ".m4a": "MP3",  # Google handles M4A under MP3 encoding
}

ALLOWED_EXTENSIONS = set(_ENCODING_MAP.keys())




# ---------------------------------------------------------------------------
# Core transcription function
# ---------------------------------------------------------------------------


async def transcribe(
    http_client: httpx.AsyncClient,
    audio_bytes: bytes,
    filename: str,
) -> str:
    """Transcribe audio bytes to Thai text via Google Cloud STT.

    Returns the concatenated transcript string.
    Raises ``RuntimeError`` on API errors.
    """
    # Determine encoding from file extension
    ext = _get_extension(filename)
    encoding = _ENCODING_MAP.get(ext)
    if encoding is None:
        raise ValueError(
            f"Unsupported audio format '{ext}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Base64-encode the audio
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

    # Build the request payload
    payload: dict[str, Any] = {
        "config": {
            "encoding": encoding,
            "languageCode": "th-TH",
            "enableAutomaticPunctuation": True,
            "model": "default",
        },
        "audio": {
            "content": audio_b64,
        },
    }

    url = (
        f"https://speech.googleapis.com/v1/speech:recognize"
        f"?key={settings.google_stt_api_key}"
    )

    logger.info("Calling Google Cloud STT (encoding=%s, size=%d bytes)", encoding, len(audio_bytes))

    resp = await http_client.post(url, json=payload, timeout=60.0)

    if resp.status_code != 200:
        detail = resp.text[:500]
        logger.error("Google STT error %d: %s", resp.status_code, detail)
        raise RuntimeError(f"Google STT returned {resp.status_code}: {detail}")

    data = resp.json()
    results = data.get("results", [])

    if not results:
        logger.warning("Google STT returned no transcription results")
        return ""

    # Concatenate all transcript alternatives
    transcript = " ".join(
        alt["transcript"]
        for result in results
        for alt in result.get("alternatives", [])
        if alt.get("transcript")
    )

    logger.info("Transcription complete: %d chars", len(transcript))
    return transcript.strip()


def _get_extension(filename: str) -> str:
    """Extract lowercase file extension from a filename."""
    dot_idx = filename.rfind(".")
    if dot_idx == -1:
        return ""
    return filename[dot_idx:].lower()
