# Bankr Router (OpenClaw plugin)

Local smart router for Bankr LLM Gateway requests inside OpenClaw. It selects a Bankr model based on the prompt, routing profile, and model catalog, while still sending inference to Bankr.

**Why it’s good**
- Local routing → faster decisions and lower latency than external routing.
- Always stays on Bankr (no model leakage to other providers).
- Routes by content, tools, vision, and max tokens.
- Explicit diagnostics for config discovery and catalog errors.

**Key features**
- Profile-based routing: `auto`, `eco`, `premium`.
- `/v1/route` for safe, no-inference routing decisions.
- `/v1/diagnostics` for config discovery + catalog errors.
- Zero external dependencies beyond OpenClaw + Bankr.

Developed by TachikomaRed together with its creator, smolemaru.

## Quick install (recommended)

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
- OpenClaw >= 0.4.0
- Bankr provider installed in OpenClaw (`bankr llm setup openclaw --install`)
- Bankr API key available via OpenClaw config or `BANKR_LLM_KEY`

## Install (local dev)

```bash
cd /path/to/openclawbankrrouter
npm install
npm run build
```

## Install (OpenClaw plugin)

### Option A: load a local checkout via `plugins.load.paths`

Add the repo path to `plugins.load.paths`, then enable it in `plugins.entries`:

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

### Option B: install via CLI (copies or links the plugin)

```bash
openclaw plugins install /path/to/openclawbankrrouter
# or
openclaw plugins install -l /path/to/openclawbankrrouter
```

Then ensure the plugin entry is enabled in `plugins.entries.bankr-router.enabled` as above.

> **Obsolete docs:** Old examples using `plugins.entries.<id>.spec`, `baseURL`, or `models.defaultModel` are deprecated. Use `plugins.load.paths`, `models.providers.<id>.baseUrl`, and `agents.defaults.model.primary` instead.

## Provider + default model configuration (current schema)

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

> **Note:** This router expects a Bankr provider configured in your OpenClaw config. The router will read its model catalog from `models.providers.bankr` (or the provider ID you set).

## Verify (safe, repo-local)

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/v1/diagnostics
curl http://127.0.0.1:8787/v1/route \
  -H "content-type: application/json" \
  -d '{"model":"bankr-router/auto","messages":[{"role":"user","content":"say ok"}]}'
openclaw plugins list
openclaw models list | grep bankr-router
```

### Smoke test (tiny)

```bash
curl http://127.0.0.1:8787/v1/chat/completions \
  -H "content-type: application/json" \
  -d '{"model":"bankr-router/auto","messages":[{"role":"user","content":"say ok"}]}'
```

> **Note:** Large sessions can still time out even if `/health` is green. Health only checks the router, not upstream inference latency or OpenClaw timeouts.

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
