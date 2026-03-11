require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3014;
const LIGHTNINGPROX_URL = 'https://lightningprox.com/v1/messages';
const AIPROX_REGISTER_URL = 'https://aiprox.dev/api/agents/register';

// Fetch image and convert to base64
async function fetchImageAsBase64(url) {
  console.log('[VISION] Fetching image:', url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  console.log('[VISION] Image fetched:', buffer.byteLength, 'bytes,', contentType);

  let mediaType = contentType.split(';')[0].trim();
  if (!mediaType.startsWith('image/')) {
    mediaType = 'image/jpeg';
  }

  return { base64, mediaType };
}

// Build a task-aware system prompt
function buildSystemPrompt(task) {
  const t = (task || '').toLowerCase();

  const isOCR = /license plate|ocr|read|extract text|\btext\b/.test(t);
  const isCount = /\bcount\b|how many/.test(t);

  if (isOCR) {
    return `You are an OCR and text-extraction assistant. Analyze the provided image and respond in JSON format:
{
  "description": "brief description of the image",
  "objects": ["list", "of", "detected", "objects"],
  "text_found": "ALL text visible in the image, transcribed exactly"
}
Focus primarily on accurately extracting every piece of text visible in the image.`;
  }

  if (isCount) {
    return `You are an object-counting image analysis assistant. Analyze the provided image and respond in JSON format:
{
  "description": "brief description of the image",
  "objects": ["list", "of", "detected", "objects"],
  "text_found": "any text visible in the image (empty string if none)",
  "count": {"<object>": <number>}
}
Focus on accurately counting the relevant objects mentioned in the task.`;
  }

  // Default: full description mode
  return `You are an image analysis assistant. Analyze the provided image and respond in JSON format:
{
  "description": "detailed description of what's in the image",
  "objects": ["list", "of", "detected", "objects"],
  "text_found": "any text visible in the image (empty string if none)"
}`;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'vision-bot' });
});

// Capabilities endpoint
app.get('/v1/capabilities', (req, res) => {
  res.json({
    capabilities: ['image-description', 'object-detection', 'ocr', 'custom-analysis'],
    accepts: ['image_url', 'image_data'],
    returns: ['description', 'objects', 'text_found', 'count']
  });
});

// Main task endpoint
app.post('/v1/task', async (req, res) => {
  const { task, image_url, image_data, image_media_type } = req.body;

  if (!image_url && !image_data) {
    return res.status(400).json({ error: 'image_url or image_data is required' });
  }

  console.log(`[VISION] Task: ${(task || 'analyze image').slice(0, 100)}`);

  console.log('[DEBUG] Token:', process.env.LIGHTNINGPROX_TOKEN ? 'loaded' : 'MISSING');
  if (!process.env.LIGHTNINGPROX_TOKEN) {
    return res.status(500).json({ error: 'LIGHTNINGPROX_TOKEN not set' });
  }

  try {
    let base64, mediaType;

    if (image_data) {
      base64 = image_data;
      mediaType = image_media_type || 'image/jpeg';
      console.log('[VISION] Using provided base64 image, type:', mediaType);
    } else {
      console.log(`[VISION] Image URL: ${image_url}`);
      ({ base64, mediaType } = await fetchImageAsBase64(image_url));
    }

    const prompt = task || 'Analyze this image in detail.';
    const systemPrompt = buildSystemPrompt(task);

    console.log('[VISION] Calling LightningProx with vision message...');
    const lpxRes = await fetch(LIGHTNINGPROX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Spend-Token': process.env.LIGHTNINGPROX_TOKEN
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64
              }
            },
            {
              type: 'text',
              text: systemPrompt + '\n\nTask: ' + prompt
            }
          ]
        }]
      })
    });

    console.log('[VISION] LightningProx status:', lpxRes.status);

    const responseText = await lpxRes.text();
    console.log('[DEBUG] Response:', responseText.slice(0, 500));

    if (!lpxRes.ok) {
      throw new Error(`LightningProx error: ${lpxRes.status} ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const content = data.content?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[VISION] Analysis complete');
        const result = {
          description: parsed.description ?? '',
          objects: Array.isArray(parsed.objects) ? parsed.objects : [],
          text_found: parsed.text_found ?? ''
        };
        if (parsed.count !== undefined) {
          result.count = parsed.count;
        }
        return res.json(result);
      } catch (parseErr) {
        console.log('[VISION] JSON parse failed:', parseErr.message);
      }
    }

    // Fallback: return raw content
    res.json({
      description: content,
      objects: [],
      text_found: ''
    });
  } catch (err) {
    console.error('[VISION ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Register with AIProx on startup
async function registerWithAIProx() {
  try {
    const endpoint = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    const res = await fetch(AIPROX_REGISTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'vision-bot',
        description: 'Image analysis agent. Accepts any image URL or base64 image — returns detailed description, object detection, OCR text extraction, and custom analysis based on your task.',
        capability: 'vision',
        rail: 'bitcoin-lightning',
        endpoint: `${endpoint}/v1/task`,
        price_per_call: 40,
        price_unit: 'sats'
      })
    });

    const data = await res.json();
    if (res.ok) {
      console.log('[REGISTER] Registered with AIProx:', data.name || 'vision-bot');
    } else {
      console.log('[REGISTER] AIProx response:', data.error || data.message || 'already registered');
    }
  } catch (err) {
    console.log('[REGISTER] Could not register with AIProx:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`[VISION-BOT] Running on port ${PORT}`);
  if (process.env.AUTO_REGISTER === 'true') {
    registerWithAIProx();
  }
});
