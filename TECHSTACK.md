# ChaiToke — Tech Stack

## Overview

ChaiToke is an AI-powered Thai customer service data extraction API built for the **SciPSU AI Hackathon**. It specializes in analyzing HomePro Furniture & Home Solutions customer interactions from **LINE chat logs** and **voice calls**, extracting structured triage data for CRM integration.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Client (curl / Frontend)         │
└──────────────┬───────────────────────────────────────┘
               │  HTTPS (TLS via Caddy)
               ▼
┌──────────────────────────────────────────────────────┐
│              Caddy (Reverse Proxy + Auto-SSL)        │
│              team8.105app.site:443 → localhost:8000   │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│              Docker Container                        │
│  ┌────────────────────────────────────────────────┐  │
│  │           FastAPI + Uvicorn (:8000)             │  │
│  │                                                │  │
│  │  ┌──────────────┐  ┌────────────────────────┐  │  │
│  │  │  API Layer   │  │   Service Layer        │  │  │
│  │  │              │  │                        │  │  │
│  │  │ /chat/analyze│──│─▶ LLM Service          │──│──│──▶ ThaiLLM API
│  │  │ /audio/analyze──│─▶ ASR Service           │──│──│──▶ Google STT API
│  │  │ /line/parse  │──│─▶ LINE Parser Service   │  │  │
│  │  │ /health      │  │  PII Scrubber Service  │  │  │
│  │  └──────────────┘  └────────────────────────┘  │  │
│  │                                                │  │
│  │  ┌──────────────┐  ┌────────────────────────┐  │  │
│  │  │   Schemas    │  │    Config (pydantic)   │  │  │
│  │  │ Request/Resp │  │    .env → Settings     │  │  │
│  │  └──────────────┘  └────────────────────────┘  │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## Core Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Language** | Python 3.11+ | Runtime |
| **Web Framework** | FastAPI | Async REST API with auto-generated OpenAPI docs |
| **ASGI Server** | Uvicorn | Production-grade async server |
| **Data Validation** | Pydantic v2 | Request/response schema validation & serialization |
| **Configuration** | pydantic-settings | Type-safe `.env` file loading |
| **HTTP Client** | httpx | Async HTTP calls to external APIs (ThaiLLM, Google STT) |
| **Rate Limiting** | SlowAPI | Per-endpoint request throttling |
| **File Uploads** | python-multipart | Audio file upload handling |

---

## External APIs

### ThaiLLM (openthaigpt-thaillm-8b-instruct-v7.2)
- **Purpose**: Conversation analysis — intent classification, sentiment scoring, entity extraction, HomePro furniture triage, escalation logic, and BLUF note generation.
- **How it works**: Receives a system prompt with the HomePro JSON schema + user message containing the conversation transcript. Returns structured JSON.
- **Handles**: `<think>` block stripping and markdown fence removal for clean JSON parsing.

### Google Cloud Speech-to-Text (STT)
- **Purpose**: Transcribes Thai audio files (WAV/MP3) into text.
- **How it works**: Audio is sent to Google's REST API (`v1/speech:recognize`) with Thai language config (`th-TH`). The transcript is then passed to ThaiLLM for analysis.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/health` | GET | Health check + LLM reachability probe |
| `/v1/chat/analyze` | POST | Analyze structured chat JSON (customer/agent messages) |
| `/v1/audio/analyze` | POST | Upload audio file → Google STT transcription → LLM analysis |
| `/v1/line/parse` | POST | Parse raw LINE chat export text → structured JSON compatible with `/v1/chat/analyze` |

---

## Data Flow

### Chat Analysis
```
Client sends JSON ──▶ FastAPI validates schema ──▶ LLM Service
    (messages)           (Pydantic models)         builds prompt
                                                       │
                                                       ▼
                                                  ThaiLLM API
                                                       │
                                                       ▼
                                              Parse JSON response
                                            (strip <think> blocks)
                                                       │
                                                       ▼
                                              Map to Pydantic models
                                           (Identity, IssueTriage, etc.)
                                                       │
                                                       ▼
                                              Return ExtractionResponse
```

### Audio Analysis
```
Client uploads WAV/MP3 ──▶ Validate format & size ──▶ Google STT API
                                                          │
                                                    Thai transcript
                                                          │
                                              (optional PII scrub)
                                                          │
                                                          ▼
                                                    ThaiLLM API
                                                          │
                                                          ▼
                                              Return ExtractionResponse
```

### LINE Log Parsing
```
Client sends raw text ──▶ Parse date headers ──▶ Extract messages
   + customer_name          & message lines       (filter stickers,
   + agent_name                                    system events)
                                                       │
                                                       ▼
                                              Map usernames → roles
                                              (customer / agent)
                                                       │
                                                       ▼
                                              Validate ≤ 2 participants
                                                       │
                                                       ▼
                                              Return JSON compatible
                                              with /v1/chat/analyze
```

---

## Project Structure

```
app/
├── main.py                  # FastAPI app factory + lifespan
├── config.py                # Settings from .env (API keys, model config)
├── api/
│   ├── health.py            # GET /v1/health
│   └── v1/
│       ├── router.py        # Mounts all v1 routers
│       ├── chat.py          # POST /v1/chat/analyze
│       ├── audio.py         # POST /v1/audio/analyze
│       └── line.py          # POST /v1/line/parse
├── schemas/
│   ├── request.py           # ExtractionRequest, Message models
│   └── response.py          # ExtractionResponse, Identity, IssueTriage, etc.
├── services/
│   ├── llm.py               # ThaiLLM integration + prompts + mock mode
│   ├── asr.py               # Google Cloud STT integration
│   ├── pii.py               # PII scrubbing (Thai ID, phone, email, etc.)
│   └── line_parser.py       # LINE chat log text parser
└── core/
    └── exceptions.py        # Custom HTTP exceptions
tests/
├── conftest.py              # Shared fixtures (mock mode)
├── test_health.py
├── test_extractions.py
├── test_audio.py
├── test_pii.py
└── test_line_parser.py
```

---

## Infrastructure & Deployment

| Component | Technology |
|-----------|-----------|
| **Containerization** | Docker (python:3.11-slim) |
| **Reverse Proxy** | Caddy (auto Let's Encrypt HTTPS) |
| **Server** | Linux VPS (2-core CPU, 4GB RAM, no GPU) |
| **Domain** | team8.105app.site |
| **CI** | Git push → SSH → docker build → docker run |

---

## Dev Tools

| Tool | Purpose |
|------|---------|
| **pytest** + **pytest-asyncio** | Async test suite (29 tests) |
| **ruff** | Linting & formatting |
| **httpx** (test client) | ASGI transport testing (no real server needed) |

---

## Mock Mode

When `THAILLM_API_KEY=mock` (default), the app uses built-in heuristics instead of calling external APIs:
- **LLM**: Keyword-based intent detection + regex entity extraction
- **ASR**: Returns a dummy transcript

This enables:
- Running the full test suite offline (no API keys needed)
- Local development without API costs
- CI/CD without secrets
