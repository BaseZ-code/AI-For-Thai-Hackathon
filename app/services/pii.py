"""PII scrubber — redacts sensitive Thai PII before text reaches ThaiLLM."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class ScrubResult:
    """Result of a PII scrubbing pass."""

    text: str
    scrub_count: int = 0
    scrubbed_types: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Compiled regex patterns for Thai PII
# ---------------------------------------------------------------------------

_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    # Thai National ID: X-XXXX-XXXXX-XX-X
    (
        "national_id",
        re.compile(r"\d{1}-\d{4}-\d{5}-\d{2}-\d{1}"),
        "[REDACTED_ID]",
    ),
    # Thai National ID (no dashes): 13 consecutive digits
    (
        "national_id",
        re.compile(r"(?<!\d)\d{13}(?!\d)"),
        "[REDACTED_ID]",
    ),
    # Credit card: 4 groups of 4 digits
    (
        "credit_card",
        re.compile(r"\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}"),
        "[REDACTED_CC]",
    ),
    # Thai mobile: 06x/08x/09x + 7 digits
    (
        "phone_mobile",
        re.compile(r"(?<!\d)0[689]\d{8}(?!\d)"),
        "[REDACTED_PHONE]",
    ),
    # Thai landline: 02-05 + 7 digits
    (
        "phone_landline",
        re.compile(r"(?<!\d)0[2-5]\d{7}(?!\d)"),
        "[REDACTED_PHONE]",
    ),
    # Email
    (
        "email",
        re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
        "[REDACTED_EMAIL]",
    ),
]


def scrub(text: str) -> ScrubResult:
    """Apply all PII patterns to *text* and return a `ScrubResult`.

    Patterns are applied in order; credit-card runs before phone so that
    16-digit card numbers aren't partially matched as phone numbers.
    """
    total_count = 0
    types_found: list[str] = []

    for pii_type, pattern, replacement in _PATTERNS:
        matches = pattern.findall(text)
        if matches:
            text = pattern.sub(replacement, text)
            total_count += len(matches)
            if pii_type not in types_found:
                types_found.append(pii_type)

    return ScrubResult(text=text, scrub_count=total_count, scrubbed_types=types_found)


def scrub_messages(messages: list[dict[str, str]]) -> tuple[list[dict[str, str]], int]:
    """Scrub PII from a list of message dicts (each having a ``content`` key).

    Returns the scrubbed messages and the total number of PII fields redacted.
    """
    total_scrubbed = 0
    cleaned: list[dict[str, str]] = []

    for msg in messages:
        result = scrub(msg.get("content", ""))
        cleaned.append({**msg, "content": result.text})
        total_scrubbed += result.scrub_count

    return cleaned, total_scrubbed
