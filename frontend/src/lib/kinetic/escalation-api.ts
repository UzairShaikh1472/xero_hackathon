import type {
  EscalationActionResult,
  VoiceCallScript,
  VoiceTtsResult,
} from "./escalation-types";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:3001";

type ApiEnvelope<T> = {
  ok: boolean;
  mode: "live" | "fallback";
  generatedAt: string;
  data: T;
};

async function postEnvelope<T>(path: string, body: unknown): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await res.json()) as ApiEnvelope<T> & {
    data?: { message?: string };
  };

  if (!res.ok || !payload.ok) {
    throw new Error(payload.data?.message ?? `Request failed: ${path}`);
  }

  return payload;
}

export async function executeEscalationAction(
  invoiceId: string,
): Promise<EscalationActionResult> {
  const envelope = await postEnvelope<EscalationActionResult>(
    "/api/escalation-action",
    { invoiceId },
  );
  return envelope.data;
}

export async function fetchVoiceCallScript(
  invoiceId: string,
): Promise<VoiceCallScript> {
  const envelope = await postEnvelope<VoiceCallScript>(
    "/api/voice-call-script",
    { invoiceId },
  );
  return envelope.data;
}

export async function fetchVoiceTts(input: {
  text?: string;
  invoiceId?: string;
}): Promise<VoiceTtsResult> {
  const envelope = await postEnvelope<VoiceTtsResult>("/api/voice-tts", input);
  return envelope.data;
}
