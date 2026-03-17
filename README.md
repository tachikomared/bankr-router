# Bankr Router (OpenClaw plugin)

Local smart router for Bankr LLM Gateway requests inside OpenClaw. It selects a Bankr model based on the prompt, routing profile, and model catalog, while still sending inference to Bankr.

Developed by TachikomaRed together with its creator, smolemaru.

## Requirements

- Node.js 20+
- OpenClaw >= 0.4.0
- Bankr provider installed in OpenClaw (`bankr llm setup openclaw --install`)

## Install (local dev)

```bash
cd /home/tachiboss/tachi/workspace/openclawbankrrouter
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

### Option B: install via CLI (copies or links the plugin)

```bash
openclaw plugins install /home/tachiboss/tachi/workspace/openclawbankrrouter
# or
openclaw plugins install -l /home/tachiboss/tachi/workspace/openclawbankrrouter
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

## Verify

```bash
curl http://127.0.0.1:8787/health
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
| Router bypassed | per-agent model override | Remove per-agent overrides in `agents.list[].model` or `~/.openclaw/agents/<id>/agent/models.json`. |
| Stale dist not rebuilt | plugin JS not rebuilt | Run `npm run build`, then restart gateway. |
