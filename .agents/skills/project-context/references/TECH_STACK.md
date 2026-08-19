# ChaiToke — Tech Stack

## Overview

ChaiToke is an AI-powered Thai customer service data extraction API. It ingests raw chat logs, detects intent/sentiment/entities via a Thai LLM, and returns structured JSON ready for CRM auto-fill.

---

## Language & Runtime

| | Detail |
|---|---|
| **Language** | Python 3.11+ |
| **Runtime** | CPython (tested on 3.14) |
| **Package Manager** | pip with `pyproject.toml` (PEP 621) |
| **Build Backend** | setuptools ≥ 68 |

---

## Core Framework

| Library | Version | Role |
|---------|---------|------|
| [FastAPI](https://fastapi.tiangolo.com/) | ≥ 0.115 | Async web framework — handles routing, validation, OpenAPI docs |
| [Uvicorn](https://www.uvicorn.org/) | ≥ 0.30 | ASGI server — runs the app locally and in production |
| [Pydantic](https://docs.pydantic.dev/) | ≥ 2.0 | Data validation & serialisation for request/response schemas |
| [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) | ≥ 2.0 | Loads config from environment variables and `.env` files |

---

## HTTP & AI Integration

| Library | Version | Role |
|---------|---------|------|
| [HTTPX](https://www.python-httpx.org/) | ≥ 0.27 | Async HTTP client — calls the ThaiLLM API (also used as test client) |
| ThaiLLM | - | External AI model for intent detection, sentiment analysis, and entity extraction. Currently mocked locally with a keyword + regex heuristic engine |

---

## Security & Rate Limiting

| Library | Version | Role |
|---------|---------|------|
| [SlowAPI](https://github.com/laurentS/slowapi) | ≥ 0.1.9 | Rate limiting (default: 60 req/min) |
| PII Scrubber (built-in) | - | Regex-based redaction of Thai national IDs, phone numbers, emails, and credit cards. Currently disabled via config; toggle with `PII_SCRUB_ENABLED=true` |

---

## Error Handling

All errors follow the **RFC 7807 Problem Details** standard (`application/problem+json`). Custom exception classes map to structured error responses with `type`, `title`, `status`, `detail`, and `instance` fields.

---

## Development & Testing

| Tool | Version | Role |
|------|---------|------|
| [Pytest](https://docs.pytest.org/) | ≥ 8.0 | Test runner |
| [pytest-asyncio](https://pytest-asyncio.readthedocs.io/) | ≥ 0.24 | Async test support for FastAPI endpoints |
| [Ruff](https://docs.astral.sh/ruff/) | ≥ 0.5 | Linter & formatter (replaces flake8 + black + isort) |

---

## Containerisation

| Tool | Role |
|------|------|
| [Docker](https://www.docker.com/) | Single-container build using `python:3.11-slim` base image |
| [Docker Compose](https://docs.docker.com/compose/) | Local orchestration — `docker compose up` to run the full stack |

---

## Project Structure

```
chaitoke/
├── app/
│   ├── api/              # Route handlers
│   │   ├── health.py     # GET /v1/health
│   │   └── v1/
│   │       ├── extractions.py  # POST /v1/extractions
│   │       └── router.py       # v1 router aggregation
│   ├── core/             # Cross-cutting concerns
│   │   ├── exceptions.py # Custom exception classes
│   │   └── middleware.py  # RFC 7807 error handler
│   ├── schemas/          # Pydantic models
│   │   ├── request.py    # ExtractionRequest
│   │   ├── response.py   # ExtractionResponse
│   │   └── errors.py     # ProblemDetail
│   ├── services/         # Business logic
│   │   ├── llm.py        # ThaiLLM integration + mock engine
│   │   └── pii.py        # PII scrubber
│   ├── config.py         # Settings from env vars
│   └── main.py           # FastAPI app factory
├── tests/
│   ├── fixtures/         # Sample test data
│   ├── test_extractions.py
│   ├── test_health.py
│   └── test_pii.py
├── pyproject.toml        # Dependencies & tool config
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Architecture Diagram

```
┌──────────┐     JSON      ┌─────────────────────────────────────┐
│ Frontend │───────────────▶│           FastAPI (Uvicorn)         │
│  (any)   │◀───────────────│                                     │
└──────────┘   JSON/RFC7807 │  ┌─────────┐  ┌──────┐  ┌───────┐ │
                            │  │ Validate │─▶│ (PII)│─▶│  LLM  │ │
                            │  │ Request  │  │Scrub │  │Extract│ │
                            │  └─────────┘  └──────┘  └───┬───┘ │
                            │                              │      │
                            │                     ┌────────▼────┐ │
                            │                     │ ThaiLLM API │ │
                            │                     │  (or mock)  │ │
                            │                     └─────────────┘ │
                            └─────────────────────────────────────┘
```

---

## Key Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `THAILLM_API_KEY` | `mock` | Set to your real API key to use ThaiLLM; `mock` uses the built-in heuristic engine |
| `THAILLM_BASE_URL` | `https://api.thaillm.example.com` | ThaiLLM API endpoint |
| `THAILLM_MODEL` | `thaillm-v1` | Model name |
| `THAILLM_TIMEOUT_SECONDS` | `30` | Request timeout |
| `PII_SCRUB_ENABLED` | `false` | Toggle PII scrubbing |
| `APP_ENV` | `development` | Environment name |
| `APP_DEBUG` | `true` | Debug mode |
| `RATE_LIMIT` | `60/minute` | API rate limit |
