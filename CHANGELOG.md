# Changelog

## [0.9.0] - 2026-03-26
### Added
- **Intelligent Routing**: Implemented `latestPrompt` slicing (first 500 + last 500 chars) to prevent conversation history pollution from driving up routing tiers unnecessarily.
- **Tier-based Cost Optimization**: Shifted routine tool followups and simple chat to `MEDIUM` tier (gemini-3.1-flash-lite) to preserve costs.
- **Hard Routing Rules**: Forced agentic/code loops to `COMPLEX` tier (gemini-3.1-pro) via local intent detection.
- **Reliability Enhancements**: 
    - Added `degraded.ts` for intercepting false-positive 200s (empty/loops) to trigger failover retries.
    - Added `budget.ts` for strict/graceful cost guards, supporting automated tier downgrades and 402 rejection.
    - Added per-model cooldown isolation.

### Fixed
- Addressed routing leakage where standard coding tasks defaulted to `REASONING`.
- Fixed token consumption spikes by optimizing cache usage in build loops.

## v0.7.1

**Correctness & Reliability Release**

**Highlights:**
- ✅ **Planned vs final model tracking** – Headers now correctly show planned/final/upstream models
- ✅ **Follow-up inheritance stability** – Deterministic session IDs with `x-session-id` support
- ✅ **Stats accuracy** – Keyed by final actual model, not planned model
- ✅ **Detection consistency** – Tools, structured output, and code detection shared across routing/stats

**Added headers:**
- `x-router-planned-model` – Initial routing decision
- `x-router-final-model` – Model that succeeded after retries
- `x-router-upstream-model` – Parsed from upstream JSON response
- `x-router-attempted-models` – Full retry chain attempted

**Fixes:**
- Stats keyed by final actual model, not planned model
- Structured output detection for `json_schema`/`json_object`
- Reliability tracked per attempted model only
- Cost estimation separated from ranking scores
- Session ID stability for follow-up inheritance

## v0.7.0

**Tool/Code-aware routing with reliability scoring**

**Highlights:**
- 🛠️ **Tool-aware routing** – Detects tools array and routes to tool-capable models
- 🧮 **Code-heavy routing** – Recognizes code-heavy prompts for higher-tier models
- 📊 **Live reliability scoring** – Success/failure/timeout tracking per model
- 🔄 **Auto-retry with fallback chain** – Retry on 429, 500, timeout etc.

**Features:**
- `/v1/route` endpoint for dry-run routing decisions
- Reliability-based ranking with real-time success rates
- Retry loop with configurable fallback chain
- Structured output detection (JSON schema support)

## v0.6.0

**Security & Hardening Release**

**Highlights:**
- 🔒 **Auth token support** – Optional authentication for router endpoints
- ⏱️ **Rate limiting** – Per-minute request limits configurable per IP
- ⚡ **Upstream timeouts** – Configurable timeouts for upstream requests
- 📊 **Enhanced stats & health** – Detailed `/v1/stats` and enriched `/health` endpoints

**Added features:**
- Follow-up inheritance for short prompts within same session
- Safe multilingual keyword matching (non-Latin scripts support)
- Request statistics with reliability tracking
- Session-aware routing with conversation state

**Most useful:**
- Production-ready with authentication and rate limiting
- Better observability with comprehensive stats
- Session continuity for follow-up prompts

## v0.5.5

- Remove machine-specific config fallback
- Refresh README + skill docs with portable paths and safer troubleshooting
- Expand diagnostics guidance and router/upstream failure notes

## v0.5.0

- Fixed hardcoded OpenClaw config path fallback
- Added OpenClaw config auto-discovery
- Updated docs for current OpenClaw schema
- Improved troubleshooting and diagnostics
- Updated skill documentation
