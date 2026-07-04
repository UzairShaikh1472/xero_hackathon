import nodemailer from "nodemailer";

import { isEmailConfigured, isVoiceConfigured } from "../config/communications-config.js";
import { env } from "../config/env.js";
import type {
  ApiEnvelope,
  CommunicationActionResult,
  NegotiationDraft,
  PlaceDraftCallRequest,
  SendDraftEmailRequest
} from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";
import { getStoredDraft } from "../utils/idempotency.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";

function getDraftOrThrow(draftId: string) {
  const draft = getStoredDraft(draftId);
  if (!draft) {
    throw new HttpError(404, "Draft not found. Refresh the dashboard and generate the draft again.");
  }

  return draft;
}

function getMetadataNumber(draft: NegotiationDraft, field: string) {
  const value = draft.metadata[field];
  return typeof value === "number" ? value : 0;
}

function getMetadataString(draft: NegotiationDraft, field: string) {
  const value = draft.metadata[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function ensureReceivablesDraft(draft: NegotiationDraft) {
  if (draft.type !== "receivables_discount") {
    throw new HttpError(400, "Only receivables drafts can be sent to clients.");
  }
}

function ensureEmailEligibility(draft: NegotiationDraft) {
  ensureReceivablesDraft(draft);
  const daysOverdue = getMetadataNumber(draft, "daysOverdue");
  if (daysOverdue >= 14) {
    throw new HttpError(400, "Email reminders are only available for invoices overdue by fewer than 14 days.");
  }
}

function ensureCallEligibility(draft: NegotiationDraft) {
  ensureReceivablesDraft(draft);
  const daysOverdue = getMetadataNumber(draft, "daysOverdue");
  if (daysOverdue < 15) {
    throw new HttpError(400, "Automated calls are only available for invoices overdue by 15 days or more.");
  }
}

function buildCallScript(draft: NegotiationDraft) {
  const invoiceNumber = getMetadataString(draft, "invoiceNumber") ?? "your outstanding invoice";
  const daysOverdue = getMetadataNumber(draft, "daysOverdue");

  return [
    `Hello, this is UpFlow calling on behalf of your finance team regarding ${invoiceNumber}.`,
    `This is a polite reminder that the invoice is now ${daysOverdue} days overdue.`,
    `The current outstanding balance is ${draft.currency} ${draft.expectedImpact.amount.toFixed(2)}.`,
    "If payment has already been arranged, please disregard this reminder and thank you.",
    "If not, we would appreciate settlement as soon as possible, or a quick reply to confirm your expected payment date.",
    "Thank you for your time and continued partnership."
  ].join(" ");
}

async function sendWithSmtp(draft: NegotiationDraft, email: string) {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  return transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: draft.subjectLine,
    text: draft.draftMessage,
    html: `<p>${draft.draftMessage.replace(/\n/g, "<br />")}</p>`
  });
}

async function placeTwilioCall(to: string, script: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`;
  const body = new URLSearchParams({
    To: to,
    From: env.TWILIO_FROM_NUMBER,
    Twiml: `<Response><Say voice="alice">${escapeXml(script)}</Say></Response>`
  });

  const credentials = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString(
    "base64"
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const message = await response.text();
    throw new HttpError(502, `Twilio call failed: ${message}`);
  }

  return (await response.json()) as { sid?: string; status?: string };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function buildSendDraftEmailResponse(
  input: SendDraftEmailRequest
): Promise<ApiEnvelope<CommunicationActionResult>> {
  const snapshot = await getPhaseOneSnapshotData();
  const draftId = String(input.draftId ?? "").trim();
  if (!draftId) {
    throw new HttpError(400, "Missing draftId");
  }

  const draft = getDraftOrThrow(draftId);
  ensureEmailEligibility(draft);

  if (!isEmailConfigured()) {
    throw new HttpError(503, "SMTP email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  }

  const recipientEmail = getMetadataString(draft, "contactEmail");
  if (!recipientEmail) {
    throw new HttpError(400, "This client does not have an email address in Xero.");
  }

  const info = await sendWithSmtp(draft, recipientEmail);
  logger.info("communications.email.sent", {
    draftId,
    recipientEmail,
    messageId: info.messageId
  });

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      draftId,
      channel: "email",
      status: "sent",
      recipientName: draft.targetName,
      recipientEmail,
      providerId: info.messageId,
      message: `Reminder email sent to ${recipientEmail}.`
    }
  };
}

export async function buildPlaceDraftCallResponse(
  input: PlaceDraftCallRequest
): Promise<ApiEnvelope<CommunicationActionResult>> {
  const snapshot = await getPhaseOneSnapshotData();
  const draftId = String(input.draftId ?? "").trim();
  if (!draftId) {
    throw new HttpError(400, "Missing draftId");
  }

  const draft = getDraftOrThrow(draftId);
  ensureCallEligibility(draft);

  if (!isVoiceConfigured()) {
    throw new HttpError(503, "Twilio voice is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.");
  }

  const recipientPhone = getMetadataString(draft, "contactPhone");
  if (!recipientPhone) {
    throw new HttpError(400, "This client does not have a phone number in Xero.");
  }

  const script = buildCallScript(draft);
  const result = await placeTwilioCall(recipientPhone, script);

  logger.info("communications.call.queued", {
    draftId,
    recipientPhone,
    callSid: result.sid ?? null
  });

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      draftId,
      channel: "call",
      status: "queued",
      recipientName: draft.targetName,
      recipientPhone,
      providerId: result.sid,
      message: `Reminder call queued to ${recipientPhone}.`,
      scriptPreview: script
    }
  };
}
