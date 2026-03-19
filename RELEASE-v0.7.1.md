# Bankr Router v0.7.1

Correctness release for routing, reporting, stats, and follow-up inheritance.

## Highlights

### ✅ Planned vs final model tracking
- `x-router-planned-model` always reflects the initial routing decision
- `x-router-final-model` and `x-router-selected-model` reflect the successful model
- `x-router-upstream-model` parsed from upstream JSON response
- `x-router-attempted-models` and `x-router-attempts` show retry chain

### ✅ Follow-up inheritance stability
- Stable session derivation order:
  1) `x-session-id` header
  2) body `session_id` / `conversation_id` / `thread_id`
  3) deterministic fallback from model + normalized system prompt + first user message
- No volatile headers or timestamps used

### ✅ Stats accuracy
- Stats keyed by final model, not planned model
- `lastDecisions` contains immutable per-request snapshots:
  - plannedModel, finalModel, upstreamModel
  - tier, toolsDetected, structuredOutput, codeHeavy
  - retryCount, success, statusCode

### ✅ Detection consistency
- `toolsDetected` only when tools array exists and non-empty
- `structuredOutput` recognizes `json_schema`, `json_object`, and JSON/YAML prompts
- Shared detection results used across routing, stats, and reliability

### ✅ Cost estimation correctness
- `estimatedCost` always raw monetary estimate (never negative)
- `rankingScore` used for ranking preferences

### ✅ Reliability cleanup
- Reliability tracked per attempted model only
- Correct success/failure/timeout/rate-limit counts
- No stale shared-state contamination

---

## Documentation updates
- README clarifies `/v1/route` is dry-run only
- `/v1/chat/completions` is real execution
- `x-session-id` recommended for deterministic follow-up inheritance

---

## Upgrade Notes
No breaking changes. Existing integrations continue to work. If you want deterministic follow-up inheritance, pass a stable `x-session-id` per conversation.
