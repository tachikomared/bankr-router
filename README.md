# Bankr Router

**Smart AI Model Router for OpenClaw + Bankr Gateway**

Bankr Router sits in front of Bankr and picks the best model for each request: cheaper for simple chat, stronger for code, sharper for tools/structured output, and heavier for reasoning. It keeps the control local and the behavior visible.

## What it does

- Profile-based routing: `auto`, `eco`, `premium`
- `/v1/route` = dry-run planning, no upstream inference
- `/v1/chat/completions` = real execution through Bankr
- `/v1/diagnostics` for config discovery + catalog errors
- `/health` for quick health checks
- Retry and fallback behavior when upstream models fail
- Follow-up inheritance with `x-session-id`

## Routing behavior

- **auto**: balanced smart routing
- **eco**: cheapest practical routing
- **premium**: highest-quality routing

## Typical model anchors

- auto: `gpt-5.4-mini`
- eco: `deepseek-v3.2`
- premium: `gpt-5.4` / `claude-opus-4.6`
- cheap code specialist: `qwen3-coder`
- cheap long-context specialist: `gemini-3.1-flash-lite`

## Quick start

```bash
git clone https://github.com/tachikomared/bankr-router.git
cd bankr-router
npm install
npm run build
```

Add the plugin to OpenClaw, then set `bankr-router/auto` as the default model if you want routed behavior.

## Smoke test

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/v1/route \
  -H "content-type: application/json" \
  -d '{"model":"bankr-router/auto","messages":[{"role":"user","content":"write a python function"}]}'
```

## Skill docs

See `skills/bankr-router/` for the operational skill and references.
