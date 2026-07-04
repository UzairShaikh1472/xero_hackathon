/**
 * One-shot verification of Gemini primary + Cerebras fallback.
 * Run: npx tsx scripts/verify-llm.ts
 */
import { getAgentResponse, getOpenAIClient, getModel } from "../src/lib/llm.js";

const system = `You are a JSON API. Reply with only a JSON object matching:
{"draftMessage":"string","reason":"string","confidenceLevel":0.0}`;
const user = `Write a short polite payment reminder for Acme Ltd invoice INV-100 for £500 overdue 12 days.
confidenceLevel must be between 0 and 1.`;

function summarize(label: string, result: Record<string, unknown>) {
  const keys = Object.keys(result).sort().join(",");
  const msg =
    typeof result.draftMessage === "string"
      ? result.draftMessage.slice(0, 80)
      : "(missing)";
  console.log(`OK ${label}`);
  console.log(`  keys: ${keys}`);
  console.log(`  draftMessage: ${msg}...`);
  console.log(`  confidenceLevel: ${result.confidenceLevel}`);
}

async function main() {
  console.log("=== 1) Cerebras direct (json_object) ===");
  // Load env via client init
  getOpenAIClient();
  const model = process.env.AI_MODEL?.trim() || "gpt-oss-120b";
  console.log(`Cerebras model: ${model}`);
  const completion = await getOpenAIClient().chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });
  const content = completion.choices[0]?.message?.content;
  if (!content?.trim()) throw new Error("Cerebras empty response");
  summarize("Cerebras", JSON.parse(content) as Record<string, unknown>);

  console.log("\n=== 2) getAgentResponse (Gemini primary) ===");
  console.log(`Gemini model: ${getModel()}`);
  const agentJson = await getAgentResponse(system, user);
  summarize("getAgentResponse", agentJson);

  console.log("\n=== 3) Forced Cerebras-only path (Gemini key unset) ===");
  const savedGemini = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const fallbackJson = await getAgentResponse(system, user);
    summarize("Cerebras fallback path", fallbackJson);
  } finally {
    if (savedGemini !== undefined) process.env.GEMINI_API_KEY = savedGemini;
  }

  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error("\nVerification failed:");
  console.error(err);
  process.exit(1);
});
