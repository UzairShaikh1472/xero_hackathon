import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

import type { ApiEnvelope, VoiceChatRequest, VoiceChatResponse } from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";
import { buildVoiceCollectionSystemPrompt } from "../../agents/voiceCollectionPrompt.js";
import { getVoiceSessionForChat } from "./voice-session-service.js";

async function getGeminiReply(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, "Gemini is not configured for voice chat.");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0.4 }
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text()?.trim();
  if (!text) {
    throw new HttpError(502, "Voice agent returned an empty response.");
  }
  return text;
}

async function getCerebrasReply(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, "AI is not configured for voice chat.");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.cerebras.ai/v1"
  });

  const completion = await client.chat.completions.create({
    model: process.env.AI_MODEL || "gpt-oss-120b",
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new HttpError(502, "Voice agent returned an empty response.");
  }
  return text;
}

function buildConversationPrompt(
  message: string,
  history: VoiceChatRequest["history"]
) {
  const prior = (history ?? [])
    .slice(-8)
    .map((turn) => `${turn.role === "user" ? "Customer" : "Agent"}: ${turn.content}`)
    .join("\n");

  return prior
    ? `${prior}\nCustomer: ${message}\n\nReply as the collections agent (spoken, concise):`
    : `Customer: ${message}\n\nReply as the collections agent (spoken, concise):`;
}

export async function buildVoiceChatResponse(
  input: VoiceChatRequest
): Promise<ApiEnvelope<VoiceChatResponse>> {
  const snapshot = await getPhaseOneSnapshotData();
  const token = String(input.token ?? "").trim();
  const message = String(input.message ?? "").trim();

  if (!token) {
    throw new HttpError(400, "Missing token");
  }
  if (!message) {
    throw new HttpError(400, "Missing message");
  }

  const session = getVoiceSessionForChat(token);
  const systemPrompt = buildVoiceCollectionSystemPrompt({
    contactName: session.contactName,
    invoiceNumber: session.invoiceNumber,
    amountDue: session.amountDue,
    currency: session.currency,
    daysOverdue: session.daysOverdue,
    discountPercent: session.discountPercent
  });

  const userPrompt = buildConversationPrompt(message, input.history);

  let reply: string;
  try {
    reply = await getGeminiReply(systemPrompt, userPrompt);
  } catch {
    reply = await getCerebrasReply(systemPrompt, userPrompt);
  }

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: { reply }
  };
}
