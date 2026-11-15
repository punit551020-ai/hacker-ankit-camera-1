import 'dotenv/config';
import { execFileSync } from 'child_process';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ImageReferencePayload {
  data: string;
  mimeType: string;
}

interface NonStreamingInteractionResult {
  id: string;
  output_video?: {
    data?: string;
    mime_type?: string;
    uri?: string;
  } | null;
}

function asInteractionResult(raw: unknown): NonStreamingInteractionResult {
  return raw as NonStreamingInteractionResult;
}

function formatApiError(err: unknown): { status: number; code: string; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      code: 'API_KEY_INVALID',
      message:
        'Gemini API key permission denied or invalid. Please check GEMINI_API_KEY in AI Studio Settings > Secrets (paid tier required for gemini-omni-1.2-flash).',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota') || lower.includes('billing')) {
    return {
      status: 429,
      code: 'PAID_TIER_REQUIRED',
      message:
        'Quota exhausted or paid tier required for gemini-omni-1.2-flash. Select a billing-enabled Gemini API key in AI Studio Settings > Secrets.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      code: 'MODEL_NOT_FOUND',
      message: 'Requested Gemini model was not found or is unavailable for this API key.',
    };
  }
  return {
    status: 500,
    code: 'VIDEO_GENERATION_FAILED',
    message: rawMessage || 'Video generation failed on the server.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, model: 'gemini-omni-1.2-flash' });
  });

  app.get('/api/download-zip', (_req: Request, res: Response) => {
    try {
      const zipOut = '/tmp/hacker-ankit-camera.zip';
      const pyScript = `
import os, zipfile
root = os.getcwd()
out = ${JSON.stringify('/tmp/hacker-ankit-camera.zip')}
skip_dirs = {'node_modules', 'dist', 'dev-dist', '.git', '.aistudio'}
skip_prefixes = ('public/assets/aistudio/',)
skip_files = {'.env', 'bun.lock'}
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        rel_dir = os.path.relpath(dirpath, root).replace('\\\\', '/')
        if rel_dir != '.' and (rel_dir + '/').startswith(skip_prefixes):
            continue
        for fn in filenames:
            if fn in skip_files or fn.endswith('.zip') or fn.endswith('.log'):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace('\\\\', '/')
            if rel.startswith(skip_prefixes):
                continue
            zf.write(full, rel)
`;
      execFileSync('python3', ['-c', pyScript], { cwd: __dirname, timeout: 60000 });
      if (!fs.existsSync(zipOut)) {
        res.status(500).json({ error: 'ZIP generation failed' });
        return;
      }
      res.download(zipOut, 'hacker-ankit-camera.zip');
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to package project ZIP',
      });
    }
  });

  // Image-to-Video & Storyboard Animation via Gemini Interactions API (gemini-omni-1.2-flash)
  app.post('/api/videos/animate', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(400).json({
        code: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is not configured in server secrets. Set a paid Gemini API key in AI Studio Settings > Secrets.',
      });
      return;
    }

    try {
      const {
        imageBase64,
        mimeType = 'image/jpeg',
        referenceImages = [],
        prompt,
        aspectRatio = '16:9',
        durationSeconds = 10,
        resolution = '720p',
      } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        referenceImages?: ImageReferencePayload[];
        prompt?: string;
        aspectRatio?: '16:9' | '9:16';
        durationSeconds?: number;
        resolution?: '360p' | '720p' | '1080p';
      };

      if (!imageBase64 && (!referenceImages || referenceImages.length === 0)) {
        res.status(400).json({
          code: 'MISSING_IMAGE',
          message: 'Please upload at least one photo to animate into video.',
        });
        return;
      }

      const validAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
      const clampedDuration = Math.max(3, Math.min(15, Math.round(Number(durationSeconds) || 10)));
      const validResolution = ['360p', '720p', '1080p'].includes(resolution) ? resolution : '720p';

      const inputParts: Array<{ type: 'image'; mime_type: string; data: string } | { type: 'text'; text: string }> = [];

      if (imageBase64) {
        inputParts.push({
          type: 'image',
          mime_type: mimeType,
          data: imageBase64,
        });
      }

      if (Array.isArray(referenceImages)) {
        for (const ref of referenceImages.slice(0, 5)) {
          if (ref?.data) {
            inputParts.push({
              type: 'image',
              mime_type: ref.mimeType || 'image/jpeg',
              data: ref.data,
            });
          }
        }
      }

      const motionPrompt =
        prompt?.trim() ||
        'Pro-edited cinematic camera dolly-in with crisp optical depth, subtle parallax across the screen and subject, high-contrast studio lighting, natural human-edited pacing.';

      inputParts.push({
        type: 'text',
        text: motionPrompt,
      });

      const interaction = asInteractionResult(
        await ai.interactions.create(
          {
            model: 'gemini-omni-1.2-flash',
            input: inputParts,
            background: false,
            store: true,
            stream: false,
            response_format: {
              type: 'video',
              aspect_ratio: validAspectRatio,
              duration: `${clampedDuration}s`,
              resolution: validResolution,
            },
          } as Parameters<typeof ai.interactions.create>[0],
          { timeout: 300000 }
        )
      );

      const videoPart = interaction.output_video;
      if (!videoPart || !videoPart.data) {
        res.status(502).json({
          code: 'EMPTY_VIDEO_OUTPUT',
          message: 'The model completed without returning video data. Please try a different prompt or photo.',
        });
        return;
      }

      res.json({
        interactionId: interaction.id,
        videoBase64: videoPart.data,
        mimeType: videoPart.mime_type || 'video/mp4',
        aspectRatio: validAspectRatio,
        duration: `${clampedDuration}s`,
        resolution: validResolution,
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json(formatted);
    }
  });

  // Text-to-Video Generation via Gemini Interactions API
  app.post('/api/videos/generate', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(400).json({
        code: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is not configured in server secrets.',
      });
      return;
    }

    try {
      const {
        prompt,
        aspectRatio = '16:9',
        durationSeconds = 15,
        resolution = '720p',
      } = req.body as {
        prompt?: string;
        aspectRatio?: '16:9' | '9:16';
        durationSeconds?: number;
        resolution?: '360p' | '720p' | '1080p';
      };

      if (!prompt?.trim()) {
        res.status(400).json({ code: 'MISSING_PROMPT', message: 'A prompt is required to generate video.' });
        return;
      }

      const validAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
      const clampedDuration = Math.max(3, Math.min(15, Math.round(Number(durationSeconds) || 15)));
      const validResolution = ['360p', '720p', '1080p'].includes(resolution) ? resolution : '720p';

      const interaction = asInteractionResult(
        await ai.interactions.create(
          {
            model: 'gemini-omni-1.2-flash',
            input: prompt.trim(),
            background: false,
            store: true,
            stream: false,
            response_format: {
              type: 'video',
              aspect_ratio: validAspectRatio,
              duration: `${clampedDuration}s`,
              resolution: validResolution,
            },
          } as Parameters<typeof ai.interactions.create>[0],
          { timeout: 300000 }
        )
      );

      const videoPart = interaction.output_video;
      if (!videoPart || !videoPart.data) {
        res.status(502).json({
          code: 'EMPTY_VIDEO_OUTPUT',
          message: 'No video output returned by Gemini Omni Flash.',
        });
        return;
      }

      res.json({
        interactionId: interaction.id,
        videoBase64: videoPart.data,
        mimeType: videoPart.mime_type || 'video/mp4',
        aspectRatio: validAspectRatio,
        duration: `${clampedDuration}s`,
        resolution: validResolution,
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json(formatted);
    }
  });

  // Multi-turn Video Extension via previous_interaction_id
  app.post('/api/videos/extend', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(400).json({
        code: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is not configured in server secrets.',
      });
      return;
    }

    try {
      const { previousInteractionId, prompt, durationSeconds = 5 } = req.body as {
        previousInteractionId?: string;
        prompt?: string;
        durationSeconds?: number;
      };

      if (!previousInteractionId) {
        res.status(400).json({ code: 'MISSING_INTERACTION_ID', message: 'previousInteractionId is required to extend a video.' });
        return;
      }

      const clampedDuration = Math.max(3, Math.min(10, Math.round(Number(durationSeconds) || 5)));

      const interaction = asInteractionResult(
        await ai.interactions.create(
          {
            model: 'gemini-omni-1.2-flash',
            previous_interaction_id: previousInteractionId,
            input: prompt?.trim() || 'Continue the cinematic camera pull-back cleanly across the developer studio.',
            background: false,
            store: true,
            stream: false,
            response_format: {
              type: 'video',
              duration: `${clampedDuration}s`,
            },
          } as Parameters<typeof ai.interactions.create>[0],
          { timeout: 300000 }
        )
      );

      const videoPart = interaction.output_video;
      if (!videoPart || !videoPart.data) {
        res.status(502).json({ code: 'EMPTY_VIDEO_OUTPUT', message: 'Video extension returned no video.' });
        return;
      }

      res.json({
        interactionId: interaction.id,
        videoBase64: videoPart.data,
        mimeType: videoPart.mime_type || 'video/mp4',
        duration: `${clampedDuration}s`,
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json(formatted);
    }
  });

  // Multi-turn Video Edit via previous_interaction_id
  app.post('/api/videos/edit', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(400).json({
        code: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is not configured in server secrets.',
      });
      return;
    }

    try {
      const { previousInteractionId, prompt } = req.body as {
        previousInteractionId?: string;
        prompt?: string;
      };

      if (!previousInteractionId || !prompt?.trim()) {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'Both previousInteractionId and an edit instruction prompt are required.',
        });
        return;
      }

      const interaction = asInteractionResult(
        await ai.interactions.create(
          {
            model: 'gemini-omni-1.2-flash',
            previous_interaction_id: previousInteractionId,
            input: prompt.trim(),
            background: false,
            store: true,
            stream: false,
            response_format: {
              type: 'video',
            },
          } as Parameters<typeof ai.interactions.create>[0],
          { timeout: 300000 }
        )
      );

      const videoPart = interaction.output_video;
      if (!videoPart || !videoPart.data) {
        res.status(502).json({ code: 'EMPTY_VIDEO_OUTPUT', message: 'Video edit returned no video.' });
        return;
      }

      res.json({
        interactionId: interaction.id,
        videoBase64: videoPart.data,
        mimeType: videoPart.mime_type || 'video/mp4',
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json(formatted);
    }
  });

  // Hindi/Hinglish Explainer Voiceover via Gemini Flash Lite TTS
  app.post('/api/voiceover', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(400).json({
        code: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is not configured in server secrets.',
      });
      return;
    }

    try {
      const { scriptText, voiceName = 'Kore', style } = req.body as {
        scriptText?: string;
        voiceName?: string;
        style?: string;
      };

      if (!scriptText?.trim()) {
        res.status(400).json({
          code: 'MISSING_SCRIPT',
          message: 'Voiceover scriptText is required.',
        });
        return;
      }

      const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
      const chosenVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';

      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: scriptText.trim(),
                speechMetadata: {
                  style:
                    style?.trim() ||
                    'Warm, sweet, crystal-clear young Indian female tech creator speaking friendly Hindi and Hinglish at a relaxed, comfortable, unhurried pace for YouTube and Instagram followers',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });

      const base64Audio =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({
          code: 'EMPTY_VOICE_OUTPUT',
          message: 'TTS model returned no audio output.',
        });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json(formatted);
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hacker Ankit Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
