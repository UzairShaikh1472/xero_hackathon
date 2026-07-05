import { env } from "../config/env.js";

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
      model_id: env.ELEVENLABS_MODEL || "eleven_flash_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
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
    env.ELEVENLABS_DEMO_VOICE_ID.trim(),
    env.ELEVENLABS_VOICE_ID.trim()
  ].filter((voiceId, index, values): voiceId is string => Boolean(voiceId) && values.indexOf(voiceId) === index);

  for (const voiceId of candidates) {
    const audioUrl = await synthesizeVoice(voiceId, text);
    if (audioUrl) {
      return audioUrl;
    }
  }

  return undefined;
}
