import { env } from "../config/env.js";
import { getBackendMode } from "../config/runtime-mode.js";
import type { ApiEnvelope } from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";
import { buildVoiceCallScriptResponse } from "./escalation-service.js";

export type VoiceTtsResult = {
  fallback: boolean;
  audioBase64?: string;
  mimeType?: string;
  message?: string;
};

export function isElevenLabsConfigured(): boolean {
  return Boolean(env.ELEVENLABS_API_KEY.trim() && env.ELEVENLABS_VOICE_ID.trim());
}

async function synthesizeWithElevenLabs(text: string): Promise<ArrayBuffer> {
  const voiceId = env.ELEVENLABS_VOICE_ID.trim();
  const apiKey = env.ELEVENLABS_API_KEY.trim();
  const modelId = env.ELEVENLABS_MODEL_ID.trim() || "eleven_flash_v2_5";

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    logger.error("elevenlabs.tts_failed", {
      status: response.status,
      detail: detail.slice(0, 200),
    });

    if (response.status === 401 || response.status === 402) {
      let message = "ElevenLabs unavailable for this voice or plan";
      try {
        const parsed = JSON.parse(detail) as {
          detail?: { message?: string };
        };
        if (parsed.detail?.message) {
          message = parsed.detail.message;
        }
      } catch {
        // keep default message
      }
      throw new HttpError(402, message);
    }

    throw new HttpError(502, `ElevenLabs TTS failed (${response.status})`);
  }

  return response.arrayBuffer();
}

async function resolveSpeechText(body: {
  text?: string;
  invoiceId?: string;
}): Promise<string> {
  if (typeof body.text === "string" && body.text.trim()) {
    return body.text.trim();
  }

  if (typeof body.invoiceId === "string" && body.invoiceId.trim()) {
    const scriptResponse = await buildVoiceCallScriptResponse({
      invoiceId: body.invoiceId.trim(),
    });
    return scriptResponse.data.speechText;
  }

  throw new HttpError(400, "Provide text or invoiceId for voice TTS");
}

export async function buildVoiceTtsResponse(body: {
  text?: string;
  invoiceId?: string;
}): Promise<ApiEnvelope<VoiceTtsResult>> {
  const speechText = await resolveSpeechText(body);

  if (!isElevenLabsConfigured()) {
    return {
      ok: true,
      mode: getBackendMode(),
      generatedAt: new Date().toISOString(),
      data: {
        fallback: true,
        message:
          "ElevenLabs not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env",
      },
    };
  }

  try {
    const audioBuffer = await synthesizeWithElevenLabs(speechText);
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    logger.info("elevenlabs.tts_success", {
      characters: speechText.length,
      bytes: audioBuffer.byteLength,
    });

    return {
      ok: true,
      mode: getBackendMode(),
      generatedAt: new Date().toISOString(),
      data: {
        fallback: false,
        audioBase64,
        mimeType: "audio/mpeg",
      },
    };
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.statusCode === 401 || error.statusCode === 402)
    ) {
      return {
        ok: true,
        mode: getBackendMode(),
        generatedAt: new Date().toISOString(),
        data: {
          fallback: true,
          message: error.message,
        },
      };
    }
    throw error;
  }
}
