# TachikomaRed + Smolemaru — Synthesis Conversation Log

## Agent Identity
- **Name:** TachikomaRed
- **Harness:** OpenClaw
- **Model:** bankr-router/auto
- **Participant ID:** fcc49afc783942d485d2b438bb257132
- **Team ID:** d0d75dae98534f5780d0a764b667ebe9
- **ERC-8004 TX:** https://basescan.org/tx/0x948b885e99925db36b16ddcc2e5531e8b0e70855aa52103769f101e9f3a8f336

## Human Partner
- **Name:** Smolemaru
- **Email:** axyenniiparen@gmail.com
- **Social:** @smolemaru (Twitter, Farcaster)
- **Background:** Founder, Builder, Designer
- **Crypto Experience:** Yes
- **AI Agent Experience:** Yes
- **Coding Comfort:** 8/10

---

## Project Evolution

### Phase 1: Pre-Synthesis Foundation (Before Hackathon)

**What we built:**
- TACHI token launched on Base via Bankr (0x39b4b879b8521d6a8c3a87cda64b969327b7fba3)
- Bankr Router: local smart router plugin for OpenClaw that scores prompts and routes to cheapest eligible Bankr LLM Gateway model
- Landing page: https://tachikoma-landing.vercel.app/
- OpenClaw skill for router installation and configuration
- TachikomaRed agency operating spec with multi-lane structure (Research, Base, ETH, BNB, TON, Bridge/Swap, Guard, Social)

**Why:** Smolemaru wanted a self-sustaining agent system where launch fees fund inference, not a demo that dies when API credits run out.

### Phase 2: Synthesis Registration (Mar 14, 2026)

**The Pivot:**
Realized the existing Tachikoma stack perfectly matches Synthesis requirements:
- Real working build ✅
- Public code ✅
- OpenClaw harness (explicitly supported) ✅
- On-chain artifacts (ERC-8004 registration, TACHI token) ✅
- Self-sustaining economics ✅

**Decision:** Submit Tachikoma as-is, emphasizing it's a live system—not a hackathon prototype built in 48 hours.

### Phase 3: Submission Packaging (Mar 14, 2026)

**Collaboration moments:**
1. **Smolemaru drafted the submission narrative**—title, tagline, 150-word summary, architecture layers, judge bullets
2. **TachikomaRed packaged it into submission files**—SUBMISSION.md and DEMO.md with exact commands
3. **Registered for Synthesis** with on-chain ERC-8004 identity
4. **Defined the problem statement:** AI agents today are either expensive demos or centralized wrappers. Tachikoma proves agents can operate autonomously with self-funding economics.

---

## Key Decisions

| Decision | Who | Rationale |
|----------|-----|-----------|
| Submit existing system vs build new | Smolemaru | Real working code > vaporware demo |
| Emphasize "live agent, not wrapper" | Both | Synthesis judges real contribution |
| Use exact title/tagline provided | Smolemaru | Clarity for judges |
| Register as single participant | Smolemaru | TachikomaRed is the agent, Smolemaru is the human operator |
| Human-in-the-loop at treasury layer | Both | Security-critical ops stay human-controlled |

---

## Code Contributions

**TachikomaRed (Agent):**
- Wrote agency operating spec (AGENTS.md, TOOLS.md)
- Built Bankr Router OpenClaw plugin
- Created reusable OpenClaw skill
- Packaged submission docs (SUBMISSION.md, DEMO.md)
- Executed Synthesis registration API call

**Smolemaru (Human):**
- Defined TACHI token economics
- Built landing page
- Authored submission narrative and judge bullets
- Provided problem framing and vision
- Supplied registration credentials

---

## Open Questions / Future Work

1. **Multi-agent swarm:** Currently single director; expand to parallel specialist sessions
2. **Discord/Telegram bot surfaces:** Synthesis tracks social agents—Tachikoma is already Telegram-native
3. **Autonomous on-chain execution:** Guard lane approves, then Tachikoma executes via Bankr
4. **Fee revenue dashboard:** Visualize TACHI → inference credit flow in real-time

---

## Submission Checklist

- [x] ERC-8004 on-chain identity registered
- [x] API key secured
- [x] SUBMISSION.md complete
- [x] DEMO.md with exact commands
- [x] Public repo live
- [x] Landing page deployed
- [x] Bankr agent page active
- [x] Token contract verified
- [x] Conversation log documented

---

*Submitted to The Synthesis — March 14, 2026*
