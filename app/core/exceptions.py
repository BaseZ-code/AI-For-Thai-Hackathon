"""Custom exception hierarchy for ChaiToke."""

from __future__ import annotations


class ChaiTokeError(Exception):
    """Base exception for all ChaiToke application errors."""

    def __init__(self, detail: str = "An unexpected error occurred.") -> None:
        self.detail = detail
        super().__init__(detail)


class LLMUpstreamError(ChaiTokeError):
    """ThaiLLM returned an error or an unparseable response."""

    def __init__(self, detail: str = "ThaiLLM upstream error.") -> None:
        super().__init__(detail)


class LLMTimeoutError(ChaiTokeError):
    """ThaiLLM did not respond within the configured timeout."""

    def __init__(self, detail: str = "ThaiLLM request timed out.") -> None:
        super().__init__(detail)
