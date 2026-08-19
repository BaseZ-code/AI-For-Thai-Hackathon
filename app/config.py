"""Application settings loaded from environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Pydantic-based settings — values sourced from env vars / .env file."""

    # --- ThaiLLM ---------------------------------------------------------
    thaillm_api_key: str = "mock"
    thaillm_base_url: str = "https://api.thaillm.example.com"
    thaillm_model: str = "thaillm-v1"
    thaillm_timeout_seconds: int = 30

    # --- App -------------------------------------------------------------
    app_env: str = "development"
    app_debug: bool = True
    log_level: str = "info"

    # --- Rate Limiting ---------------------------------------------------
    rate_limit: str = "60/minute"

    # --- PII Scrubbing ---------------------------------------------------
    pii_scrub_enabled: bool = False  # Set to True to re-enable PII scrubbing

    # --- Google Cloud Speech-to-Text ------------------------------------
    google_stt_api_key: str = "mock"
    audio_max_size_mb: int = 10

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
