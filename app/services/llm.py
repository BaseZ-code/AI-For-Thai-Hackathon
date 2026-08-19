"""ThaiLLM integration service — prompt construction, API call, response parsing."""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from typing import Any

import httpx

from app.config import settings
from app.core.exceptions import LLMTimeoutError, LLMUpstreamError
from app.schemas.request import ExtractionRequest
from app.schemas.response import (
    CRMFields,
    Entity,
    ExtractionData,
    ExtractionResponse,
    Intent,
    Meta,
    Sentiment,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a Thai customer service analysis engine. Read the ENTIRE conversation \
carefully — every message matters. Return ONLY a valid JSON object, no \
markdown fences, no explanation.

## Output Schema

{
  "intent": {"primary": "<intent_label>", "confidence": <0.0-1.0>},
  "sentiment": {"overall": "<positive|negative|neutral|mixed>", "score": <-1.0 to 1.0>},
  "entities": [
    {"type": "<entity_type>", "value": "<extracted_value>", "span": "<original_text>"}
  ],
  "crm_fields": {
    "customer_name": "<name or null>",
    "phone": "<phone or null>",
    "email": "<email or null>",
    "order_id": "<order_id or null>",
    "issue_category": "<category>",
    "priority": "<low|normal|high|urgent>"
  }
}

## Intent Labels

Use one of: greeting, order_inquiry, shipping_inquiry, product_inquiry, \
complaint, refund_request, order_cancellation, payment_issue, \
account_inquiry, general_inquiry.

## Entity Classification Rules

Each value MUST be assigned exactly ONE entity type. Never duplicate a value \
under multiple types.

| Entity Type    | Format & Context Cues |
|----------------|----------------------|
| phone_number   | Starts with 0, has 9-10 digits. May include dashes/spaces (081-234-5678). Cues: เบอร์, โทร, ติดต่อ, โทรศัพท์. May also appear WITHOUT a label — a bare 10-digit number starting with 0 is a phone. |
| order_id       | Reference/member/order IDs. Preceded by: order, #, ออเดอร์, รหัส, หมายเลข, เลขที่, คำสั่งซื้อ. May have letter prefixes (TH, FB). Does NOT start with 0. |
| person_name    | Thai or English names. Cues: ชื่อ, คุณ, นาย, นาง, นางสาว. Names can also appear WITHOUT an explicit prefix — see Conversational Context rules below. |
| email          | Standard email format (user@domain.tld). |
| product_name   | Products, services, subscription plans mentioned. |
| date           | Dates in any format (dd/mm/yyyy, วันที่, etc.). |
| address        | Physical addresses, postal codes. |
| company_name   | Business or organisation names. |

## Conversational Context Awareness (CRITICAL)

Do NOT analyse messages in isolation. Read the full conversation flow:

1. **Agent-Ask → Customer-Answer pattern**: When an agent asks for specific \
information (name, phone, order ID, etc.) and the customer's next message \
contains that information — even without an explicit label — classify it \
based on what was asked.
   - Agent: "ขอทราบชื่อ" → Customer: "สมศรี วิชัย" → person_name
   - Agent: "ขอเบอร์โทร" → Customer: "0812345678" → phone_number
   - Agent: "ขอเลขออเดอร์" → Customer: "TH12345" → order_id

2. **Confirmation/Denial patterns**: When an agent restates information and \
the customer confirms (ใช่, ครับ, ค่ะ, ถูกต้อง, correct) or denies \
(ไม่ใช่, ไม่ถูก, ผิด), use that to validate or reject the entity.
   - Agent: "คุณสมศรี ใช่มั้ยคะ" → Customer: "ใช่ค่ะ" → confirms person_name "สมศรี"
   - Agent: "ทาจ บอร์ธวิค คือชื่อใช่มั้ยครับ" → Customer: "ใช่ครับ" → confirms person_name "ทาจ บอร์ธวิค"

3. **Mixed data in one message**: A customer may send multiple pieces of info \
in a single message (e.g. "สมศรี 0812345678"). Separate them by format:
   - Thai/English words without digits → likely person_name
   - 0 + 9 digits → phone_number
   - Digits with a reference prefix → order_id

4. **Implicit info from agent messages**: Agents may reveal entity values \
when they restate or confirm customer data. Include these if the customer \
has confirmed them.

## Disambiguation Priority

When a value could match multiple entity types:
1. 0 + 9-10 digits (with optional dashes/spaces) → always phone_number
2. Preceded by a reference keyword (รหัส, order, #, หมายเลข) → order_id
3. Non-digit text adjacent to a phone number in a response to "ขอข้อมูล" → person_name
4. When ambiguous, prefer the type that matches the agent's preceding question

## Priority Escalation

- complaint OR negative sentiment → "high"
- refund_request OR order_cancellation → "normal" (unless also negative → "high")
- All other intents → "normal"

## Language Handling

Handle Thai, Tinglish (Thai-English mixing), romanised Thai names, deep \
social media slang (555, จ้า, อ่ะ, etc.), common abbreviations (นน=น้ำหนัก, \
ส่ง=จัดส่ง), and zero-width joiners/spaces in Thai text naturally.\
"""


def _build_user_prompt(request: ExtractionRequest) -> str:
    """Format the user message portion of the LLM prompt."""
    lines: list[str] = [f"Platform: {request.source}", "---"]
    for msg in request.messages:
        ts = msg.timestamp.isoformat() if msg.timestamp else "N/A"
        lines.append(f"[{msg.role}] ({ts}) {msg.content}")
    lines.append("---")
    lines.append(f"Extract: {', '.join(request.extract)}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Mock LLM (for offline / hackathon development without an API key)
# ---------------------------------------------------------------------------

# Thai keyword → intent mapping (first match wins)
_INTENT_KEYWORDS: list[tuple[str, list[str], float]] = [
    ("complaint", ["ร้องเรียน", "ไม่พอใจ", "แย่", "ห่วย", "โกง", "เสียหาย", "ผิดหวัง"], 0.88),
    ("refund_request", ["คืนเงิน", "refund", "ขอเงินคืน", "ได้เงินคืน"], 0.90),
    ("order_cancellation", ["ยกเลิก", "cancel", "ไม่เอาแล้ว", "ไม่ต้องการ"], 0.89),
    ("shipping_inquiry", ["จัดส่ง", "ส่งของ", "tracking", "พัสดุ", "ขนส่ง", "ไปรษณีย์"], 0.91),
    ("order_inquiry", ["order", "ออเดอร์", "คำสั่งซื้อ", "สั่งซื้อ", "สอบถาม", "สถานะ"], 0.92),
    ("product_inquiry", ["สินค้า", "product", "ราคา", "price", "สี", "ขนาด", "size", "รุ่น"], 0.87),
    ("payment_issue", ["ชำระ", "จ่ายเงิน", "โอนเงิน", "payment", "บัตรเครดิต", "promptpay"], 0.89),
    ("greeting", ["สวัสดี", "hello", "hi", "หวัดดี", "ดีค่ะ", "ดีครับ"], 0.95),
    ("general_inquiry", [], 0.70),  # fallback
]

# Sentiment keyword lists
_POSITIVE_WORDS = [
    "ขอบคุณ", "ดีมาก", "ประทับใจ", "พอใจ", "ชอบ", "สุดยอด", "เยี่ยม",
    "รวดเร็ว", "ดีเลย", "thanks", "thank you", "great", "good", "happy",
]
_NEGATIVE_WORDS = [
    "ไม่พอใจ", "แย่", "ห่วย", "ช้า", "เสียหาย", "ผิดหวัง", "โกรธ", "เกลียด",
    "ไม่ดี", "แพง", "ไม่ได้", "ล่าช้า", "bad", "angry", "worst", "terrible",
]


def _detect_intent(text: str) -> dict[str, Any]:
    """Keyword-based intent detection from combined message text."""
    text_lower = text.lower()
    for intent_label, keywords, confidence in _INTENT_KEYWORDS:
        if any(kw in text_lower for kw in keywords):
            return {"primary": intent_label, "confidence": confidence}
    # fallback
    return {"primary": "general_inquiry", "confidence": 0.70}


def _detect_sentiment(text: str) -> dict[str, Any]:
    """Simple keyword-counting sentiment scorer."""
    text_lower = text.lower()
    pos = sum(1 for w in _POSITIVE_WORDS if w in text_lower)
    neg = sum(1 for w in _NEGATIVE_WORDS if w in text_lower)
    total = pos + neg
    if total == 0:
        return {"overall": "neutral", "score": 0.0}
    score = round((pos - neg) / total, 2)
    if score > 0.25:
        label = "positive"
    elif score < -0.25:
        label = "negative"
    else:
        label = "mixed" if total > 1 else "neutral"
    return {"overall": label, "score": score}


def _extract_entities(text: str) -> list[dict[str, Any]]:
    """Regex-based entity extraction from message text."""
    entities: list[dict[str, Any]] = []
    seen_values: set[str] = set()
    # Track character spans consumed by phone numbers to avoid order_id overlap
    phone_spans: list[tuple[int, int]] = []

    # --- Phone numbers (detect FIRST to prevent order_id false positives) ---
    # Supports: 0812345678, 081-234-5678, 081 234 5678, 099-999-9999
    _phone_patterns = [
        # Mobile 06x/08x/09x with optional separators
        re.compile(r"(?<!\d)(0[689]\d[-\s]?\d{3}[-\s]?\d{4})(?!\d)"),
        # Landline 02-05 with optional separators
        re.compile(r"(?<!\d)(0[2-5][-\s]?\d{3}[-\s]?\d{4})(?!\d)"),
        # Redacted tokens from PII scrubber (if re-enabled)
        re.compile(r"\[REDACTED_PHONE\]"),
    ]
    for pat in _phone_patterns:
        for m in pat.finditer(text):
            val = m.group(0)
            # Normalise: strip dashes/spaces for dedup
            normalised = re.sub(r"[-\s]", "", val)
            if normalised not in seen_values:
                is_redacted = val.startswith("[REDACTED")
                entities.append({
                    "type": "phone_number", "value": val, "span": val,
                    "pii_scrubbed": is_redacted,
                })
                seen_values.add(normalised)
                phone_spans.append((m.start(), m.end()))

    # --- Order / reference IDs (require a contextual prefix keyword) ---
    _order_re = re.compile(
        r"(?:order|ออเดอร์|คำสั่งซื้อ|สั่งซื้อ"
        r"|รหัส(?:สมาชิก|สินค้า|คำสั่ง)?"
        r"|หมายเลข|เลขที่|#)"
        r"\s*#?\s*((?:[A-Z]{1,3}[-]?)?\d{4,10})",
        re.I,
    )
    for m in _order_re.finditer(text):
        # Skip if this match overlaps with a phone span
        if any(not (m.end() <= ps or m.start() >= pe) for ps, pe in phone_spans):
            continue
        val = m.group(1)
        if val not in seen_values:
            entities.append({"type": "order_id", "value": val, "span": m.group(0).strip()})
            seen_values.add(val)

    # --- Thai names preceded by ชื่อ ---
    _not_names = {"ใช่", "ไหม", "มั้ย", "เปล่า", "ป่ะ", "ไม่", "อะไร", "คือ", "ว่า"}
    for m in re.finditer(r"ชื่อ\s+([ก-๙]{2,}(?:\s[ก-๙]{2,})*)", text):
        val = m.group(1).strip()
        # Reject if the "name" is actually a question/filler word
        if val in _not_names or val.startswith("ใช่"):
            continue
        if val not in seen_values:
            entities.append({"type": "person_name", "value": val, "span": m.group(0).strip()})
            seen_values.add(val)

    # --- Emails ---
    for m in re.finditer(r"\[REDACTED_EMAIL\]|[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text):
        val = m.group(0)
        if val not in seen_values:
            entities.append({
                "type": "email", "value": val, "span": val,
                "pii_scrubbed": val.startswith("[REDACTED"),
            })
            seen_values.add(val)

    # --- Dates (dd/mm/yyyy or dd-mm-yyyy) ---
    for m in re.finditer(r"\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}", text):
        val = m.group(0)
        if val not in seen_values:
            entities.append({"type": "date", "value": val, "span": val})
            seen_values.add(val)

    return entities


def _mock_extract(request: ExtractionRequest) -> dict[str, Any]:
    """Input-aware mock with multi-turn conversational context analysis."""
    logger.info("Using MOCK LLM — analysing input with conversational context")

    messages = request.messages

    # Combine all customer messages for intent/sentiment
    customer_text = " ".join(
        msg.content for msg in messages if msg.role in ("customer", "system")
    )
    all_text = " ".join(msg.content for msg in messages)

    intent = _detect_intent(customer_text)
    sentiment = _detect_sentiment(customer_text)

    # --- Multi-turn entity extraction ---
    entities = _extract_entities(all_text)
    seen_values = {e["value"] for e in entities}

    # Pass 1: Scan for agent-ask → customer-answer patterns
    for i, msg in enumerate(messages):
        if msg.role != "agent":
            continue

        # Check what the agent is asking for
        agent_text = msg.content.lower()
        asking_name = any(k in agent_text for k in [
            "ชื่อ", "ขอทราบชื่อ", "ขอข้อมูล", "ข้อมูลลูกค้า",
        ])
        asking_phone = any(k in agent_text for k in [
            "เบอร์", "โทร", "เบอร์โทร", "โทรศัพท์",
        ])

        # Look at the customer's next reply
        for j in range(i + 1, len(messages)):
            if messages[j].role == "customer":
                reply = messages[j].content.strip()

                if asking_name or asking_phone:
                    # Strip phone numbers from the reply to isolate potential name
                    name_part = re.sub(
                        r"(?<!\d)0[689]\d[-\s]?\d{3}[-\s]?\d{4}(?!\d)", "", reply
                    ).strip()
                    name_part = re.sub(
                        r"\s*(ครับ|ค่ะ|จ้า|นะ|คะ)\s*$", "", name_part
                    ).strip()

                    # Reject bare confirmations / fillers
                    _skip = {"ใช่", "ไม่", "ครับ", "ค่ะ", "ใช่ครับ", "ใช่ค่ะ",
                             "ถูกต้อง", "ไม่ใช่", "จ้า", "อ่ะ", ""}
                    if name_part in _skip:
                        break

                    if name_part and name_part not in seen_values and not name_part.isdigit():
                        # Check it looks like a name (has Thai or Latin letters)
                        if re.search(r"[ก-๙a-zA-Z]", name_part):
                            entities.append({
                                "type": "person_name",
                                "value": name_part,
                                "span": name_part,
                            })
                            seen_values.add(name_part)
                break  # only check the immediate next customer reply

    # Pass 2: Agent confirmation patterns
    # e.g. agent says "X คือชื่อใช่มั้ย" → customer says "ใช่"
    _confirm_words = {"ใช่", "ครับ", "ค่ะ", "ถูกต้อง", "correct", "yes", "ใช่ครับ", "ใช่ค่ะ"}
    for i, msg in enumerate(messages):
        if msg.role != "agent":
            continue
        # Check for "X คือชื่อ" or "X ใช่มั้ย" confirmation pattern
        name_confirm = re.search(
            r"(.+?)\s*(?:คือ\s*)?ชื่อ\s*(?:ใช่มั้ย|ใช่ไหม|หรือเปล่า|ใช่ป่ะ)",
            msg.content,
        )
        if not name_confirm:
            continue

        # Check the next customer reply for confirmation
        for j in range(i + 1, len(messages)):
            if messages[j].role == "customer":
                reply_stripped = messages[j].content.strip().rstrip("ครับค่ะจ้านะคะ").strip()
                if reply_stripped in _confirm_words or messages[j].content.strip() in _confirm_words:
                    confirmed_name = name_confirm.group(1).strip()
                    if confirmed_name not in seen_values:
                        entities.append({
                            "type": "person_name",
                            "value": confirmed_name,
                            "span": confirmed_name,
                        })
                        seen_values.add(confirmed_name)
                break

    # Build CRM fields from extracted entities
    crm: dict[str, Any] = {
        "customer_name": None,
        "phone": None,
        "email": None,
        "order_id": None,
        "issue_category": intent["primary"],
        "priority": "normal",
    }
    for ent in entities:
        if ent["type"] == "person_name" and crm["customer_name"] is None:
            crm["customer_name"] = ent["value"]
        elif ent["type"] == "phone_number" and crm["phone"] is None:
            crm["phone"] = ent["value"]
        elif ent["type"] == "email" and crm["email"] is None:
            crm["email"] = ent["value"]
        elif ent["type"] == "order_id" and crm["order_id"] is None:
            crm["order_id"] = ent["value"]

    # Escalate priority for complaints / negative sentiment
    if intent["primary"] == "complaint" or sentiment["overall"] == "negative":
        crm["priority"] = "high"

    return {
        "intent": intent,
        "sentiment": sentiment,
        "entities": entities,
        "crm_fields": crm,
    }


# ---------------------------------------------------------------------------
# Real LLM call
# ---------------------------------------------------------------------------


async def _call_thaillm(
    http_client: httpx.AsyncClient,
    request: ExtractionRequest,
) -> dict[str, Any]:
    """Send the extraction prompt to ThaiLLM and parse the JSON response."""
    payload = {
        "model": settings.thaillm_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(request)},
        ],
        "temperature": 0.1,
        "max_tokens": 2048,
    }
    headers = {
        "Authorization": f"Bearer {settings.thaillm_api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = await http_client.post(
            f"{settings.thaillm_base_url}/v1/chat/completions",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
    except httpx.TimeoutException as exc:
        raise LLMTimeoutError() from exc
    except httpx.HTTPStatusError as exc:
        raise LLMUpstreamError(detail=f"ThaiLLM returned {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise LLMUpstreamError(detail=str(exc)) from exc

    # Parse the LLM text response as JSON
    try:
        body = resp.json()
        content = body["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise LLMUpstreamError(
            detail=f"Failed to parse LLM response: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def extract(
    http_client: httpx.AsyncClient,
    request: ExtractionRequest,
    *,
    pii_scrub_count: int = 0,
) -> ExtractionResponse:
    """Run the full extraction pipeline and return a typed response.

    If ``THAILLM_API_KEY`` is set to ``"mock"`` the mock extractor is used
    so the app can run without network access.
    """
    start = time.perf_counter()

    # Choose real or mock LLM
    if settings.thaillm_api_key == "mock":
        raw = _mock_extract(request)
    else:
        raw = await _call_thaillm(http_client, request)

    elapsed_ms = int((time.perf_counter() - start) * 1000)

    # Map raw dict → typed models
    intent = Intent(**raw["intent"]) if "intent" in raw and "intent" in request.extract else None
    sentiment = (
        Sentiment(**raw["sentiment"])
        if "sentiment" in raw and "sentiment" in request.extract
        else None
    )

    entities: list[Entity] = []
    if "entities" in raw and "entities" in request.extract:
        for e in raw["entities"]:
            entities.append(Entity(**e))

    crm = CRMFields(**(raw.get("crm_fields") or {}))

    data = ExtractionData(
        extraction_id=f"ext_{uuid.uuid4().hex[:8]}",
        source=request.source,
        intent=intent,
        sentiment=sentiment,
        entities=entities,
        crm_fields=crm,
    )

    meta = Meta(
        model=settings.thaillm_model,
        processing_time_ms=elapsed_ms,
        pii_fields_scrubbed=pii_scrub_count,
    )

    return ExtractionResponse(data=data, meta=meta)
