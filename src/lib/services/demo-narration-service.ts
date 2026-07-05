import { env } from "../config/env.js";
import type {
  ApiEnvelope,
  DemoNarrationRequest,
  DemoNarrationResponse,
} from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";
import { buildElevenLabsAudioUrl } from "./elevenlabs-tts-service.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";

export async function buildDemoNarrationResponse(
  input: DemoNarrationRequest
): Promise<ApiEnvelope<DemoNarrationResponse>> {
  const snapshot = await getPhaseOneSnapshotData();
  const text = String(input.text ?? "").trim();

  if (!text) {
    throw new HttpError(400, "Missing demo narration text");
  }

  const preferredVoiceId =
    env.ELEVENLABS_VOICE_ID.trim() || env.ELEVENLABS_DEMO_VOICE_ID.trim() || undefined;
  const audioUrl = await buildElevenLabsAudioUrl(text, preferredVoiceId);

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: audioUrl ? { text, audioUrl, audioProvider: "elevenlabs" } : { text }
  };
}
