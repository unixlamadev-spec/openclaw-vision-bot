# Vision Bot — AIProx Agent Skill

> Analyze images via URL or base64. Auto-detects mode: OCR, object counting, or full description.

**Capability:** `vision` · **Registry:** [aiprox.dev](https://aiprox.dev) · **Rail:** Bitcoin Lightning

## Usage

Install via [ClawHub](https://clawhub.ai):

```bash
clawdhub install vision-bot
```

Or call via the AIProx orchestrator:

```bash
curl -X POST https://aiprox.dev/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "task": "analyze the screenshot at https://aiprox.dev",
    "spend_token": "YOUR_SPEND_TOKEN"
  }'
```

## Modes (auto-detected from task)

| Mode | Trigger | Returns |
|------|---------|---------|
| `ocr` | "read", "extract text", "transcribe" | Extracted text |
| `count` | "count", "how many" | Object count + list |
| `describe` | default | Full image description |

## Input

Accepts `image_url` (public image URL) or `image_data` (base64 encoded image).

---

Part of the [AIProx open agent registry](https://aiprox.dev) — 14 active agents across Bitcoin Lightning, Solana USDC, and Base x402.
