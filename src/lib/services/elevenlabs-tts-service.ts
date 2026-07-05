import { env } from "../config/env.js";
import type { ApiEnvelope } from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";
import { getBackendMode } from "../config/runtime-mode.js";

export function isElevenLabsConfigured() {
  return Boolean(env.ELEVENLABS_API_KEY.trim());
}

async function synthesizeVoice(voiceId: string, text: string) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
      "xi-api-key": env.ELEVENLABS_API_KEY.trim()
    },
    body: JSON.stringify({
      text,
      model_id: env.ELEVENLABS_MODEL || env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.warn("[ElevenLabs] TTS failed", { voiceId, status: response.status, detail: detail.slice(0, 200) });
    return undefined;
  }

  const audio = Buffer.from(await response.arrayBuffer()).toString("base64");
  return `data:audio/mpeg;base64,${audio}`;
}

export async function buildElevenLabsAudioUrl(text: string, preferredVoiceId?: string) {
  const apiKey = env.ELEVENLABS_API_KEY.trim();
  if (!apiKey) {
    return undefined;
  }

  const candidates = [
    preferredVoiceId?.trim(),
    env.ELEVENLABS_VOICE_ID.trim(),
    env.ELEVENLABS_DEMO_VOICE_ID.trim()
  ].filter((voiceId, index, values): voiceId is string => Boolean(voiceId) && values.indexOf(voiceId) === index);

  for (const voiceId of candidates) {
    const audioUrl = await synthesizeVoice(voiceId, text);
    if (audioUrl) {
      return audioUrl;
    }
  }

  return undefined;
}

type VoiceTtsData = {
  fallback: boolean;
  audioBase64?: string;
  mimeType?: string;
  message?: string;
};

export async function buildVoiceTtsResponse(
  input: { text?: string }
): Promise<ApiEnvelope<VoiceTtsData>> {
  const text = String(input.text ?? "").trim();
  if (!text) {
    throw new HttpError(400, "Missing text for TTS");
  }

  if (!isElevenLabsConfigured()) {
    return {
      ok: true,
      mode: getBackendMode(),
      generatedAt: new Date().toISOString(),
      data: {
        fallback: true,
        message: "ElevenLabs is not configured"
      }
    };
  }

  const audioUrl = await buildElevenLabsAudioUrl(text);
  if (!audioUrl) {
    return {
      ok: true,
      mode: getBackendMode(),
      generatedAt: new Date().toISOString(),
      data: {
        fallback: true,
        message: "TTS synthesis failed"
      }
    };
  }

  const base64 = audioUrl.includes(",") ? audioUrl.split(",", 2)[1] : undefined;

  return {
    ok: true,
    mode: getBackendMode(),
    generatedAt: new Date().toISOString(),
    data: {
      fallback: false,
      audioBase64: base64,
      mimeType: "audio/mpeg"
    }
  };
}
