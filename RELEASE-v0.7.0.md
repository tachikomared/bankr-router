# Bankr Router v0.7.0

Tool-aware routing, code specialization, and live reliability scoring.

## New Features

### 🛠️ Tool-aware routing
- Detects `tools` array in OpenAI payloads
- Detects `response_format: "json"` and `json_schema` requests
- Automatically reranks away from weak cheap models when tools or structured output are required
- Added `toolsDetected` and `structuredOutput` signals to routing decision

### 💻 Code-specialized routing
- Enhanced code detection with boundary-aware matching
- Prefers `qwen3-coder` for eco/auto code-heavy tasks
- Prefers `gpt-5.2-codex` for premium code-heavy tasks
- Does not let coder models dominate non-code requests
- Added `codeHeavy` signal to routing decision

### 📊 Live local model reliability scoring
- New per-model success/failure tracking in memory
- Tracks success rate, timeouts, rate limits, tool/structured success rates
- Automatic deranking of models after repeated failures
- `computeReliabilityScore()` for dynamic routing adjustments

### 📈 Enhanced `/v1/stats` endpoint
- Added `toolRequests`, `structuredRequests`, `codeHeavyRequests` counters
- Per-model success rates with tool/structured breakdowns
- `lastDecisions` ring buffer (last 50 routing decisions)
- Full reliability store exposed in JSON

### 🎯 Backward compatible
- All v0.6 features remain stable
- No changes to scorer weights or tier boundaries
- No context shaping or provider wiring refactors

## Technical Changes

### New Files
- `src/reliability.ts` – model reliability scoring store
- Enhanced `src/router/selector.ts` with tool/structured/code reranking
- Enhanced `src/stats.ts` with reliability integration
- Updated `src/router/types.ts` with new signal types

### API Changes
- `/v1/route` response includes new fields: `toolsDetected`, `structuredOutput`, `codeHeavy`
- `/v1/stats` returns enriched reliability data

## Upgrade Notes

No breaking changes. Existing integrations continue to work as before. The router now makes smarter decisions for tool/structured/code requests.

## Version History
- **v0.7.0** – Tool-aware routing, code specialization, reliability scoring
- **v0.6.0** – Safer multilingual keyword matching, follow-up inheritance, retry chain, stats
- **v0.5.5** – Initial stable release with tier-based routing