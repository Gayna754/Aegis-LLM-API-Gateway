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

## Run with Docker (recommended)

```bash
docker compose up --build
```

Then send a request:

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key" \
  -d '{"model":"local-demo","messages":[{"role":"user","content":"Explain semantic caching in one sentence."}]}'
```

Repeat it (or use a near-duplicate prompt) and inspect `X-Cache: HIT`. Health and metrics are available at `/health` and `/metrics`.

For local Node development, run `pnpm install`, start Redis locally, then run `pnpm dev`.

## Design notes worth discussing in an interview

Redis is used for both stateful concerns. The rate limiter uses a Lua script with a sorted set, keeping check-and-increment atomic across gateway replicas. The semantic cache stores normalized token vectors and cache entries in Redis. For a high-cardinality production corpus, replace the candidate lookup with Redis Stack vector search or pgvector; the gateway contract stays unchanged.

Rate limits count attempts before the cache lookup. That protects the gateway itself from abuse; an alternative policy can charge only provider calls when the product prioritizes cache-friendly usage. The cache never treats similarity alone as authorization: tenant, model, system prompt, and temperature are part of its exact namespace.

## Verify

```bash
pnpm test
```

## Resume-ready project entry

**Aegis - LLM API Gateway** | Node.js, Express.js, Redis, Docker, REST APIs

- Built a multi-tenant LLM API gateway with Node.js, Express.js, and Redis, enforcing API-key access and atomic sliding-window rate limits with `429` and `Retry-After` responses.
- Designed a semantic cache with cosine similarity, Redis TTLs, and request-configuration namespaces to reduce repeated model calls without cross-tenant or stale-response leakage.
- Containerized the gateway and Redis with Docker Compose; added health checks, request IDs, and metrics endpoints for observable, microservice-ready local deployments.

Only claim measured cache-hit, latency, or cost figures after running the included benchmark against a chosen workload.
