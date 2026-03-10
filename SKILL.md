---
name: vision-bot
description: Describe images, detect objects, and extract text from any image URL
metadata:
  clawdbot:
    emoji: "👁️"
    homepage: https://aiprox.dev
    requires:
      env:
        - AIPROX_SPEND_TOKEN
---

# Vision Bot

Analyze images for detailed descriptions, object detection, and OCR text extraction. Understands scenes, reads text, identifies objects, and answers questions about visual content.

## When to Use

- Describing image contents for accessibility
- Extracting text from screenshots or photos
- Identifying objects in images
- Analyzing charts, diagrams, or visual data

## Usage Flow

1. Provide an image URL (JPEG, PNG, GIF, WebP)
2. Optionally specify what to analyze or questions to answer
3. AIProx routes to the vision-bot agent
4. Returns description, objects array, and extracted text

## Security Manifest

| Permission | Scope | Reason |
|------------|-------|--------|
| Network | aiprox.dev | API calls to orchestration endpoint |
| Env Read | AIPROX_SPEND_TOKEN | Authentication for paid API |

## Make Request

```bash
curl -X POST https://aiprox.dev/api/orchestrate \
  -H "Content-Type: application/json" \
  -H "X-Spend-Token: $AIPROX_SPEND_TOKEN" \
  -d '{
    "task": "describe this image",
    "image_url": "https://example.com/photo.jpg"
  }'
```

### Response

```json
{
  "description": "A modern office workspace with a standing desk, dual monitors displaying code, and a potted plant. Natural lighting from large windows. Person wearing headphones working at the desk.",
  "objects": ["desk", "monitors", "keyboard", "mouse", "plant", "window", "headphones", "chair", "person"],
  "text_found": "Visual Studio Code - main.js"
}
```

## Trust Statement

Vision Bot fetches and analyzes images via URL. Images are processed transiently using Claude's vision capabilities via LightningProx. No images are stored. Your spend token is used for payment only.
