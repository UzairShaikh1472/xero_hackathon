import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
} from "@google/generative-ai";
import OpenAI from "openai";

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
/** Tried in order when the primary Gemini model is overloaded (503) or unavailable. */
const GEMINI_FALLBACK_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
];
/** Account-available high-performance model (Llama IDs are not on all keys). */
const DEFAULT_CEREBRAS_MODEL = "gpt-oss-120b";
/** OpenAI-compatible Cerebras endpoint (swap for https://api.sambanova.ai/v1 if needed). */
const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
/** Extra attempts after the first failure (per model). */
const MAX_RETRIES_429 = 4;
const MAX_RETRIES_503 = 1;

const ENV_KEYS = [
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "AI_API_KEY",
  "AI_MODEL",
] as const;

let geminiClient: GoogleGenerativeAI | null = null;
let cerebrasClient: OpenAI | null = null;
let envLoaded = false;
let cachedGeminiKey: string | null = null;
let cachedCerebrasKey: string | null = null;

/**
 * Load `.env` and force known AI keys from the file so a stale shell export
 * never wins over the project key (Node's loadEnvFile does not override).
 */
function loadDotEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // optional .env
    }
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    if (!(ENV_KEYS as readonly string[]).includes(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function readEnvKey(name: (typeof ENV_KEYS)[number]): string | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function statusOf(error: unknown): number | undefined {
  if (error instanceof GoogleGenerativeAIFetchError) return error.status;
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function isTransient(status: number | undefined): boolean {
  return status === 429 || status === 503;
}

function geminiModelCandidates(primary: string): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const m of [primary, ...GEMINI_FALLBACK_MODELS]) {
    if (seen.has(m)) continue;
    seen.add(m);
    list.push(m);
  }
  return list;
}

/** Official Gemini client (primary). */
export function getGeminiClient(): GoogleGenerativeAI {
  loadDotEnv();
  const apiKey = readEnvKey("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy .env.example to .env and add your key from https://aistudio.google.com/apikey",
    );
  }
  if (!geminiClient || cachedGeminiKey !== apiKey) {
    cachedGeminiKey = apiKey;
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

/**
 * OpenAI-compatible client pointed at Cerebras (fallback).
 * Change CEREBRAS_BASE_URL to https://api.sambanova.ai/v1 for SambaNova.
 */
export function getOpenAIClient(): OpenAI {
  loadDotEnv();
  const apiKey = readEnvKey("AI_API_KEY");
  if (!apiKey) {
    throw new Error(
      "AI_API_KEY is not set. Add your Cerebras key to .env (https://cloud.cerebras.ai/)",
    );
  }
  if (!cerebrasClient || cachedCerebrasKey !== apiKey) {
    cachedCerebrasKey = apiKey;
    cerebrasClient = new OpenAI({
      apiKey,
      baseURL: CEREBRAS_BASE_URL,
    });
  }
  return cerebrasClient;
}

/** @deprecated Use getGeminiClient */
export const getGroqClient = getGeminiClient;

export function getModel(): string {
  loadDotEnv();
  return readEnvKey("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
}

function getCerebrasModel(): string {
  loadDotEnv();
  return readEnvKey("AI_MODEL") || DEFAULT_CEREBRAS_MODEL;
}

async function getGeminiAgentResponse(
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const models = geminiModelCandidates(getModel());
  let lastError: unknown;

  for (const modelName of models) {
    const maxRetriesFor = (status: number | undefined) =>
      status === 503 ? MAX_RETRIES_503 : MAX_RETRIES_429;

    for (let attempt = 0; ; attempt++) {
      try {
        const model = getGeminiClient().getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });

        const result = await model.generateContent(userPrompt);
        const content = result.response.text();
        if (!content?.trim()) {
          throw new Error("Gemini returned an empty response");
        }
        return JSON.parse(content) as Record<string, unknown>;
      } catch (error) {
        lastError = error;
        const status = statusOf(error);
        const message =
          error instanceof Error ? error.message : String(error);
        const maxRetries = maxRetriesFor(status);

        // Auth / hard quota: stop Gemini and let Cerebras try.
        if (status === 401 || status === 403) {
          console.warn(
            "Gemini auth/access failed; falling back to Cerebras...",
          );
          throw error;
        }

        if (status === 429 && message.includes("limit: 0")) {
          console.warn(
            `Gemini model "${modelName}" has no free-tier quota; trying next model...`,
          );
          break;
        }

        if (isTransient(status) && attempt < maxRetries) {
          const delayMs = 1500 * 2 ** attempt;
          console.warn(
            `Gemini ${status} on ${modelName}; retrying in ${delayMs / 1000}s...`,
          );
          await sleep(delayMs);
          continue;
        }

        if (isTransient(status)) {
          console.warn(
            `Gemini ${status} on ${modelName} after retries; trying next model...`,
          );
          break;
        }

        if (status === 404 || message.toLowerCase().includes("not found")) {
          console.warn(
            `Gemini model "${modelName}" unavailable; trying next model...`,
          );
          break;
        }

        // Non-retryable model error — try next Gemini model, then Cerebras.
        console.warn(
          `Gemini failed on ${modelName}: ${message.slice(0, 120)}; trying next...`,
        );
        break;
      }
    }
  }

  const tried = models.join(", ");
  throw new Error(
    `Gemini failed for all models (${tried})`,
    { cause: lastError },
  );
}

async function getCerebrasAgentResponse(
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const model = getCerebrasModel();
  const maxRetriesFor = (status: number | undefined) =>
    status === 503 ? MAX_RETRIES_503 : MAX_RETRIES_429;

  for (let attempt = 0; ; attempt++) {
    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content?.trim()) {
        throw new Error("Cerebras returned an empty response");
      }
      return JSON.parse(content) as Record<string, unknown>;
    } catch (error) {
      const status = statusOf(error);
      const message = error instanceof Error ? error.message : String(error);
      const maxRetries = maxRetriesFor(status);

      if (status === 401 || status === 403) {
        throw new Error(
          "AI_API_KEY is invalid or lacks access. Get a key at https://cloud.cerebras.ai/ and put it in .env",
          { cause: error },
        );
      }

      if (isTransient(status) && attempt < maxRetries) {
        const delayMs = 1500 * 2 ** attempt;
        console.warn(
          `Cerebras ${status} on ${model}; retrying in ${delayMs / 1000}s...`,
        );
        await sleep(delayMs);
        continue;
      }

      if (error instanceof Error) throw error;
      throw new Error("Cerebras request failed", { cause: error });
    }
  }
}

/**
 * Fast structured JSON responses.
 * Primary: Gemini (with model fallbacks). Fallback: Cerebras via OpenAI SDK.
 * Prompt contract is unchanged: system + user → JSON object.
 */
export async function getAgentResponse(
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  loadDotEnv();
  const hasGemini = Boolean(readEnvKey("GEMINI_API_KEY"));
  const hasCerebras = Boolean(readEnvKey("AI_API_KEY"));

  if (!hasGemini && !hasCerebras) {
    throw new Error(
      "No AI keys set. Add GEMINI_API_KEY and/or AI_API_KEY to .env",
    );
  }

  let geminiError: unknown;

  if (hasGemini) {
    try {
      return await getGeminiAgentResponse(systemPrompt, userPrompt);
    } catch (error) {
      geminiError = error;
      if (!hasCerebras) throw error;
      console.warn(
        "Gemini unavailable; falling back to Cerebras...",
      );
    }
  }

  try {
    return await getCerebrasAgentResponse(systemPrompt, userPrompt);
  } catch (cerebrasError) {
    if (geminiError) {
      throw new Error(
        "Both Gemini and Cerebras failed. Check GEMINI_API_KEY / AI_API_KEY and quotas.",
        { cause: cerebrasError },
      );
    }
    throw cerebrasError;
  }
}
