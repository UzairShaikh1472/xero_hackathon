import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

import { buildVoiceCollectionSystemPrompt } from "../../agents/voiceCollectionPrompt.js";
import { buildVoiceReengagementSystemPrompt } from "../../agents/voiceReengagementPrompt.js";
import type { ApiEnvelope, VoiceChatRequest, VoiceChatResponse } from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";
import { buildElevenLabsAudioUrl } from "./elevenlabs-tts-service.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new HttpError(504, `${label} timed out.`)), timeoutMs);
    })
  ]);
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
  if (message === "__START_CALL__") {
    return [
      "Open the call now.",
      "Greet the customer naturally.",
      "Mention the invoice or account context once.",
      "Ask the single best first question to move the conversation forward.",
      "Keep it spoken, concise, and professional."
    ].join(" ");
  }

  const prior = (history ?? [])
    .slice(-8)
    .map((turn) => `${turn.role === "user" ? "Customer" : "Agent"}: ${turn.content}`)
    .join("\n");

  return prior
    ? [
        prior,
        `Customer: ${message}`,
        "",
        "Reply as the voice agent.",
        "Answer the customer's latest point first.",
        "If needed, ask one short next question.",
        "Do not repeat your earlier wording unless the customer asked you to repeat it.",
        "Keep it spoken and concise."
      ].join("\n")
    : [
        `Customer: ${message}`,
        "",
        "Reply as the voice agent.",
        "Answer the customer's latest point first.",
        "If needed, ask one short next question.",
        "Keep it spoken and concise."
      ].join("\n");
}

async function buildVoicePayload(
  snapshotSource: ApiEnvelope<unknown>["mode"],
  reply: string
): Promise<ApiEnvelope<VoiceChatResponse>> {
  let audioUrl: string | undefined;
  try {
    audioUrl = await withTimeout(buildElevenLabsAudioUrl(reply), 8000, "ElevenLabs voice");
  } catch {
    audioUrl = undefined;
  }

  return {
    ok: true,
    mode: snapshotSource,
    generatedAt: new Date().toISOString(),
    data: audioUrl ? { reply, audioUrl, audioProvider: "elevenlabs" } : { reply }
  };
}

function extractSpecificDate(message: string) {
  const match = message.match(
    /\b(?:on\s+)?((?:mon|tues|wednes|thurs|fri|satur|sun)day|tomorrow|next week|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+)\b/i
  );
  return match?.[1]?.trim();
}

function isAffirmative(message: string) {
  return /\b(yes|yeah|yep|correct|okay|ok|sure)\b/i.test(message);
}

function isGreetingOnly(message: string) {
  return /^(hi|hello|hey|hiya|good morning|good afternoon|good evening)[\s!.?]*$/i.test(
    message.trim()
  );
}

function asksHowAreYou(message: string) {
  return /\b(how are you|how's it going|how are things|you alright|you ok)\b/i.test(message);
}

function asksPurpose(message: string) {
  return /\b(why are you calling|what are you calling about|what is this about|what's this about|who are you|where are you calling from|why did you call)\b/i.test(message);
}

function asksRepeat(message: string) {
  return /\b(repeat|say that again|didn't catch|did not catch|pardon|sorry what)\b/i.test(message);
}

function buildCollectionPurposeReply(session: ReturnType<typeof getVoiceSessionForChat>) {
  if (session.overdueBalanceWithCharges && session.statutoryInterest != null && session.fixedCompensation != null) {
    return `I'm well, thank you. I'm calling about invoice ${session.invoiceNumber}, which is still overdue. Including estimated UK late-payment charges, the balance is now ${session.currency} ${session.overdueBalanceWithCharges.toFixed(2)}. Is payment scheduled, or is anything blocking it?`;
  }
  return `I'm well, thank you. I'm calling about invoice ${session.invoiceNumber}, which is still overdue for ${session.currency} ${session.amountDue.toFixed(2)}. Is payment scheduled, or is anything blocking it?`;
}

function buildReengagementPurposeReply(session: ReturnType<typeof getVoiceSessionForChat>) {
  const inactiveDays = session.daysSinceLastActivity ?? session.daysOverdue;
  return `I'm well, thank you. I'm calling because it has been ${inactiveDays} days since we last worked together, and we wanted to see if you have upcoming work or need a refreshed quote.`;
}

function buildRuleBasedCollectionReply(
  session: ReturnType<typeof getVoiceSessionForChat>,
  message: string
) {
  const normalized = message.trim().toLowerCase();
  const specificDate = extractSpecificDate(message);

  if (normalized === "__start_call__") {
    return session.overdueBalanceWithCharges
      ? `Hi, this is UpFlow calling about invoice ${session.invoiceNumber}. It is still overdue, and the current estimated UK late-payment balance is ${session.currency} ${session.overdueBalanceWithCharges.toFixed(2)}. Is payment scheduled, or is anything blocking it?`
      : `Hi, this is UpFlow calling about invoice ${session.invoiceNumber}. It is still overdue. Is payment scheduled, or is anything blocking it?`;
  }

  if (isGreetingOnly(message)) {
    return session.overdueBalanceWithCharges
      ? `Hi, thanks for taking the call. This is about invoice ${session.invoiceNumber}; the current estimated balance is ${session.currency} ${session.overdueBalanceWithCharges.toFixed(2)}. Is payment scheduled, or is anything blocking it?`
      : `Hi, thanks for taking the call. This is about invoice ${session.invoiceNumber}; is payment scheduled, or is anything blocking it?`;
  }

  if (asksHowAreYou(message) || asksPurpose(message)) {
    return buildCollectionPurposeReply(session);
  }

  if (asksRepeat(message)) {
    return session.overdueBalanceWithCharges
      ? `Of course. This is UpFlow calling about invoice ${session.invoiceNumber}. The current estimated UK late-payment balance is ${session.currency} ${session.overdueBalanceWithCharges.toFixed(2)}. Is payment scheduled, or is anything blocking it?`
      : `Of course. This is UpFlow calling about invoice ${session.invoiceNumber}. Is payment scheduled, or is anything blocking it?`;
  }

  if (/\b(already paid|already sent|paid it|payment sent|transferred|bank transfer made|done the payment)\b/i.test(message)) {
    return "Thanks for letting me know. Could you please confirm the payment date or expected clearing date so we can update the finance team correctly?";
  }

  if (specificDate && /\b(pay|payment|send|transfer|clear|clearing|by)\b/i.test(message)) {
    return `Thank you, I have noted ${specificDate}. Is there anything else likely to delay that payment, or should the finance team expect it as planned?`;
  }

  if (/\b(soon|next week|later this week|tomorrow|shortly|in a few days)\b/i.test(message)) {
    return "Thank you. Could you give me a specific payment date so the finance team can note it properly?";
  }

  if (/\b(invoice|copy|statement|email it|send it|resend)\b/i.test(message)) {
    return "Of course. I will note that the invoice copy should be resent by email. Apart from that, is anything else blocking payment on your side?";
  }

  if (/\b(approval|approver|manager approval|director approval|sign off|signoff)\b/i.test(message)) {
    return "Understood. When do you expect that approval to be completed, and should the finance team follow up with anyone specific?";
  }

  if (/\b(cash flow|cashflow|funds|money is tight|can't pay|cannot pay|payment plan|instalment|installment)\b/i.test(message)) {
    return "I understand. Would a specific payment date be more realistic, or should the finance team discuss a short staged payment plan with you?";
  }

  if (/\b(dispute|problem|issue|wrong|incorrect|query|complaint)\b/i.test(message)) {
    return "Thanks for flagging that. Could you briefly tell me what the issue is, so I can route it correctly for the finance team to follow up?";
  }

  if (/\b(human|person|someone|call me back|speak to finance|real person)\b/i.test(message)) {
    return "No problem. I will note that a member of the finance team should follow up with you directly by email or phone.";
  }

  if (/\b(who is this|what is this about|which invoice|don't understand|confused)\b/i.test(message)) {
    return session.overdueBalanceWithCharges
      ? `Of course. This is about invoice ${session.invoiceNumber}, currently ${session.daysOverdue} days overdue. Including estimated UK late-payment charges, the balance is ${session.currency} ${session.overdueBalanceWithCharges.toFixed(2)}. Has payment already been arranged, or is there a blocker we should note?`
      : `Of course. This is about invoice ${session.invoiceNumber} for ${session.currency} ${session.amountDue.toFixed(2)}, currently ${session.daysOverdue} days overdue. Has payment already been arranged, or is there a blocker we should note?`;
  }

  if (isAffirmative(message)) {
    return "Thank you. Can you confirm the expected payment date so I can note it accurately for the finance team?";
  }

  return "Sorry, I did not catch that clearly. Just so I route this correctly, has the payment already been made, is a payment date planned, or do you need support from the finance team?";
}

function buildRuleBasedReengagementReply(
  session: ReturnType<typeof getVoiceSessionForChat>,
  message: string
) {
  const normalized = message.trim().toLowerCase();
  const specificDate = extractSpecificDate(message);

  if (normalized === "__start_call__") {
    return `Hi, this is UpFlow. It has been a while since we last worked together. Do you have upcoming work we can help with, or would a refreshed quote be useful?`;
  }

  if (isGreetingOnly(message)) {
    return "Hi, thanks for taking the call. I am calling to see if you have any upcoming work we can help with, or if a refreshed quote would be useful.";
  }

  if (asksHowAreYou(message) || asksPurpose(message)) {
    return buildReengagementPurposeReply(session);
  }

  if (asksRepeat(message)) {
    return "Of course. I am calling to see if you have upcoming work we can help with, or if a refreshed quote would be useful.";
  }

  if (/\b(not interested|no thanks|stop|remove|don't call)\b/i.test(message)) {
    return "Understood, thank you for letting me know. I will note that preference so the team can avoid unnecessary follow-up.";
  }

  if (/\b(yes|interested|maybe|possibly|could be|looking at something)\b/i.test(message)) {
    return specificDate
      ? `That sounds promising. I have noted ${specificDate}. Would you like the team to follow up with a quote, or would a short call with a human be better?`
      : "That sounds promising. Would you like the team to follow up with a quote, a quick human call, or a short email with next steps?";
  }

  if (/\b(budget|timing|later|quarter|month|not now)\b/i.test(message)) {
    return "Understood. What timeframe feels more realistic for revisiting this, so the team can follow up at the right time?";
  }

  if (/\b(quote|pricing|price|proposal)\b/i.test(message)) {
    return "Absolutely. I can note that you would like pricing or a proposal. Is there a particular service or scope the team should prepare it around?";
  }

  return "Thanks, that helps. Just so I point the team in the right direction, would a quote, a quick human call, or a later follow-up be most useful for you?";
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
  const deterministicReply =
    session.draftType === "reengagement_quote"
      ? buildRuleBasedReengagementReply(session, message)
      : buildRuleBasedCollectionReply(session, message);

  if (message === "__START_CALL__") {
    return buildVoicePayload(snapshot.sync.source, deterministicReply);
  }

  if (
    isGreetingOnly(message) ||
    asksHowAreYou(message) ||
    asksPurpose(message) ||
    asksRepeat(message)
  ) {
    return buildVoicePayload(snapshot.sync.source, deterministicReply);
  }

  const systemPrompt =
    session.draftType === "reengagement_quote"
      ? buildVoiceReengagementSystemPrompt({
          contactName: session.contactName,
          daysSinceLastActivity: session.daysSinceLastActivity ?? session.daysOverdue,
          historicalLTV: session.historicalLTV ?? session.amountDue,
          currency: session.currency,
          offerPercent: session.offerPercent
        })
      : buildVoiceCollectionSystemPrompt({
          contactName: session.contactName,
          invoiceNumber: session.invoiceNumber,
          amountDue: session.amountDue,
          principalAmount: session.principalAmount,
          statutoryInterest: session.statutoryInterest,
          fixedCompensation: session.fixedCompensation,
          overdueBalanceWithCharges: session.overdueBalanceWithCharges,
          statutoryAnnualRatePercent: session.statutoryAnnualRatePercent,
          currency: session.currency,
          daysOverdue: session.daysOverdue,
          discountPercent: session.discountPercent
        });

  const userPrompt = buildConversationPrompt(message, input.history);

  let reply: string;
  try {
    reply = await withTimeout(getGeminiReply(systemPrompt, userPrompt), 6000, "Gemini voice reply");
  } catch {
    try {
      reply = await withTimeout(getCerebrasReply(systemPrompt, userPrompt), 6000, "Fallback voice reply");
    } catch {
      reply = deterministicReply;
    }
  }

  return buildVoicePayload(snapshot.sync.source, reply);
}
