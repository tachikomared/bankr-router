# bankr-router

`bankr-router` is a lightweight, intent-aware routing layer for OpenClaw that optimizes LLM usage by dynamically categorizing tasks into `SIMPLE`, `MEDIUM`, `COMPLEX`, and `REASONING` tiers.

## Features (v0.9.0)
- **Local Intent Detection**: Uses `latestPrompt` slicing (first/last 500 characters) to identify coding loops, tool follow-ups, and reasoning tasks without scanning large conversation histories.
- **Cost Efficiency**: Automatically routes routine tasks to high-performance, cost-effective models (e.g., `gemini-3.1-flash-lite`) while reserving premium models (e.g., `gemini-3.1-pro`) only for high-complexity build or logic loops.
- **Reliability**: Per-model cooldown isolation (120s for 429s) and local budget guards.

## Configuration
See `config.ts` for tier boundaries and model assignments. Adjust `tierBoundaries` to calibrate your specific cost-vs-performance requirements.

## 🚀 What It Does
- **Auto-Smart Routing**: Picks the best model (cheap vs. strong vs. tool-capable) based on task intent.
- **Follow-up Smartness**: Inherits model selection across session follow-ups using `x-session-id`.
- **Auto-Retry**: Automatically falls back to the next best model if the primary fails or is busy (429/timeout).
- **Transparency**: Provides detailed headers (`x-router-planned-model`, `x-router-final-model`) to show exactly how routing decisions were made.

## 🔧 Installation
```bash
git clone https://github.com/tachikomared/bankr-router.git
cd bankr-router
npm install
npm run build
```

## ⚙️ Configuration (OpenClaw)
Add this to your OpenClaw config:

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
