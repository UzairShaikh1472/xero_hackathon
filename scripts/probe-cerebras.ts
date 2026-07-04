/**
 * Probe Cerebras models/chat without printing secrets.
 * Run: npx tsx scripts/probe-cerebras.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadAiKey(): string {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) throw new Error(".env missing");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("AI_API_KEY=")) continue;
    let value = trimmed.slice("AI_API_KEY=".length).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value) throw new Error("AI_API_KEY empty");
    return value;
  }
  throw new Error("AI_API_KEY not found");
}

async function request(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: string }> {
  const key = loadAiKey();
  const res = await fetch(`https://api.cerebras.ai/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function main() {
  console.log("GET /models");
  const models = await request("/models");
  console.log(`  status: ${models.status}`);
  console.log(`  body: ${models.body.slice(0, 500)}`);

  for (const model of [
    "llama-3.3-70b",
    "llama3.1-8b",
    "llama3.1-70b",
    "gpt-oss-120b",
  ]) {
    console.log(`\nPOST /chat/completions model=${model}`);
    const chat = await request("/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      }),
    });
    console.log(`  status: ${chat.status}`);
    console.log(`  body: ${chat.body.slice(0, 300)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
