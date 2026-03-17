---
name: bankr-router
description: Install, configure, and verify the local Bankr Router OpenClaw plugin that routes Bankr LLM requests. Use when updating OpenClaw config (plugins.load.paths + plugins.entries.bankr-router.config), configuring models.providers baseUrl, setting agents.defaults.model.primary/fallbacks, or troubleshooting router setup, ENOENT config errors, and stale builds.
---

# Bankr Router (OpenClaw plugin skill)

Local smart router that scores requests and routes them to Bankr LLM Gateway models. Inference still goes through BANKR; the router only selects the model.

## Prerequisites

- Node.js 20+
- OpenClaw >= 0.4.0
- Bankr provider installed in OpenClaw:
  ```bash
  bankr llm setup openclaw --install
  ```

## Local project location

Default repo path:
```
/home/tachiboss/tachi/workspace/openclawbankrrouter
```
Adjust this path if your repo is elsewhere.

## Install & build

```bash
cd /home/tachiboss/tachi/workspace/openclawbankrrouter
npm install
npm run build
```

## Load the plugin (current OpenClaw schema)

### Option A: load via `plugins.load.paths`

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/home/tachiboss/tachi/workspace/openclawbankrrouter"
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
openclaw plugins install /home/tachiboss/tachi/workspace/openclawbankrrouter
# or link for dev
openclaw plugins install -l /home/tachiboss/tachi/workspace/openclawbankrrouter
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
5. `~/tachi/.openclaw/openclaw.json`
6. `./.openclaw/openclaw.json` up the parent chain

Set an explicit path if you want to override:
```json
{ "plugins": { "entries": { "bankr-router": { "config": { "openclawConfigPath": "/path/to/openclaw.json" }}}}}
```

## Restart & verify

```bash
openclaw gateway restart
curl http://127.0.0.1:8787/health
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
  - Run `npm run build` after changes and restart the gateway.
