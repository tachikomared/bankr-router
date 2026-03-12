---
name: bankr-router
description: Install, configure, and verify the local Bankr Router OpenClaw plugin for routing Bankr LLM Gateway traffic (auto/eco/premium). Includes setup, config paths, and troubleshooting for router-specific issues.
---

# Bankr Router (OpenClaw plugin skill)

Local smart router that scores requests and routes them to Bankr LLM Gateway models. Inference still goes through BANKR; the router only selects the model.

Developed by TachikomaRed together with its creator, smolemaru.

## When to use

- You want OpenClaw to route Bankr requests through `bankr-router/auto`, `bankr-router/eco`, or `bankr-router/premium`.
- You need a local routing layer with profile-based selection before sending to Bankr.
- You are installing this repo as a local OpenClaw plugin.

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

## Install the local plugin

Add this plugin entry to your OpenClaw config (path varies by install):

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
  }
}
```

### Add the provider block

```json
{
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

### Restart the gateway

```bash
openclaw gateway restart
```

### Verify

```bash
curl http://127.0.0.1:8787/health
openclaw models list | grep bankr-router
```

## Quick profile switching

```bash
openclaw models set-default bankr-router/auto
openclaw models set-default bankr-router/eco
openclaw models set-default bankr-router/premium
```

## Common adjustments

You may need to change:
- **Repo path** to where this project lives locally.
- **OpenClaw config path** (e.g., `~/.openclaw/openclaw.json`).
- **Router port** if 8787 is in use.
- **Provider IDs** if you customized `bankr` or `bankr-router` in your config.
- **Agent overrides** that bypass the router (see below).

## Troubleshooting

- **Unknown model: bankr-router/auto**
  - Ensure `models.providers.bankr-router` exists and `defaultModel` uses `bankr-router/auto`.

- **Port already in use**
  - Change `plugins.entries.bankr-router.config.port` and update `models.providers.bankr-router.baseURL` to match.

- **Gateway restart loop**
  - Check that `openclaw.plugin.json` exists in the repo root and your `spec` points to that root.

- **Direct agent override bypassing router**
  - Check per-agent overrides: `~/.openclaw/agents/<agentId>/agent/models.json` or `models.providers` in the global config.

## Notes on skills & contribution

- OpenClaw skills are folder-based with a required `SKILL.md` file.
- You can inspect skills with:
  ```bash
  openclaw skills list
  openclaw skills info bankr-router
  openclaw skills check bankr-router
  ```
- Bankr community contributions use:
  ```
  your-provider/
    your-skill/
      SKILL.md
      references/
      scripts/
  ```
  Submit skills via PR to `BankrBot/skills`.

## OpenClaw config paths

Common config locations (may differ):
- `~/.openclaw/openclaw.json`
- `/home/tachiboss/.openclaw/openclaw.json`

If your OpenClaw config or provider IDs are customized, update the JSON blocks above accordingly.
