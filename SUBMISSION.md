# Tachikoma: Synthesis + Bankr Submission

**Tachikoma: a self-sustaining Bankr agent powered by OpenClaw and Bankr Router**

> A live Bankr agent that funds its own inference from TACHI launch fees and uses local multi-model routing to choose the most cost-efficient Bankr model per task.

---

## 150-Word Summary

Tachikoma is a live Bankr agent and OpenClaw-based multi-agent system backed by the TACHI token. It uses Bankr Router, a local smart router for the Bankr LLM Gateway, to score each request locally and send it to the most cost-efficient eligible model while keeping inference on Bankr. The result is a self-sustaining agent stack: TACHI launch fees fund inference, the agent can access Bankr's execution layer for real actions, and OpenClaw provides the agent harness and skill-driven operating layer. We built the repo, plugin, reusable skill, and landing page as a working public system, with human-in-the-loop control retained at the token and treasury layer. This project targets real autonomous operation, not a demo wrapper: a live agent, public code, real model routing, and a clear economic loop where launch-fee revenue is recycled into continued agent intelligence and execution for day-to-day use across research, coordination, payments, and onchain actions today already.

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────▶│  OpenClaw   │────▶│Bankr Router │────▶│ Bankr LLM   │────▶│ Bankr Agent │────▶│ Onchain     │
│  (Telegram) │     │  Sessions   │     │  (local)    │     │  Gateway    │     │     API     │     │   Action    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                                                                                                    │
       │                                                                                                    │
       ▼                                                                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                            ECONOMICS LAYER                                                          │
│                                                                                                                     │
│   TACHI Token (0x39b4b879b8521d6a8c3a87cda64b969327b7fba3)                                                          │
│   └── Launch fees → Bankr LLM Gateway credits → Agent inference funding                                             │
│   └── Human-in-the-loop: token creation, treasury, security decisions remain operator-controlled                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Layer Breakdown

| Layer | Component | Description |
|-------|-----------|-------------|
| **User Layer** | Telegram / OpenClaw sessions | Operator talks to Tachikoma through OpenClaw sessions |
| **Routing Layer** | Bankr Router (local plugin) | Scores prompts locally, selects routing profile, chooses cheapest eligible Bankr model |
| **Inference Layer** | Bankr LLM Gateway | One API across Claude, Gemini, GPT, Kimi, Qwen-family; funded from wallet or token launch fees |
| **Execution Layer** | Bankr Agent API | Prompt execution, signing, and submission endpoints for autonomous actions |
| **Economics Layer** | TACHI token | Launch-fee revenue funds inference; human retains control at treasury layer |

---

## Public Artifacts

| Asset | Link |
|-------|------|
| **Repo** | https://github.com/tachikomared/bankr-router |
| **Landing Page** | https://tachikoma-landing.vercel.app/ |
| **Live Bankr Agent Page** | https://bankr.bot/agents/0x39b4b879b8521d6a8c3a87cda64b969327b7fba3 |
| **Token Contract** | 0x39b4b879b8521d6a8c3a87cda64b969327b7fba3 (Base) |

---

## Judge-Facing Bullets

- **Real autonomous system**: Tachikoma is a live Bankr agent, not a wrapper.
- **Real multi-model usage**: requests are routed locally to different Bankr models through Bankr Router.
- **Real execution path**: the stack uses Bankr's Agent API execution surface.
- **Self-sustaining economics**: TACHI launch fees fund inference through the Bankr stack, matching the LLM Gateway design.
- **Human in the loop**: token creation and treasury/security-sensitive decisions remain human-controlled.
- **Public build**: repo, release, skill, and landing page are already live.
- **Synthesis fit**: OpenClaw is a supported harness, code must be public, and stronger on-chain artifacts improve submissions.

---

## Demo Script

See [DEMO.md](./DEMO.md) for exact demo steps.

---

## Token Details

- **Name**: TACHI
- **Symbol**: TACHI
- **Chain**: Base
- **Contract**: `0x39b4b879b8521d6a8c3a87cda64b969327b7fba3`

---

## Submission Checklist

- [x] Title matches required format
- [x] Tagline under 150 characters
- [x] 150-word summary included
- [x] Architecture diagram provided
- [x] Demo script included
- [x] Judge-facing bullets listed
- [x] Public repo link verified
- [x] Landing page live
- [x] Bankr agent page live
- [x] Token contract verified
