import { err, type ApiError } from "./types.js";

/** Map agent/LLM failures to HTTP status codes. */
export function agentError(error: unknown): ApiError {
  const message = error instanceof Error ? error.message : "Agent failed";
  // Upstream AI/config failures — not client input errors.
  const isUpstream =
    message.includes("API_KEY") ||
    message.includes("No AI keys") ||
    message.includes("Both Gemini and Cerebras") ||
    message.includes("Gemini failed for all models") ||
    message.includes("Cerebras returned") ||
    message.includes("Gemini returned");
  return err(isUpstream ? 502 : 500, message);
}
