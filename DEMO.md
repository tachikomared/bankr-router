# Tachikoma Demo Script

Exact steps to demonstrate Tachikoma for Synthesis + Bankr judges.

---

## 1. Show Landing Page

Open browser and navigate to:
```
https://tachikoma-landing.vercel.app/
```

Screenshot or screen-share the landing page showing:
- Tachikoma branding
- TACHI token address: `0x39b4b879b8521d6a8c3a87cda64b969327b7fba3`
- Links to repo and Bankr agent page
- Multi-agent swarm system description

---

## 2. Show Repo and v0.4.0 Release

Open browser and navigate to:
```
https://github.com/tachikomared/bankr-router
```

Navigate to **Releases** and highlight:
- Release **v0.4.0** (or latest)
- Release notes describing the routing functionality
- Attached build artifacts

---

## 3. Verify Router Provider in OpenClaw

Run in terminal:
```bash
openclaw models list | grep bankr-router
```

**Expected output:**
```
bankr-router/auto
bankr-router/eco
bankr-router/premium
```

---

## 4. Check Router Health Endpoint

Run in terminal:
```bash
curl http://127.0.0.1:8787/health
```

**Expected output:**
```json
{"status":"ok"}
```

---

## 5. Test Routing with Different Prompts

### Example A: Simple query (routes to eco/cheaper model)
```bash
curl -X POST http://127.0.0.1:8787/v1/route \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is 2+2?",
    "profile": "auto"
  }'
```

### Example B: Complex reasoning (routes to premium model)
```bash
curl -X POST http://127.0.0.1:8787/v1/route \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze the risks of this smart contract and suggest improvements...",
    "profile": "auto"
  }'
```

**What to show:** Different model selections based on prompt complexity.

---

## 6. Show Real Agent Execution Path

Use Bankr CLI to show the agent capabilities:

```bash
# Check balance (real onchain state)
bankr balances

# Show a real agent prompt execution
bankr prompt "What is my ETH balance on Base?"
```

**What to show:** The response coming back through Bankr's Agent API with real wallet data.

---

## 7. Show Economics Line

Display the TACHI token page showing:
```
https://bankr.bot/agents/0x39b4b879b8521d6a8c3a87cda64b969327b7fba3
```

Explain:
> "TACHI was launched through Bankr. Launch fees accumulate as credits in the Bankr LLM Gateway. These credits fund inference for Tachikoma's continued operation — a self-sustaining economic loop."

Show the credit balance:
```bash
bankr llm credits
```

---

## Quick Command Summary

```bash
# 3. List router models
openclaw models list | grep bankr-router

# 4. Health check
curl http://127.0.0.1:8787/health

# 5a. Route simple prompt
curl -X POST http://127.0.0.1:8787/v1/route \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?", "profile": "auto"}'

# 5b. Route complex prompt
curl -X POST http://127.0.0.1:8787/v1/route \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Analyze smart contract risks...", "profile": "auto"}'

# 6. Real execution
bankr balances
bankr prompt "What is my ETH balance?"

# 7. Economics
bankr llm credits
```

---

## Visual Demo Flow

1. **Landing page** → establishes the project
2. **GitHub repo** → proves code is public
3. **Releases** → proves working build
4. **Model list** → shows router is installed
5. **Health check** → shows router is running
6. **Route examples** → shows intelligent routing
7. **Bankr balances** → shows real execution path
8. **LLM credits** → shows self-sustaining economics
