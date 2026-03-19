# Bankr Router

**Smart AI Model Router for OpenClaw + Bankr Gateway**

> **For normies:** Bankr Router is like having a smart assistant for your AI chats. You just talk to one "bankr-router" model, and it automatically picks the *best* AI model for your specific request—faster, cheaper, and smarter—while keeping everything on Bankr.

## 🚀 **What It Does (Plain English)**

You have access to 20+ different AI models through Bankr. But:
- Which one is best for **coding questions**?
- Which one is cheapest for **simple chat**?  
- Which one handles **tools and structured data**?
- Which one should **retry** if one fails?

Instead of you guessing, **Bankr Router automatically picks the right model** based on what you're asking for.

---

## ⚡ **Hot Functions (Why You Want This)**

### 1. **Auto-Smart Routing**
- **Simple chat** → uses cheap/fast models (`gemini-3.1-flash-lite`)
- **Coding questions** → routes to code-strong models (`deepseek-v3.2`)
- **Tool requests** → picks tool-capable models
- **Reasoning tasks** → uses high-tier models (`gpt-5-nano`)

### 2. **Follow-up Smartness**
Use `x-session-id` header and your short follow-ups like "yes", "continue" will inherit the previous model selection—no re-guessing.

### 3. **Auto-Retry When Models Fail**
If a model is busy (429) or times out, router automatically tries the next best option in the chain.

### 4. **See What's Happening**
Headers show exactly what happened:
```
x-router-planned-model: gemini-3.1-flash-lite  (what router picked)
x-router-final-model: gpt-5-nano               (what actually worked)
x-router-upstream-model: openai/gpt-5-nano-2025-08-07  (upstream model)
x-router-attempted-models: deepseek-v3.2,gpt-5-nano    (retry chain)
```

---

## 📦 **Quick Feature Summary**

| Version | What it added | Hot Feature |
|---------|---------------|-------------|
| **v0.7.1** (Latest) | Correctness & reliability | Planned vs final model tracking, deterministic sessions |
| **v0.7.0** | Tool/code-aware routing | Auto-detects tools/code, reliability scoring, auto-retry |
| **v0.6.0** | Security hardening | Auth tokens, rate limiting, enhanced stats |
| **v0.5.x** | Basic routing | Auto model selection, diagnostics |

---

## 🎯 **Use Cases (Real Examples)**

**You:** "Write a Python script to sort data"
**Router:** Detects code → picks `deepseek-v3.2` (good at code)

**You:** "Explain quantum computing simply"
**Router:** Simple question → picks `gemini-3.1-flash-lite` (fast/cheap)

**You:** "Return JSON with user data"
**Router:** Sees structured output → picks `gpt-5-nano` (good at JSON)

**You:** "Continue with that idea"
**Router:** With `x-session-id` → keeps same model as before

---

## 💡 **For Regular People**

Instead of:
- "Which model should I use?" ← You don't need to know
- "Is this model good for coding?" ← Router knows
- "What if the model fails?" ← Router retries automatically
- "How much did that cost?" ← Router picks cost-effective options

You just:  
**Talk to `bankr-router/auto` and let it handle the rest.**

---

*Developed by TachikomaRed together with its creator, smolemaru.*

## 🔧 **Quick Install (2 minutes)**

```bash
git clone https://github.com/tachikomared/bankr-router.git
cd bankr-router
npm install
npm run build
```

```bash
git clone https://github.com/tachikomared/bankr-router.git
cd bankr-router
npm install
npm run build
```

## Quick config (copy/paste)

1) **Load plugin**
```json
{
  "plugins": {
    "load": { "paths": ["/path/to/bankr-router"] },
    "entries": {
      "bankr-router": {
        "enabled": true,
        "config": {
          "host": "127.0.0.1",
          "port": 8787,
          "openclawConfigPath": null,
          "bankrProviderId": "bankr",
          "routerProviderId": "bankr-router"
        }
      }
    }
  }
}
```

2) **Provider + defaults**
```json
{
  "models": {
    "providers": {
      "bankr-router": {
        "baseUrl": "http://127.0.0.1:8787/v1",
        "apiKey": "local-router"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "bankr-router/auto",
        "fallbacks": ["bankr-router/eco"]
      }
    }
  }
}
```

## Requirements

- Node.js 20+
---

## ⚙️ **Requirements**

- OpenClaw >= 0.4.0
- Bankr provider installed (`bankr llm setup openclaw --install`)
- Bankr API key in OpenClaw config or `BANKR_LLM_KEY` env

---

## 🛠️ **Installation (Pick One)**

### **Option A: Quick Local Install (Recommended)**
```bash
git clone https://github.com/tachikomared/bankr-router.git
cd bankr-router
npm install
npm run build
```

Then add to OpenClaw config:
```json
{
  "plugins": {
    "load": { "paths": ["/path/to/bankr-router"] },
    "entries": {
      "bankr-router": { "enabled": true }
    }
  }
}
```

### **Option B: OpenClaw Plugin CLI**
```bash
openclaw plugins install /path/to/bankr-router
# or
openclaw plugins install https://github.com/tachikomared/bankr-router
```

---

## ⚙️ **Configuration (Required)**

Add these two sections to your OpenClaw config:

### **1. Provider Setup**
```json
{
  "models": {
    "providers": {
      "bankr-router": {
        "baseUrl": "http://127.0.0.1:8787/v1",
        "apiKey": "local-router"
      }
    }
  }
}
```

### **2. Set as Default Model**
```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "bankr-router/auto",
        "fallbacks": ["bankr-router/eco"]
      }
    }
  }
}
```

**That's it!** Now all AI requests go through Bankr Router, which picks the best Bankr model automatically.

---

## ✅ **Quick Test (Verify It Works)**

```bash
# Check router is running
curl http://127.0.0.1:8787/health

# Dry-run: See what model router would pick
curl http://127.0.0.1:8787/v1/route \
  -H "content-type: application/json" \
  -d '{"model":"bankr-router/auto","messages":[{"role":"user","content":"Write a hello world program"}]}'

# Real test: Get an actual AI response
curl http://127.0.0.1:8787/v1/chat/completions \
  -H "content-type: application/json" \
  -d '{"model":"bankr-router/auto","messages":[{"role":"user","content":"Say hi"}]}'
```

Check for success! You should see:
- `x-router-planned-model` header
- `x-router-final-model` header  
- A working AI response

## Skill

This repo includes a reusable OpenClaw skill for installing and configuring the router:

```
skills/bankr-router/SKILL.md
```

It documents setup steps, config paths to adjust, and common failure modes.

## Troubleshooting matrix

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ENOENT` / “Could not locate OpenClaw config” | config path not found | Set `plugins.entries.bankr-router.config.openclawConfigPath` or `OPENCLAW_CONFIG_PATH`. |
| Plugin not discovered | plugin path not in `plugins.load.paths` / install incomplete | Add `plugins.load.paths` or run `openclaw plugins install <path|.tgz|npm-spec>`. |
| `Unknown model: bankr-router/auto` | provider not registered or allowlist missing | Add `models.providers.bankr-router` and ensure `agents.defaults.models` allowlist includes it (if set). |
| `baseURL` vs `baseUrl` mismatch | old config key | Use `baseUrl` (lowercase `l`) under `models.providers`. |
| Large session timeout | OpenClaw timeout exceeded | Reduce prompt size or increase OpenClaw timeout settings. |
| Router health OK but inference fails | upstream auth or provider catalog mismatch | Check Bankr API key and `bankrProviderId` in the config. |
| Router bypassed | per-agent model override | Remove per-agent overrides in `agents.list[].model` or agent-level config files (location varies by install). |
| Stale dist not rebuilt | plugin JS not rebuilt | Run `npm run build`, then restart gateway (if you control it). |

### Diagnostics pointers

- `/v1/diagnostics` shows the selected OpenClaw config path + attempted paths.
- `/health` shows router reachability only; it does not validate upstream auth or latency.
- If `/health` is green but completions fail, check upstream Bankr credentials and model catalog.

### Safe troubleshooting (no service restarts required)

If you cannot restart services, you can still verify configuration by:

1. Checking `/v1/diagnostics` output for config discovery.
2. Confirming your OpenClaw config has `models.providers.bankr-router.baseUrl`.
3. Using `/v1/route` to see routing decisions without upstream inference.

### Router vs upstream failure signals

- Router failures: `router_error` in the response with details about config discovery or catalog loading.
- Upstream failures: HTTP errors from `https://llm.bankr.bot` or auth failures (usually `401/403`).
- If router `/health` is OK but upstream fails, recheck Bankr API key and provider catalog.
