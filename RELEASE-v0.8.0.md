# Bankr Router v0.8.0 Release Notes

**Version:** 0.8.0  
**Date:** 2026-03-19  
**Commit:** 149a18f

## Summary
Final core router release with streaming support, config caching, structured logging, and expanded test coverage. This is the last planned feature release for the core router.

## New Features

### 1. Streaming Support (`stream: true`)
- Proper SSE passthrough for `/v1/chat/completions`
- All router headers preserved in streaming responses
- Retry logic stops before streaming starts (no mid-stream failover)
- Non-streaming path unchanged

### 2. Config Cache (5s TTL)
- In-memory catalog cache with mtime invalidation
- Avoids reparsing config on every request
- Auto-refreshes when config file changes

### 3. Structured Request Logging
- JSON logs to stderr
- Rotating file logs (`logs/requests.log`)
- Safe fields only (no full prompts or secrets):
  - `ts`, `plannedModel`, `finalModel`, `upstreamModel`
  - `tier`, `confidence`, `retryCount`, `statusCode`
  - `latencyMs`, `toolsDetected`, `structuredOutput`, `codeHeavy`
  - `promptHash` (SHA-256, not raw prompt)

### 4. Test Coverage
New tests for:
- `/v1/route` dry-run remains dry-run
- Config cache hit + refresh behavior
- Server startup and routing

## Router Headers (All Requests)
- `x-router-planned-model` — initial routing decision
- `x-router-final-model` — model after retries
- `x-router-upstream-model` — parsed from upstream response
- `x-router-attempted-models` — comma-separated retry chain
- `x-router-tier` — selected tier
- `x-router-confidence` — routing confidence (0-1)
- `x-router-retries` — number of retries (if any)

## Endpoints
- `POST /v1/route` — Planning only (dry-run)
- `POST /v1/chat/completions` — Real execution
- `GET /v1/stats` — Request statistics
- `GET /v1/diagnostics` — Config discovery info
- `GET /health` — Health check

## Recommended Usage

### Dry-run to see routing decision:
```bash
curl -s http://127.0.0.1:8787/v1/route \
  -H 'Content-Type: application/json' \
  -d '{"model":"bankr-router/auto","messages":[{"role":"user","content":"Hello"}]}'
```

### Real execution with streaming:
```bash
curl -N -s http://127.0.0.1:8787/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"bankr-router/auto","stream":true,"messages":[{"role":"user","content":"Hi"}]}'
```

### Follow-up inheritance:
```bash
curl -s http://127.0.0.1:8787/v1/route \
  -H 'x-session-id: my-session' \
  -H 'Content-Type: application/json' \
  -d '{"model":"bankr-router/auto","messages":[{"role":"user","content":"Yes"}]}'
```

## Environment Variables
- `BANKR_ROUTER_LOG_DIR` — Log directory (default: `./logs`)
- `BANKR_ROUTER_LOG_MAX_BYTES` — Max log file size (default: 5MB)
- `BANKR_ROUTER_LOG_BACKUPS` — Max backup files (default: 3)
- `BANKR_ROUTER_DEBUG` — Enable debug logging (set to "1")

## Files Changed
- `src/catalog.ts` — Added cached loader
- `src/server.ts` — Streaming, logging integration
- `src/logging.ts` — New structured logging module
- `src/server.test.ts` — New test suite
- `README.md` — Updated documentation
- `package.json` — Version bump

## Invariants Preserved
- `/v1/route` never executes upstream
- `finalModel`/`upstreamModel` tracking correct
- Stats keyed by final actual model
- `estimatedCost` stays raw cost only
- `rankingScore` separate from cost

## Migration from v0.7.1
No breaking changes. All v0.7.1 behavior preserved.
