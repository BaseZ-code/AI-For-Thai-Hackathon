"""LINE chat log parser — converts raw LINE export text to structured messages."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LINE export format patterns
# ---------------------------------------------------------------------------

# Date header: "2026.08.15 Saturday" or "2026.08.15 วันเสาร์"
_DATE_RE = re.compile(r"^(\d{4})\.(\d{2})\.(\d{2})\s+\S+$")

# Message line: "HH:MM\tusername\tcontent" (tab-separated)
_MSG_TAB_RE = re.compile(r"^(\d{1,2}:\d{2})\t(.+?)\t(.+)$")

# Message line: "HH:MM username content" (space-separated fallback)
# Matches "15:06 nongtajkrub @All ..." — username is the first non-space token after time
_MSG_SPACE_RE = re.compile(r"^(\d{1,2}:\d{2})\s+(\S+)\s+(.+)$")

# System / non-text messages to filter out
_SYSTEM_PATTERNS = [
    re.compile(r"added .+ to the group", re.I),
    re.compile(r"left the group", re.I),
    re.compile(r"removed .+ from the group", re.I),
    re.compile(r"changed the group", re.I),
    re.compile(r"^Stickers?$", re.I),
    re.compile(r"^\[Sticker\]$", re.I),
    re.compile(r"^\[Photo\]$", re.I),
    re.compile(r"^\[Video\]$", re.I),
    re.compile(r"^\[File\]$", re.I),
    re.compile(r"^\[Album\]$", re.I),
    re.compile(r"^\[Voice message\]$", re.I),
    re.compile(r"^\[Contact\]$", re.I),
    re.compile(r"^\[Location\]$", re.I),
    re.compile(r"^☎", re.I),  # Call records
]


def _is_system_message(username: str, content: str) -> bool:
    """Check if a message is a system event or non-text content."""
    full = f"{username} {content}"
    for pat in _SYSTEM_PATTERNS:
        if pat.search(content) or pat.search(full):
            return True
    return False


def parse_line_log(raw_text: str) -> dict[str, Any]:
    """Parse a raw LINE chat export into structured messages.

    Returns a dict with:
      - messages: list of parsed message dicts
      - metadata: parsing stats (participants, filtered count, etc.)
    """
    lines = raw_text.strip().splitlines()
    messages: list[dict[str, Any]] = []
    participants: set[str] = set()
    current_date: str | None = None
    filtered_count = 0
    current_msg: dict[str, Any] | None = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Check for date header
        date_match = _DATE_RE.match(line)
        if date_match:
            # Flush any pending multi-line message
            if current_msg is not None:
                messages.append(current_msg)
                current_msg = None
            current_date = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}"
            continue

        # Try tab-separated format first, then space-separated
        msg_match = _MSG_TAB_RE.match(line) or _MSG_SPACE_RE.match(line)
        if msg_match:
            # Flush previous multi-line message
            if current_msg is not None:
                messages.append(current_msg)
                current_msg = None

            time_str = msg_match.group(1)
            username = msg_match.group(2).strip()
            content = msg_match.group(3).strip()

            # Filter system / non-text messages
            if _is_system_message(username, content):
                filtered_count += 1
                continue

            # Build timestamp
            timestamp: str | None = None
            if current_date:
                try:
                    dt = datetime.strptime(
                        f"{current_date} {time_str}", "%Y-%m-%d %H:%M"
                    ).replace(tzinfo=timezone.utc)
                    timestamp = dt.isoformat()
                except ValueError:
                    pass

            participants.add(username)
            current_msg = {
                "role": username,
                "content": content,
                "timestamp": timestamp,
            }
        else:
            # Continuation line (multi-line message) — append to current message
            if current_msg is not None:
                current_msg["content"] += f"\n{line}"

    # Flush last message
    if current_msg is not None:
        messages.append(current_msg)

    return {
        "messages": messages,
        "metadata": {
            "total_messages": len(messages),
            "filtered_system_messages": filtered_count,
            "participants": sorted(participants),
        },
    }
