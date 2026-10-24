# Aegis - LLM API Gateway

A Node.js, Express, and Redis gateway for LLM APIs. It adds the backend systems work that turns a model endpoint into a product: tenant quotas, semantic caching, operational health, and a clean provider boundary.

## Architecture

```text
Client
  |  X-API-Key
  v
Express Gateway --> API-key policy --> Redis sliding-window limiter (Lua)
  |                                        | reject: 429 + Retry-After
  v
Cache identity + semantic lookup --> hit: return cached completion
  |
  v
Provider port --> Local demo adapter (or an LLM provider adapter)
  |
  v
Semantic cache write --> response + metrics
```

## Features

- **API-key access control** - rejects unauthenticated requests before they reach a provider.
- **Atomic rate limiting** - Redis Lua script implements a distributed sliding window and returns `429 Too Many Requests` with `Retry-After`.
- **Semantic caching** - reuses responses for sufficiently similar prompts, with Redis TTL-based expiry.
- **Cache isolation** - tenant, model, temperature, and system prompt are included in the cache namespace.
- **Operational health checks** - `/health` reports Redis connectivity and circuit-breaker state.
- **Observability metrics** - `/metrics` exposes cache outcomes, rate-limit events, total HTTP requests, and cumulative request duration in milliseconds.
- **Containerized infrastructure** - Docker Compose runs the Node.js gateway and Redis, with a Redis health check and persistent cache storage.
- **Provider adapter** - ships with a deterministic local provider for demos and can be replaced by an OpenAI, Anthropic, or self-hosted adapter.

## Run with Docker (recommended)

```bash
docker compose up --build
```

Then send a request:

**macOS / Linux**

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key" \
  -d '{"model":"local-demo","messages":[{"role":"user","content":"Explain semantic caching in one sentence."}]}'
```

**Windows PowerShell**

```powershell
curl.exe -X POST "http://localhost:8000/v1/chat/completions" `
  -H "Content-Type: application/json" `
  -H "X-API-Key: demo-key" `
  -d '{"model":"local-demo","messages":[{"role":"user","content":"Explain semantic caching in one sentence."}]}'
```

Repeat it (or use a near-duplicate prompt) and inspect `X-Cache: HIT`. Health and metrics are available at `/health` and `/metrics`.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/chat/completions` | Sends a chat request through the gateway. Requires `X-API-Key`. |
| `GET /health` | Reports gateway and Redis health. |
| `GET /metrics` | Exposes cache-hit, cache-miss, rate-limit, HTTP request-count, and cumulative request-duration metrics. |

## Local development

```bash
pnpm install
pnpm dev
```

Set `REDIS_URL` if Redis is not running at `redis://localhost:6379`. The Docker Compose setup already configures this for you.

## Test

Run the automated test suite:

```bash
pnpm test
```

Tests cover semantic similarity, cache namespace isolation across generation settings, and the HTTP metrics endpoint.
