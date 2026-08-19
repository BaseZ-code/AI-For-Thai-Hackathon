# ChaiToke API — Frontend Integration Guide

## Base URL

```
http://localhost:8000/v1
```

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/extractions` | Extract structured data from chat logs |
| `GET` | `/v1/health` | Health check |

---

## `POST /v1/extractions`

### Request

**Content-Type:** `application/json`

```json
{
  "source": "line",
  "messages": [
    {
      "role": "customer",
      "content": "สวัสดีค่ะ สอบถามเรื่อง order #TH12345 ค่ะ",
      "timestamp": "2026-08-19T03:00:00Z"
    },
    {
      "role": "agent",
      "content": "สวัสดีค่ะ รับทราบค่ะ",
      "timestamp": "2026-08-19T03:01:00Z"
    }
  ],
  "extract": ["intent", "sentiment", "entities"]
}
```

### Request Fields

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `source` | `string` | ✅ | `"line"` \| `"facebook"` \| `"other"` | Platform the chat came from |
| `messages` | `array` | ✅ | Min 1 item | Chat messages in chronological order |
| `messages[].role` | `string` | ✅ | `"customer"` \| `"agent"` \| `"system"` | Who sent the message |
| `messages[].content` | `string` | ✅ | 1–10,000 chars | The message text |
| `messages[].timestamp` | `string` | ❌ | ISO 8601 format | When the message was sent |
| `extract` | `array` | ❌ | Items: `"intent"` \| `"sentiment"` \| `"entities"` | What to extract. Defaults to all three if omitted |

### Success Response — `200 OK`

```json
{
  "data": {
    "extraction_id": "ext_a1b2c3d4",
    "source": "line",
    "intent": {
      "primary": "order_inquiry",
      "confidence": 0.94
    },
    "sentiment": {
      "overall": "neutral",
      "score": 0.12
    },
    "entities": [
      {
        "type": "order_id",
        "value": "TH12345",
        "span": "order #TH12345",
        "pii_scrubbed": false
      },
      {
        "type": "person_name",
        "value": "สมศรี",
        "span": "ชื่อสมศรี",
        "pii_scrubbed": false
      },
      {
        "type": "phone_number",
        "value": "0812345678",
        "span": "0812345678",
        "pii_scrubbed": false
      }
    ],
    "crm_fields": {
      "customer_name": "สมศรี",
      "phone": "0812345678",
      "email": null,
      "order_id": "TH12345",
      "issue_category": "order_inquiry",
      "priority": "normal"
    }
  },
  "meta": {
    "model": "thaillm-v1",
    "processing_time_ms": 842,
    "pii_fields_scrubbed": 0
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `data.extraction_id` | `string` | Unique ID for this extraction (starts with `ext_`) |
| `data.source` | `string` | Echoes back the source platform |
| `data.intent.primary` | `string` | Detected intent (see Intent Labels below) |
| `data.intent.confidence` | `number` | Confidence score (0.0–1.0) |
| `data.sentiment.overall` | `string` | `"positive"` \| `"negative"` \| `"neutral"` \| `"mixed"` |
| `data.sentiment.score` | `number` | Sentiment score (-1.0 to 1.0) |
| `data.entities` | `array` | Extracted entities |
| `data.entities[].type` | `string` | Entity type (see Entity Types below) |
| `data.entities[].value` | `string` | Extracted value |
| `data.entities[].span` | `string` | Original text where the entity was found |
| `data.entities[].pii_scrubbed` | `boolean` | `true` if the value was redacted for privacy |
| `data.crm_fields` | `object` | Pre-mapped fields ready for CRM auto-fill |
| `data.crm_fields.customer_name` | `string \| null` | Customer name if detected |
| `data.crm_fields.phone` | `string \| null` | Phone number if detected |
| `data.crm_fields.email` | `string \| null` | Email if detected |
| `data.crm_fields.order_id` | `string \| null` | Order/reference ID if detected |
| `data.crm_fields.issue_category` | `string` | Same as `intent.primary` |
| `data.crm_fields.priority` | `string` | `"low"` \| `"normal"` \| `"high"` \| `"urgent"` |
| `meta.model` | `string` | LLM model used |
| `meta.processing_time_ms` | `integer` | Processing time in milliseconds |
| `meta.pii_fields_scrubbed` | `integer` | Number of PII fields that were redacted |

> **Note:** `intent`, `sentiment`, and `entities` will be `null` / `[]` if not included in the `extract` array.

### Intent Labels

| Label | When |
|-------|------|
| `greeting` | Customer is saying hello |
| `order_inquiry` | Asking about an order |
| `shipping_inquiry` | Asking about shipping/tracking |
| `product_inquiry` | Asking about a product or service |
| `complaint` | Reporting a problem or expressing dissatisfaction |
| `refund_request` | Requesting a refund |
| `order_cancellation` | Requesting to cancel an order/subscription |
| `payment_issue` | Issues with payment |
| `account_inquiry` | Account-related questions |
| `general_inquiry` | Anything else |

### Entity Types

| Type | Example Value |
|------|--------------|
| `phone_number` | `"0812345678"`, `"081-234-5678"` |
| `order_id` | `"TH12345"`, `"885432"` |
| `person_name` | `"สมศรี"`, `"ทาจ บอร์ธวิค"` |
| `email` | `"user@example.com"` |
| `product_name` | `"แพ็กเกจรายเดือน"` |
| `date` | `"19/08/2026"` |
| `address` | `"123 ถ.สุขุมวิท"` |
| `company_name` | `"บริษัท ABC"` |

---

## Error Responses

All errors return `Content-Type: application/problem+json` ([RFC 7807](https://www.rfc-editor.org/rfc/rfc7807)).

```json
{
  "type": "https://chaitoke.dev/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more request fields failed validation.",
  "instance": "/v1/extractions",
  "errors": [
    { "field": "messages", "message": "Ensure this value has at least 1 item." }
  ]
}
```

| Status | Meaning | When |
|--------|---------|------|
| `422` | Validation Error | Missing/invalid fields (empty `messages`, bad `source`, etc.) |
| `400` | Bad Request | Malformed JSON body |
| `502` | LLM Upstream Error | AI model returned an error |
| `504` | LLM Timeout | AI model didn't respond in time |

---

## `GET /v1/health`

No request body needed.

### Response — `200 OK`

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "llm_reachable": true
}
```

---

## Code Examples

### Fetch (vanilla JS)

```js
const response = await fetch("http://localhost:8000/v1/extractions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    source: "line",
    messages: [
      { role: "customer", content: "สอบถามเรื่อง order #TH12345 ค่ะ" }
    ]
  })
});

if (!response.ok) {
  const error = await response.json();
  console.error(error.title, error.detail);
  return;
}

const { data, meta } = await response.json();
// data.crm_fields is ready for CRM auto-fill
```

### Axios

```js
try {
  const { data } = await axios.post("http://localhost:8000/v1/extractions", {
    source: "line",
    messages: [
      { role: "customer", content: "สอบถามเรื่อง order #TH12345 ค่ะ" }
    ]
  });
  // data.data.crm_fields is ready for CRM auto-fill
} catch (err) {
  if (err.response) {
    console.error(err.response.data.title, err.response.data.detail);
  }
}
```

---

## Interactive API Docs

When the server is running, visit **http://localhost:8000/docs** for Swagger UI where you can try requests interactively.
