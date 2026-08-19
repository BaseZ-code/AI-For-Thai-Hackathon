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
    AfterCallWork,
    BlufNote,
    CRMFields,
    Entity,
    EscalationLogic,
    ExtractionData,
    ExtractionResponse,
    Identity,
    Intent,
    IssueTriage,
    Meta,
    Sentiment,
)

logger = logging.getLogger(__name__)


def _parse_llm_json(raw_content: str) -> dict[str, Any]:
    """Parse LLM output as JSON, stripping markdown fences if present."""
    text = raw_content.strip()

    if not text:
        logger.info("Raw LLM content: EMPTY STRING")
        raise ValueError("LLM returned empty content")

    logger.info("Raw LLM content:\n%s", text)

    # Strip <think>...</think> chain-of-thought blocks
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    # Strip ```json ... ``` or ``` ... ``` wrappers
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
        text = text.strip()

    if not text:
        raise ValueError("LLM returned only a <think> block with no JSON")

    return json.loads(text)

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an Enterprise Thai Customer Service AI Triage Engine specialized in 24/7 Call Center operations for HomePro Furniture & Home Solutions.
Read the ENTIRE conversation transcript carefully — multi-turn verbal context, customer emotions, confirmations, and implicit promises all matter.
Return ONLY a valid JSON object matching the schema below. Do NOT wrap in markdown fences (` ```json `), and provide NO conversational text outside the JSON.

## Output JSON Schema

{
  "identity": {
    "customer_phone": "<10-digit numeric phone number or null>",
    "order_invoice_no": "<invoice / receipt / order reference or null>",
    "product_sku_model": "<furniture type or model e.g. Wardrobe, Sofa, Dining Table, Bed, or null>"
  },
  "issue_triage": {
    "furniture_damage_type": "<Structural_Failure | Cosmetic_Damage | Missing_Assembly_Hardware | null>",
    "photo_evidence_received": <true | false>,
    "incident_description": "<concise summary in Thai of how and when the issue occurred>"
  },
  "escalation_logic": {
    "escalation_required": <true | false>,
    "escalation_target": "<Home_Service_Technician | Logistics_Delivery_Team | Furniture_Vendor_Support | null>",
    "escalation_reason": "<brief justification for routing target>"
  },
  "after_call_work": {
    "call_disposition": "Broken_Furniture_Intake",
    "ticket_status": "<Pending_Inspection | Replacement_Dispatched | Awaiting_Photos>",
    "action_deadline": "<target date/time window e.g. 'Within 48 hours', 'ภายใน 2 วัน', or ISO date if mentioned>",
    "bluf_note": {
      "bottom_line": "<1-sentence executive summary stating resolution/status and primary issue>",
      "context": "<concise key facts: damage details, item type, and photo evidence status>",
      "next_steps": "<action taken, assigned escalation team, and target SLA deadline>",
      "formatted_text": "<ready-to-paste 3-line BLUF note formatted exactly as: [BLUF]: <bottom_line>\\n• Context: <context>\\n• Next Steps: <next_steps>>"
    }
  },
  "intent": {
    "primary": "<complaint | refund_request | shipping_inquiry | product_inquiry | general_inquiry>",
    "confidence": <0.0 to 1.0>
  },
  "sentiment": {
    "overall": "<positive | negative | neutral | mixed>",
    "score": <-1.0 to 1.0>
  },
  "entities": [
    {"type": "<phone_number | order_id | person_name | product_name | date | address>", "value": "<extracted_value>", "span": "<original_text>"}
  ],
  "crm_fields": {
    "customer_name": "<name or null>",
    "phone": "<customer_phone or null>",
    "email": "<email or null>",
    "order_id": "<order_invoice_no or null>",
    "issue_category": "<furniture_damage_type or intent>",
    "priority": "<low | normal | high | urgent>"
  }
}

## Field Extraction & Business Validation Rules

### 1. Identity Verification
- `customer_phone`: 9–10 numeric digits starting with 0. Primary key for HomeCard member database lookup.
- `order_invoice_no`: Alphanumeric purchase reference. Preceded by keywords: เลขที่ใบเสร็จ, ใบกำกับ, ออเดอร์, order, #, รหัสคำสั่งซื้อ.
- `product_sku_model`: Extract specific furniture name/model (e.g., ตู้เสื้อผ้า 3 บาน, โซฟาปรับนอน, โต๊ะอาหารไม้ยางพารา).

### 2. Issue Triage Rules
- `furniture_damage_type` MUST be classified strictly into one of:
  * `Structural_Failure`: Broken legs, snapped frames, cracked wood/glass, collapsed panels, unusable mechanical parts.
  * `Cosmetic_Damage`: Scratches (รอยขูดขีด), fabric tears (ผ้าขาด), minor paint chips/dents, cosmetic flaws that don't prevent use.
  * `Missing_Assembly_Hardware`: Missing screws, bolts, hinges, assembly manual, or incomplete parts pack.
- `photo_evidence_received`:
  * Set to `true` ONLY if customer explicitly states they sent pictures or videos via HomePro LINE Official Account (LINE OA) or chat.
  * Set to `false` if photos are still required or customer has not yet sent them.
- `incident_description`: Summarize clearly in Thai when and how damage happened.

### 3. Escalation & Routing Logic
- `escalation_required`:
  * `false`: If the damage is covered by standard 14-day swap policy and customer already provided photo evidence for an automatic 1-to-1 replacement.
  * `true`: If the issue requires on-site inspection, technician repair, delivery investigation, or third-party manufacturer warranty review.
- `escalation_target` (Required if escalation_required is true):
  * `Home_Service_Technician`: When on-site repair, hardware fixing, or assembly assistance is needed.
  * `Logistics_Delivery_Team`: When item was damaged in transit, box was crushed, or delivery replacement swap is scheduled.
  * `Furniture_Vendor_Support`: When manufacturer defect is detected or special parts must be ordered from the external factory/brand.

### 4. After-Call Work (ACW) & BLUF Free-Note Standard
- `call_disposition`: Tag system record strictly as `"Broken_Furniture_Intake"`.
- `ticket_status`:
  * `"Awaiting_Photos"`: If `photo_evidence_received` is `false`.
  * `"Replacement_Dispatched"`: If `escalation_required` is `false` (eligible for direct 1-to-1 swap).
  * `"Pending_Inspection"`: If `escalation_required` is `true` (waiting for technician or team review).
- `action_deadline`: Standard SLA is within 24–48 hours unless a specific appointment date was agreed upon during the call.
- `bluf_note`: Generate a high-density, professional Bottom-Line-Up-Front note for Tier-2 handoff.

## Conversational Context Awareness (CRITICAL)

Do NOT analyze turns in isolation. Interpret the full conversational flow:
1. **Agent-Ask → Customer-Answer**: When agent asks for info and customer answers, assign based on what was asked.
2. **Confirmation Validation**: When agent restates info and customer confirms (ใช่, ครับ, ค่ะ), accept it.
3. **Implicit Photo Confirmation**: If agent acknowledges receiving photos, set `photo_evidence_received` to `true`.
4. **Urgency & Priority**: Negative sentiment or structural safety hazards → `"high"` or `"urgent"`.

## Language Handling
Process natural spoken Thai, Tinglish, colloquial terms (เช่น ขาเก้าอี้โยก, น็อตหลวม, เบาะขาด, ลิ้นชักติด), and background disfluencies seamlessly.\
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
        return _parse_llm_json(content)
    except (KeyError, IndexError, json.JSONDecodeError, ValueError) as exc:
        raw = resp.text if resp else "(no response)"
        logger.error("LLM parse failure. Raw response: %s", raw)
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

    # HomePro triage fields (None when using mock)
    identity = Identity(**(raw["identity"])) if "identity" in raw else None
    issue_triage = IssueTriage(**(raw["issue_triage"])) if "issue_triage" in raw else None
    escalation_logic = EscalationLogic(**(raw["escalation_logic"])) if "escalation_logic" in raw else None
    after_call_work = None
    if "after_call_work" in raw:
        acw = raw["after_call_work"]
        bluf = BlufNote(**(acw["bluf_note"])) if "bluf_note" in acw else None
        after_call_work = AfterCallWork(
            call_disposition=acw.get("call_disposition"),
            ticket_status=acw.get("ticket_status"),
            action_deadline=acw.get("action_deadline"),
            bluf_note=bluf,
        )

    data = ExtractionData(
        extraction_id=f"ext_{uuid.uuid4().hex[:8]}",
        source=request.source,
        identity=identity,
        issue_triage=issue_triage,
        escalation_logic=escalation_logic,
        after_call_work=after_call_work,
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


# ---------------------------------------------------------------------------
# Audio prompt template
# ---------------------------------------------------------------------------

AUDIO_SYSTEM_PROMPT = """\
You are an Enterprise Thai Customer Service AI Triage Engine specialized in Voice Call Center operations for HomePro Furniture & Home Solutions.
The input is a RAW, unsegmented speech-to-text (ASR) transcript of a Thai customer service phone call.

## ASR Noise, Phonetics & Spelled-Out Number Normalization (CRITICAL)

The raw audio transcription WILL contain acoustic and speech-to-text noise. You must apply the following normalization rules:

1. **Spelled-Out Verbal Numbers to Digits**:
   - Convert verbal Thai digits into clean numeric strings without spaces:
     * "ศูนย์-แปด-หนึ่ง-เก้า-แปด-เจ็ด-หก-ห้า-สี่-สาม" ➔ `"0819876543"`
     * "ศูนย์-สอง-สาม-สี่-ห้า-หก-เจ็ด-แปด-เก้า" ➔ `"023456789"`
     * "เก้า-เก้า-แปด-สอง-สี่" ➔ `"99824"`
     * "หนึ่ง-สอง-ศูนย์ เซน" ➔ `"120cm"`
   - Handle colloquial numbering (เช่น "แปด-หนึ่ง-หนึ่ง", "เบอร์โทร โทร ศูนย์ แปด", "เอ็ด", "ยี่สิบ").

2. **ASR Phonetic & Tone Distortion Correction**:
   - Correct common speech recognition typos and tone errors:
     * "ซัก / ซักครู่" ➔ "สักครู่"
     * "คัพ / คับ / ค่าา" ➔ "ครับ / ค่ะ"
     * "มั้ย / ไม๊ / มั้ยคะ" ➔ "ไหม / ไหมคะ"
     * "ป่าว / รึป่าว" ➔ "เปล่า / หรือเปล่า"
     * "แอดมิน / คอลเซ็นเต้อ" ➔ "เจ้าหน้าที่ / Call Center"
     * "โฮมโป / โฮมโปร์" ➔ "HomePro"

3. **Speaker Turn Reconstruction**:
   - The raw speech stream may lack speaker labels. Infer turns from conversational intent:
     * `[agent]`: Polite opening ("ศูนย์บริการลูกค้าโฮมโปร สวัสดีครับ"), asking for info ("ขอทราบเบอร์โทร", "ขอเลขที่ใบเสร็จ"), offering warranty solutions.
     * `[customer]`: Reporting issues ("ขาโต๊ะหัก", "ประกอบไม่ได้"), providing member info, expressing frustration.
   - **CRITICAL: NEVER fabricate or invent dialogue.** Only label and clean up speech that actually exists in the raw transcript. If only one speaker is present in the audio, ALL turns belong to that single speaker. Do NOT generate fictional agent or customer responses to "fill in" a conversation.

4. **Zero-Width Space & Word Concatenation**:
   - Separate fused Thai words accurately (เช่น "โต๊ะทำงานรุ่นloftwoodขาหัก" ➔ "โต๊ะทำงานรุ่น Loft Wood ขาหัก").

## ⚠️ Anti-Hallucination Rule (MANDATORY)

The `reconstructed_transcript` must contain ONLY words and sentences that were actually spoken in the raw ASR input. You may:
- Fix spelling, tones, and punctuation
- Add speaker labels ([agent] / [customer])
- Separate fused words

You must NEVER:
- Invent new dialogue turns that do not exist in the input
- Add agent responses that were not spoken
- Create fictional conversational context to make the transcript "look complete"

If the audio contains only a customer monologue, the reconstructed transcript must be a customer monologue.

---

## Output JSON Schema (Strict JSON, no markdown codeblocks):

{
  "reconstructed_transcript": "<cleaned Thai dialogue with [agent] and [customer] turn labels and proper punctuation>",
  "identity": {
    "customer_phone": "<10-digit numeric phone number from HomeCard verification or null>",
    "order_invoice_no": "<invoice / receipt / order reference e.g. HP-INV-99824 or null>",
    "product_sku_model": "<furniture item or model name e.g. โต๊ะทำงานรุ่น Loft Wood 120cm or null>"
  },
  "issue_triage": {
    "furniture_damage_type": "<Structural_Failure | Cosmetic_Damage | Missing_Assembly_Hardware | null>",
    "photo_evidence_received": <true | false>,
    "incident_description": "<concise summary in Thai of how and when the furniture was damaged>"
  },
  "escalation_logic": {
    "escalation_required": <true | false>,
    "escalation_target": "<Home_Service_Technician | Logistics_Delivery_Team | Furniture_Vendor_Support | null>",
    "escalation_reason": "<clear justification for the selected escalation route>"
  },
  "after_call_work": {
    "call_disposition": "Broken_Furniture_Intake",
    "ticket_status": "<Pending_Inspection | Replacement_Dispatched | Awaiting_Photos>",
    "action_deadline": "<SLA window e.g. 'Within 48 hours', 'ภายใน 2 วัน', or agreed appointment date>",
    "bluf_note": {
      "bottom_line": "<1-sentence executive summary stating resolution/status and primary issue>",
      "context": "<concise key facts: damage details, item type, and LINE OA photo verification status>",
      "next_steps": "<action taken, assigned escalation team, and target SLA deadline>",
      "formatted_text": "<ready-to-paste 3-line BLUF note: [BLUF]: <bottom_line>\\n• Context: <context>\\n• Next Steps: <next_steps>>"
    }
  },
  "intent": {
    "primary": "<complaint | refund_request | shipping_inquiry | product_inquiry | general_inquiry>",
    "confidence": <0.0 to 1.0>
  },
  "sentiment": {
    "overall": "<positive | negative | neutral | mixed>",
    "score": <-1.0 to 1.0>
  },
  "entities": [
    {"type": "<phone_number | order_id | person_name | product_name | date | address>", "value": "<extracted_value>", "span": "<original_text>"}
  ],
  "crm_fields": {
    "customer_name": "<name or null>",
    "phone": "<customer_phone or null>",
    "email": "<email or null>",
    "order_id": "<order_invoice_no or null>",
    "issue_category": "<furniture_damage_type or intent>",
    "priority": "<low | normal | high | urgent>"
  }
}

---

## HomePro Furniture Triage & Business Logic:

1. **Damage Classification**:
   - `Structural_Failure`: Broken wooden legs, cracked glass, bent metal frames, broken hinges making the item unusable.
   - `Cosmetic_Damage`: Scratches, paint peeling, minor fabric tears, chipped laminate.
   - `Missing_Assembly_Hardware`: Missing screws, bolts, wooden dowels, hex keys, or missing assembly manuals.

2. **LINE OA Photo Verification**:
   - `photo_evidence_received`: Set to `true` if customer confirms sending photos to HomePro LINE OA or agent confirms receipt. Otherwise `false`.

3. **Escalation Rules**:
   - If within 14-day warranty with verified photos ➔ `escalation_required = false`, `escalation_target = "Logistics_Delivery_Team"` (1-to-1 replacement swap).
   - If repair/on-site assembly check is needed ➔ `escalation_required = true`, `escalation_target = "Home_Service_Technician"`.
   - If manufacturer defect / spare parts must be ordered ➔ `escalation_required = true`, `escalation_target = "Furniture_Vendor_Support"`.

4. **BLUF (Bottom Line Up Front) Standard**:
   - `bottom_line`: Immediate takeaway (What happened & current disposition).
   - `context`: Root cause, invoice number, and proof status.
   - `next_steps`: Ownership assignment, next action, and deadline.\
"""


# ---------------------------------------------------------------------------
# Audio extraction — public API
# ---------------------------------------------------------------------------


async def extract_from_audio(
    http_client: httpx.AsyncClient,
    transcript: str,
    source: str = "other",
    extract_fields: list[str] | None = None,
    *,
    pii_scrub_count: int = 0,
) -> ExtractionResponse:
    """Run extraction on an ASR transcript and return a typed response."""
    from app.schemas.request import DEFAULT_EXTRACT_FIELDS

    if extract_fields is None:
        extract_fields = list(DEFAULT_EXTRACT_FIELDS)

    start = time.perf_counter()

    if settings.thaillm_api_key == "mock":
        raw = _mock_extract_audio(transcript)
    else:
        raw = await _call_thaillm_audio(http_client, transcript)

    elapsed_ms = int((time.perf_counter() - start) * 1000)

    # Map raw dict → typed models
    intent = Intent(**raw["intent"]) if "intent" in raw and "intent" in extract_fields else None
    sentiment = (
        Sentiment(**raw["sentiment"])
        if "sentiment" in raw and "sentiment" in extract_fields
        else None
    )

    entities: list[Entity] = []
    if "entities" in raw and "entities" in extract_fields:
        for e in raw["entities"]:
            entities.append(Entity(**e))

    crm = CRMFields(**(raw.get("crm_fields") or {}))

    # HomePro triage fields (None when using mock)
    identity = Identity(**(raw["identity"])) if "identity" in raw else None
    issue_triage = IssueTriage(**(raw["issue_triage"])) if "issue_triage" in raw else None
    escalation_logic = EscalationLogic(**(raw["escalation_logic"])) if "escalation_logic" in raw else None
    after_call_work = None
    if "after_call_work" in raw:
        acw = raw["after_call_work"]
        bluf = BlufNote(**(acw["bluf_note"])) if "bluf_note" in acw else None
        after_call_work = AfterCallWork(
            call_disposition=acw.get("call_disposition"),
            ticket_status=acw.get("ticket_status"),
            action_deadline=acw.get("action_deadline"),
            bluf_note=bluf,
        )

    data = ExtractionData(
        extraction_id=f"ext_{uuid.uuid4().hex[:8]}",
        source=source,
        reconstructed_transcript=raw.get("reconstructed_transcript"),
        identity=identity,
        issue_triage=issue_triage,
        escalation_logic=escalation_logic,
        after_call_work=after_call_work,
        intent=intent,
        sentiment=sentiment,
        entities=entities,
        crm_fields=crm,
    )

    meta = Meta(
        model=settings.thaillm_model,
        input_type="audio",
        raw_transcript=transcript,
        processing_time_ms=elapsed_ms,
        pii_fields_scrubbed=pii_scrub_count,
    )

    return ExtractionResponse(data=data, meta=meta)


def _mock_extract_audio(transcript: str) -> dict[str, Any]:
    """Mock audio extraction using the same heuristics as chat."""
    logger.info("Using MOCK LLM for audio — analysing transcript with heuristics")

    intent = _detect_intent(transcript)
    sentiment = _detect_sentiment(transcript)
    entities = _extract_entities(transcript)

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

    if intent["primary"] == "complaint" or sentiment["overall"] == "negative":
        crm["priority"] = "high"

    return {
        "reconstructed_transcript": f"[transcript] {transcript}",
        "intent": intent,
        "sentiment": sentiment,
        "entities": entities,
        "crm_fields": crm,
    }


async def _call_thaillm_audio(
    http_client: httpx.AsyncClient,
    transcript: str,
) -> dict[str, Any]:
    """Send the audio transcript to ThaiLLM with the audio-specific prompt."""
    payload = {
        "model": settings.thaillm_model,
        "messages": [
            {"role": "system", "content": AUDIO_SYSTEM_PROMPT},
            {"role": "user", "content": f"Transcribe and analyse:\n---\n{transcript}\n---"},
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

    try:
        body = resp.json()
        content = body["choices"][0]["message"]["content"]
        return _parse_llm_json(content)
    except (KeyError, IndexError, json.JSONDecodeError, ValueError) as exc:
        raw = resp.text[:300] if resp else "(no response)"
        logger.error("LLM audio parse failure. Raw response: %s", raw)
        raise LLMUpstreamError(
            detail=f"Failed to parse LLM audio response: {exc}"
        ) from exc
