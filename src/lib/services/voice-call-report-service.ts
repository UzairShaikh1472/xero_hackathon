import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";
import OpenAI from "openai";

import { isEmailConfigured } from "../config/communications-config.js";
import { env } from "../config/env.js";
import type {
  ApiEnvelope,
  VoiceCallCompleteRequest,
  VoiceCallCompleteResponse,
  VoiceCallTurn
} from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";
import { getStoredDraft } from "../utils/idempotency.js";
import { recordFollowUp } from "../utils/follow-up-store.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";
import { buildCallReportHtml, buildCallReportText } from "./email-templates.js";
import { getVoiceSessionForChat } from "./voice-session-service.js";

async function getGeminiSummary(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, "Gemini is not configured.");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    generationConfig: { temperature: 0.3 }
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text()?.trim();
  if (!text) {
    throw new HttpError(502, "Call summary returned an empty response.");
  }
  return text;
}

async function getCerebrasSummary(prompt: string): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, "AI is not configured.");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.cerebras.ai/v1"
  });

  const completion = await client.chat.completions.create({
    model: process.env.AI_MODEL || "gpt-oss-120b",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          "You summarize collections calls for a finance team. Be concise, factual, and use plain English bullet points."
      },
      { role: "user", content: prompt }
    ]
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new HttpError(502, "Call summary returned an empty response.");
  }
  return text;
}

function formatTranscriptForPrompt(
  contactName: string,
  transcript: VoiceCallTurn[]
): string {
  return transcript
    .map((turn) => {
      const speaker = turn.role === "user" ? contactName : "Agent";
      return `${speaker}: ${turn.content}`;
    })
    .join("\n");
}

function buildFallbackSummary(
  contactName: string,
  invoiceNumber: string,
  transcript: VoiceCallTurn[]
): string {
  const customerTurns = transcript.filter((turn) => turn.role === "user").length;
  return [
    `Call with ${contactName} about invoice ${invoiceNumber}.`,
    `${transcript.length} message${transcript.length === 1 ? "" : "s"} recorded (${customerTurns} from customer).`,
    "Review the full transcript below for payment commitments or blockers."
  ].join(" ");
}

async function generateCallSummary(params: {
  contactName: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  daysOverdue: number;
  transcript: VoiceCallTurn[];
}): Promise<string> {
  const prompt = `Summarize this collections call for the finance team.

Invoice: ${params.invoiceNumber}
Customer: ${params.contactName}
Amount due: ${params.currency} ${params.amountDue.toFixed(2)}
Days overdue: ${params.daysOverdue}

Transcript:
${formatTranscriptForPrompt(params.contactName, params.transcript)}

Include:
- Outcome / next step
- Any promised payment date
- Blockers or disputes mentioned
- Recommended follow-up action

Keep it to 3-5 bullet points.`;

  try {
    return await getGeminiSummary(prompt);
  } catch {
    try {
      return await getCerebrasSummary(prompt);
    } catch {
      return buildFallbackSummary(
        params.contactName,
        params.invoiceNumber,
        params.transcript
      );
    }
  }
}

function resolveReportRecipient(): string {
  const testEmail = env.COMMUNICATIONS_TEST_EMAIL.trim();
  if (testEmail) {
    return testEmail;
  }

  const reportEmail = env.CALL_REPORT_EMAIL.trim();
  if (reportEmail) {
    return reportEmail;
  }

  const from = env.SMTP_FROM.trim();
  const match = from.match(/<([^>]+)>/);
  if (match?.[1]) {
    return match[1];
  }
  if (from.includes("@")) {
    return from;
  }

  throw new HttpError(
    503,
    "No call report recipient configured. Set CALL_REPORT_EMAIL or COMMUNICATIONS_TEST_EMAIL."
  );
}

async function sendCallReportEmail(params: {
  contactName: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  daysOverdue: number;
  summary: string;
  transcript: VoiceCallTurn[];
}) {
  const recipientEmail = resolveReportRecipient();
  const subject = `Call summary: ${params.contactName} — ${params.invoiceNumber}`;
  const html = buildCallReportHtml(params);
  const text = buildCallReportText(params);

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  const info = await transporter.sendMail({
    from: env.SMTP_FROM,
    to: recipientEmail,
    subject,
    text,
    html
  });

  return { recipientEmail, messageId: info.messageId };
}

function trackCallFollowUp(draftId: string) {
  const draft = getStoredDraft(draftId);
  if (!draft || draft.type !== "receivables_discount") {
    return;
  }

  recordFollowUp({
    draftId: draft.id,
    invoiceId: draft.targetId,
    invoiceNumber:
      typeof draft.metadata.invoiceNumber === "string"
        ? draft.metadata.invoiceNumber
        : draft.targetId,
    contactName: draft.targetName,
    channel: "call",
    expectedCashImpact: draft.expectedImpact.amount,
    currency: draft.currency
  });
}

export async function buildVoiceCallCompleteResponse(
  input: VoiceCallCompleteRequest
): Promise<ApiEnvelope<VoiceCallCompleteResponse>> {
  const snapshot = await getPhaseOneSnapshotData();
  const token = String(input.token ?? "").trim();
  const transcript = (input.transcript ?? []).filter(
    (turn) => typeof turn.content === "string" && turn.content.trim()
  );

  if (!token) {
    throw new HttpError(400, "Missing token");
  }
  if (transcript.length === 0) {
    throw new HttpError(400, "Transcript is empty. Complete a call before submitting.");
  }

  const session = getVoiceSessionForChat(token);
  const summary = await generateCallSummary({
    contactName: session.contactName,
    invoiceNumber: session.invoiceNumber,
    amountDue: session.amountDue,
    currency: session.currency,
    daysOverdue: session.daysOverdue,
    transcript
  });

  let emailSent = false;
  let recipientEmail: string | undefined;
  let message = "Call summary generated.";

  if (isEmailConfigured()) {
    const info = await sendCallReportEmail({
      contactName: session.contactName,
      invoiceNumber: session.invoiceNumber,
      amountDue: session.amountDue,
      currency: session.currency,
      daysOverdue: session.daysOverdue,
      summary,
      transcript
    });
    emailSent = true;
    recipientEmail = info.recipientEmail;
    message = env.COMMUNICATIONS_TEST_EMAIL.trim()
      ? `Call summary emailed to test inbox (${recipientEmail}).`
      : `Call summary emailed to ${recipientEmail}.`;

    logger.info("voice.call_report.sent", {
      token,
      draftId: session.draftId,
      recipientEmail,
      messageId: info.messageId
    });
  } else {
    message = "Call summary generated. Configure SMTP to email reports automatically.";
    logger.info("voice.call_report.generated", {
      token,
      draftId: session.draftId,
      emailSent: false
    });
  }

  trackCallFollowUp(session.draftId);

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      contactName: session.contactName,
      invoiceNumber: session.invoiceNumber,
      summary,
      transcript,
      emailSent,
      recipientEmail,
      message
    }
  };
}
