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

### Load plugin in OpenClaw

Add to your OpenClaw config (path may differ):

```json
{
  "plugins": {
    "entries": {
      "bankr-router": {
        "spec": "/home/tachiboss/tachi/workspace/openclawbankrrouter",
        "config": {
          "host": "127.0.0.1",
          "port": 8787,
          "openclawConfigPath": "/home/tachiboss/.openclaw/openclaw.json",
          "bankrProviderId": "bankr",
          "routerProviderId": "bankr-router"
        }
      }
    }
  },
  "models": {
    "providers": {
      "bankr-router": {
        "baseURL": "http://127.0.0.1:8787/v1",
        "apiKey": "local-router"
      }
    },
    "defaultModel": "bankr-router/auto"
  }
}
```

Restart the gateway:

```bash
openclaw gateway restart
```

Verify:

```bash
curl http://127.0.0.1:8787/health
openclaw models list | grep bankr-router
```

## Skill

This repo includes a reusable OpenClaw skill for installing and configuring the router:

```
skills/bankr-router/SKILL.md
```

It documents setup steps, config paths to adjust, and common failure modes.
If you want to publish to the Bankr community skill repo later, this structure matches their contribution layout.

## Troubleshooting

- **Unknown model: bankr-router/auto** → ensure models.providers has `bankr-router` and defaultModel uses `bankr-router/auto`.
- **Port already in use** → change `port` in plugin config and update `baseURL` accordingly.
- **Gateway restart loop** → verify `openclaw.plugin.json` exists at plugin root and `spec` points to repo root.
- **Router bypassed** → check agent-specific overrides in `models.providers` or `~/.openclaw/agents/<agentId>/agent/models.json`.
