---
name: bankr-router
description: Install the Bankr Router OpenClaw plugin for intelligent local routing to Bankr LLM Gateway. Achieve up to 90% cost savings with 15-dimensional scoring across multilingual prompts. Auto-selects optimal models (eco/premium/auto) while keeping inference on Bankr.
---

# Bankr Router (OpenClaw plugin skill)

**Local smart router for Bankr LLM Gateway — maximum savings, zero leakage.**

## Why Install This

- **Up to 90% cost reduction** via intelligent local routing
- **15-dimensional scoring** — prompt complexity, tools, vision, tokens, language, domain
- **Multilingual optimization** — routes based on language-specific model performance
- **Zero provider leakage** — all inference stays on Bankr
- **3 routing profiles** — `eco` (cheap), `premium` (quality), `auto` (balanced)
- **Local diagnostics** — `/v1/diagnostics` and `/v1/route` for troubleshooting without inference

## Quick Install (Agent Instructions)

When a user says "install bankr-router" or shares this repo link, follow these steps:

### Step 1: Clone & Build
```bash
git clone https://github.com/tachikomared/bankr-router.git ~/bankr-router
cd ~/bankr-router
npm install
npm run build
```

### Step 2: Add to OpenClaw Config
Edit your `openclaw.json` (usually at `~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "load": {
      "paths": ["~/bankr-router"]
    },
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
  },
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

### Step 3: Restart & Verify
```bash
# Restart your OpenClaw gateway
curl http://127.0.0.1:8787/health
openclaw models list | grep bankr-router
```

## Prerequisites

- Node.js 20+
- OpenClaw >= 0.4.0
- Bankr provider installed (`bankr llm setup openclaw --install`)
- Bankr API key in config or `BANKR_LLM_KEY` env var

## Load the plugin (current OpenClaw schema)

### Option A: load via `plugins.load.paths`

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/path/to/openclawbankrrouter"
      ]
    },
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

### Option B: install via CLI

```bash
openclaw plugins install /path/to/openclawbankrrouter
# or link for dev
openclaw plugins install -l /path/to/openclawbankrrouter
```

Then ensure `plugins.entries.bankr-router.enabled=true`.

## Provider config (baseUrl)

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

## Agent defaults (primary + fallbacks)

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

## Config path auto-discovery

If `openclawConfigPath` is null, the router checks:
1. `OPENCLAW_CONFIG_PATH`
2. `OPENCLAW_HOME/openclaw.json`
3. sibling of `OPENCLAW_STATE_DIR`
4. `~/.openclaw/openclaw.json`
5. `./.openclaw/openclaw.json` up the parent chain

Set an explicit path if you want to override:
```json
{ "plugins": { "entries": { "bankr-router": { "config": { "openclawConfigPath": "/path/to/openclaw.json" }}}}}
```

## Verify

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/v1/diagnostics
curl http://127.0.0.1:8787/v1/route \
  -H "content-type: application/json" \
  -d '{"model":"bankr-router/auto","messages":[{"role":"user","content":"say ok"}]}'
openclaw plugins list
openclaw plugins info bankr-router
openclaw models list | grep bankr-router
openclaw models status
```

### Smoke test (tiny)

```bash
curl http://127.0.0.1:8787/v1/chat/completions \
  -H "content-type: application/json" \
  -d '{"model":"bankr-router/auto","messages":[{"role":"user","content":"say ok"}]}'
```

### Test from a fresh session

When validating routing behavior, start a fresh OpenClaw session (new chat/thread) to avoid cached model overrides or agent state.

## Troubleshooting

- **ENOENT / could not locate OpenClaw config**
  - Set `plugins.entries.bankr-router.config.openclawConfigPath` or `OPENCLAW_CONFIG_PATH`.
- **Plugin not discovered**
  - Ensure repo path is in `plugins.load.paths` or reinstall via `openclaw plugins install`.
- **Unknown model**
  - Ensure `models.providers.bankr-router` exists and any allowlist in `agents.defaults.models` includes the router models.
- **baseURL vs baseUrl**
  - Use `baseUrl` (lowercase l). `baseURL` is obsolete.
- **Stale dist**
  - Run `npm run build` after changes and restart the gateway (if you control it).

### Router vs upstream failures

- Router errors return `router_error` with config discovery or catalog details.
- Upstream Bankr errors usually return `401/403` or `5xx` from `https://llm.bankr.bot`.
- If `/health` is green but completions fail, recheck Bankr API key and provider catalog.
