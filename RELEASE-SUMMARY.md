# Bankr Router Releases - Feature Overview

## v0.7.1 (Latest) - Correctness & Reliability
**Most useful features:**
- ✅ **Planned vs final model tracking** – Headers now correctly distinguish between planned routing and actual execution
- ✅ **Follow-up inheritance** – Short prompts inherit previous tier when confidence is high (use `x-session-id`)
- ✅ **Stats accuracy** – All statistics now keyed by final actual model used for inference
- ✅ **Detection consistency** – Same detection logic shared across routing, stats, and reliability

**Key use case:** Production routing with reliable observability and deterministic session behavior.

---

## v0.7.0 - Tool/Code-aware routing with reliability scoring
**Most useful features:**
- 🛠️ **Tool-aware routing** – Automatically routes to tool-capable models when tools array present
- 🧮 **Code-heavy detection** – Recognizes programming languages and routes to higher-tier models
- 📊 **Live reliability scoring** – Real-time success/failure/timeout tracking with automatic ranking
- 🔄 **Auto-retry with fallback chain** – Retries on 429, 500, timeout with configurable fallback models

**Key use case:** Complex workflows with tools, code generation, and reliable fallback behavior.

---

## v0.6.0 - Security & Hardening
**Most useful features:**
- 🔒 **Auth token support** – Optional authentication for router endpoints
- ⏱️ **Rate limiting** – Per-minute request limits configurable per IP
- ⚡ **Upstream timeouts** – Configurable timeouts for upstream requests
- 📊 **Enhanced stats & health** – Detailed `/v1/stats` and enriched `/health` endpoints

**Key use case:** Production deployments requiring security, rate limiting, and better observability.

---

## v0.5.5 - Portability & docs
- ✅ Portable config paths (no machine-specific fallbacks)
- ✅ Improved troubleshooting and diagnostics guidance
- ✅ Skill docs updated for agent-friendly installation

---

## v0.5.0 - Config auto-discovery
- ✅ Auto-discovers OpenClaw config locations
- ✅ Updated for current OpenClaw schema
- ✅ Enhanced diagnostics for config discovery failures

---

## What each release fixes & adds

| Release | What it fixes | What it adds |
|---------|---------------|--------------|
| **v0.7.1** | Stats keyed wrong, session instability, detection inconsistency | Planned/final model headers, deterministic session IDs, shared detection |
| **v0.7.0** | No tool/code awareness, no reliability scoring | Tool/code detection, reliability scoring, auto-retry, fallback chain |
| **v0.6.0** | No security features, limited observability | Auth tokens, rate limiting, timeouts, enhanced stats/health |
| **v0.5.5** | Machine-specific config fallback breaking portability | Portable paths, better troubleshooting docs |
| **v0.5.0** | Hardcoded config path requiring manual editing | Config auto-discovery, current schema support |

---

## Recommended for new users
Start with **v0.7.1** – it has all the correctness fixes plus tool/code awareness and reliability scoring.

## Migration guidance
- If upgrading from v0.7.0: No breaking changes, just correctness improvements
- If upgrading from v0.5.x: New headers and stats behavior, better observability
- For follow-up inheritance: Use `x-session-id` header for deterministic behavior

## Quick headers reference
```bash
# Dry-run planning
curl http://localhost:8787/v1/route ...

# Real execution (includes these headers)
x-router-planned-model: gemini-3.1-flash-lite  # Initial routing decision
x-router-final-model: gpt-5-nano               # Model that succeeded
x-router-upstream-model: openai/gpt-5-nano-2025-08-07  # From upstream JSON
x-router-attempted-models: deepseek-v3.2,gpt-5-nano    # Retry chain
x-router-attempts: 2                                 # Number of retries
```