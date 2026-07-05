import nodemailer from "nodemailer";

import {
  isBrowserVoiceConfigured,
  isEmailConfigured,
  isVoiceConfigured
} from "../config/communications-config.js";
import { env } from "../config/env.js";
import type {
  ApiEnvelope,
  CommunicationActionResult,
  NegotiationDraft,
  PlaceDraftCallRequest,
  SendDraftEmailRequest,
  SendVoiceInviteRequest
} from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";
import { appendActivityLog } from "../utils/activity-log-store.js";
import {
  deriveDraftLogStep,
  getDraftInvoiceId,
  getDraftInvoiceNumber,
} from "../utils/activity-log-helpers.js";
import { getStoredDraft } from "../utils/idempotency.js";
import { recordFollowUp } from "../utils/follow-up-store.js";
import { REACTIVATION_VOICE_THRESHOLD_DAYS } from "../../engines/revenue.js";
import { buildReceivablesDraftResponse, buildReengagementQuoteResponse } from "./action-service.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";
import {
  buildPaymentReminderHtml,
  buildPaymentReminderText,
  buildReactivationEmailHtml,
  buildReactivationEmailText,
  buildReactivationVoiceInviteHtml,
  buildReactivationVoiceInviteText,
  buildVoiceInviteHtml,
  buildVoiceInviteText
} from "./email-templates.js";
import {
  buildCallUrl,
  createVoiceSessionFromDraft
} from "./voice-session-service.js";

async function getDraftOrThrow(draftId: string, targetId?: string) {
  const existing = getStoredDraft(draftId);
  if (
    existing &&
    (existing.type !== "receivables_discount" ||
      typeof existing.metadata.statutoryTotalAmountDue === "number")
  ) {
    return existing;
  }

  const resolvedReceivablesId =
    targetId?.trim() ||
    draftId.match(/^draft_receivables_(.+)$/)?.[1] ||
    "";

  if (resolvedReceivablesId && draftId.startsWith("draft_receivables_")) {
    logger.info("communications.draft.regenerating", {
      draftId,
      invoiceId: resolvedReceivablesId,
    });
    const envelope = await buildReceivablesDraftResponse({
      invoiceId: resolvedReceivablesId,
      useAgent: false,
    });
    return envelope.data;
  }

  const resolvedContactId =
    targetId?.trim() ||
    draftId.match(/^draft_reengagement_(.+)$/)?.[1] ||
    "";

  if (resolvedContactId && draftId.startsWith("draft_reengagement_")) {
    logger.info("communications.draft.regenerating", {
      draftId,
      contactId: resolvedContactId,
    });
    const envelope = await buildReengagementQuoteResponse({
      contactId: resolvedContactId,
    });
    return envelope.data;
  }

  throw new HttpError(404, "Draft not found. Refresh the dashboard and generate the draft again.");
}

function getMetadataNumber(draft: NegotiationDraft, field: string) {
  const value = draft.metadata[field];
  return typeof value === "number" ? value : 0;
}

function getMetadataString(draft: NegotiationDraft, field: string) {
  const value = draft.metadata[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function ensureSendableDraft(draft: NegotiationDraft) {
  if (draft.type !== "receivables_discount" && draft.type !== "reengagement_quote") {
    throw new HttpError(400, "Only receivables and reactivation drafts can be sent to clients.");
  }
}

function ensureEmailEligibility(draft: NegotiationDraft) {
  ensureSendableDraft(draft);

  if (draft.type === "receivables_discount") {
    const daysOverdue = getMetadataNumber(draft, "daysOverdue");
    if (daysOverdue >= 14) {
      throw new HttpError(
        400,
        "Email reminders are only available for invoices overdue by fewer than 14 days.",
      );
    }
    return;
  }

  const daysSinceLastActivity = getMetadataNumber(draft, "daysSinceLastActivity");
  if (daysSinceLastActivity >= REACTIVATION_VOICE_THRESHOLD_DAYS) {
    throw new HttpError(
      400,
      `Win-back emails are only available for customers inactive fewer than ${REACTIVATION_VOICE_THRESHOLD_DAYS} days. Use the voice agent invite instead.`,
    );
  }
}

function ensureVoiceInviteEligibility(draft: NegotiationDraft) {
  ensureSendableDraft(draft);

  if (draft.type === "receivables_discount") {
    const daysOverdue = getMetadataNumber(draft, "daysOverdue");
    if (daysOverdue < 14) {
      throw new HttpError(
        400,
        "Voice invites are only available for invoices overdue by 14 days or more.",
      );
    }
    return;
  }

  const daysSinceLastActivity = getMetadataNumber(draft, "daysSinceLastActivity");
  if (daysSinceLastActivity < REACTIVATION_VOICE_THRESHOLD_DAYS) {
    throw new HttpError(
      400,
      `Voice agent invites are only available for customers inactive ${REACTIVATION_VOICE_THRESHOLD_DAYS} days or more.`,
    );
  }
}

function ensureCallEligibility(draft: NegotiationDraft) {
  if (draft.type !== "receivables_discount") {
    throw new HttpError(400, "Automated phone calls are only available for receivables drafts.");
  }
  const daysOverdue = getMetadataNumber(draft, "daysOverdue");
  if (daysOverdue < 15) {
    throw new HttpError(400, "Automated calls are only available for invoices overdue by 15 days or more.");
  }
}

function mergeDraftOverrides(
  draft: NegotiationDraft,
  overrides: { subjectLine?: string; draftMessage?: string }
): NegotiationDraft {
  return {
    ...draft,
    subjectLine: overrides.subjectLine?.trim() || draft.subjectLine,
    draftMessage: overrides.draftMessage?.trim() || draft.draftMessage
  };
}

function resolveDraftRecipient(draft: NegotiationDraft): string {
  const testEmail = env.COMMUNICATIONS_TEST_EMAIL.trim();
  if (testEmail) {
    const contactEmail = getMetadataString(draft, "contactEmail");
    if (contactEmail) {
      logger.info("communications.email.test_override", {
        originalRecipient: contactEmail,
        testRecipient: testEmail
      });
    }
    return testEmail;
  }

  const contactEmail = getMetadataString(draft, "contactEmail");
  if (!contactEmail) {
    throw new HttpError(400, "This client does not have an email address in Xero.");
  }
  return contactEmail;
}

function buildCallScript(draft: NegotiationDraft) {
  const invoiceNumber = getMetadataString(draft, "invoiceNumber") ?? "your outstanding invoice";
  const daysOverdue = getMetadataNumber(draft, "daysOverdue");
  const updatedBalance = resolveLatePaymentBalance(draft);
  const statutoryInterest = resolveLatePaymentInterest(draft);
  const fixedCompensation = resolveLatePaymentCompensation(draft);

  return [
    `Hello, this is UpFlow calling on behalf of your finance team regarding ${invoiceNumber}.`,
    `This is a polite reminder that the invoice is now ${daysOverdue} days overdue.`,
    `Under UK late-payment rules, the current estimated balance is ${draft.currency} ${updatedBalance.toFixed(2)}, including ${draft.currency} ${statutoryInterest.toFixed(2)} in interest and a ${draft.currency} ${fixedCompensation.toFixed(2)} recovery fee.`,
    "If payment has already been arranged, please disregard this reminder and thank you.",
    "If not, we would appreciate settlement as soon as possible, or a quick reply to confirm your expected payment date.",
    "Thank you for your time and continued partnership."
  ].join(" ");
}

function logDraftCommunication(
  draft: NegotiationDraft,
  input: {
    eventType: "email_sent" | "voice_invite_sent" | "call_queued" | "call_started";
    title: string;
    detail?: string;
    channel: "email" | "call" | "voice_invite";
    providerId?: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
) {
  appendActivityLog({
    eventType: input.eventType,
    actor: "system",
    step: input.eventType === "email_sent" ? "email" : "agent_call",
    title: input.title,
    detail: input.detail,
    draftId: draft.id,
    targetId: draft.targetId,
    targetName: draft.targetName,
    invoiceId: getDraftInvoiceId(draft),
    invoiceNumber: getDraftInvoiceNumber(draft),
    channel: input.channel,
    amount: draft.expectedImpact.amount,
    currency: draft.currency,
    providerId: input.providerId,
    status: "completed",
    metadata: input.metadata,
  });
}

async function sendWithSmtp(
  draft: NegotiationDraft,
  email: string,
  options: { html: string; text: string }
) {
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
    text: options.text,
    html: options.html
  });
}

function resolveOrganizationName(
  draft: NegotiationDraft,
  snapshot: Awaited<ReturnType<typeof getPhaseOneSnapshotData>>
): string {
  return (
    getMetadataString(draft, "organizationName") ??
    snapshot.sync.organizationName ??
    "Your finance team"
  );
}

function resolveAmountDue(draft: NegotiationDraft): number {
  const stored = getMetadataNumber(draft, "amountDue");
  if (stored > 0) {
    return stored;
  }

  const discountPercent = getMetadataNumber(draft, "discountPercent");
  if (discountPercent > 0 && discountPercent < 100) {
    return Number(
      (draft.expectedImpact.amount / (1 - discountPercent / 100)).toFixed(2)
    );
  }

  return draft.expectedImpact.amount;
}

function resolveLatePaymentBalance(draft: NegotiationDraft): number {
  const stored = getMetadataNumber(draft, "statutoryTotalAmountDue");
  return stored > 0 ? stored : resolveAmountDue(draft);
}

function resolveLatePaymentInterest(draft: NegotiationDraft): number {
  return getMetadataNumber(draft, "statutoryInterest");
}

function resolveLatePaymentCompensation(draft: NegotiationDraft): number {
  return getMetadataNumber(draft, "fixedCompensation");
}

function buildPaymentReminderPayload(
  draft: NegotiationDraft,
  snapshot: Awaited<ReturnType<typeof getPhaseOneSnapshotData>>
) {
  const discountPercent = getMetadataNumber(draft, "discountPercent");
  const params = {
    contactName: draft.targetName,
    organizationName: resolveOrganizationName(draft, snapshot),
    body: draft.draftMessage,
    invoiceNumber: getMetadataString(draft, "invoiceNumber") ?? "outstanding invoice",
    amountDue: resolveAmountDue(draft),
    currency: draft.currency,
    daysOverdue: getMetadataNumber(draft, "daysOverdue"),
    discountPercent: discountPercent > 0 ? discountPercent : undefined,
    discountedAmount:
      discountPercent > 0 ? draft.expectedImpact.amount : undefined,
  };

  return {
    html: buildPaymentReminderHtml(params),
    text: buildPaymentReminderText(params),
  };
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

function trackFollowUp(draft: NegotiationDraft, channel: "email" | "call") {
  recordFollowUp({
    draftId: draft.id,
    invoiceId: draft.type === "receivables_discount" ? draft.targetId : draft.id,
    invoiceNumber:
      getMetadataString(draft, "invoiceNumber") ??
      (draft.type === "reengagement_quote" ? "reactivation" : draft.targetId),
    contactName: draft.targetName,
    channel,
    expectedCashImpact: draft.expectedImpact.amount,
    currency: draft.currency,
  });
}

function buildDraftEmailPayload(
  draft: NegotiationDraft,
  snapshot: Awaited<ReturnType<typeof getPhaseOneSnapshotData>>,
) {
  if (draft.type === "reengagement_quote") {
    const offerPercent = getMetadataNumber(draft, "offerPercent");
    const params = {
      contactName: draft.targetName,
      organizationName: resolveOrganizationName(draft, snapshot),
      body: draft.draftMessage,
      daysSinceLastActivity: getMetadataNumber(draft, "daysSinceLastActivity"),
      historicalLTV: getMetadataNumber(draft, "historicalLTV") || draft.expectedImpact.amount,
      currency: draft.currency,
      offerPercent: offerPercent > 0 ? offerPercent : undefined,
      estimatedValue: draft.expectedImpact.amount,
    };

    return {
      html: buildReactivationEmailHtml(params),
      text: buildReactivationEmailText(params),
    };
  }

  return buildPaymentReminderPayload(draft, snapshot);
}

export async function buildSendDraftEmailResponse(
  input: SendDraftEmailRequest
): Promise<ApiEnvelope<CommunicationActionResult>> {
  const snapshot = await getPhaseOneSnapshotData();
  const draftId = String(input.draftId ?? "").trim();
  if (!draftId) {
    throw new HttpError(400, "Missing draftId");
  }

  const draft = mergeDraftOverrides(await getDraftOrThrow(draftId, input.invoiceId), input);
  ensureEmailEligibility(draft);

  if (!isEmailConfigured()) {
    throw new HttpError(503, "SMTP email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  }

  const contactEmail = getMetadataString(draft, "contactEmail");
  const recipientEmail = resolveDraftRecipient(draft);
  const { html, text } = buildDraftEmailPayload(draft, snapshot);

  const info = await sendWithSmtp(draft, recipientEmail, { html, text });
  logger.info("communications.email.sent", {
    draftId,
    contactEmail,
    recipientEmail,
    messageId: info.messageId
  });

  trackFollowUp(draft, "email");
  logDraftCommunication(draft, {
    eventType: "email_sent",
    title: draft.type === "reengagement_quote" ? "Win-back email sent" : "Reminder email sent",
    detail: `Delivered to ${recipientEmail}`,
    channel: "email",
    providerId: info.messageId,
    metadata: {
      recipientEmail,
      subjectLine: draft.subjectLine,
    },
  });

  const emailLabel =
    draft.type === "reengagement_quote" ? "Win-back email" : "Reminder email";

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
      message: env.COMMUNICATIONS_TEST_EMAIL.trim()
        ? `${emailLabel} sent to test inbox (${recipientEmail}).`
        : `${emailLabel} sent to ${recipientEmail}.`
    }
  };
}

export async function buildSendVoiceInviteResponse(
  input: SendVoiceInviteRequest
): Promise<ApiEnvelope<CommunicationActionResult>> {
  const snapshot = await getPhaseOneSnapshotData();
  const draftId = String(input.draftId ?? "").trim();
  if (!draftId) {
    throw new HttpError(400, "Missing draftId");
  }

  const stored = await getDraftOrThrow(draftId, input.invoiceId);
  ensureVoiceInviteEligibility(stored);

  if (!isEmailConfigured()) {
    throw new HttpError(503, "SMTP email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  }

  if (!isBrowserVoiceConfigured()) {
    throw new HttpError(
      503,
      "Browser voice is not configured. Set GEMINI_API_KEY, AI_API_KEY, or VAPI_PUBLIC_KEY + VAPI_ASSISTANT_ID."
    );
  }

  const contactEmail = getMetadataString(stored, "contactEmail");
  const recipientEmail = resolveDraftRecipient(stored);

  const token = createVoiceSessionFromDraft(stored);
  const callUrl = buildCallUrl(token);
  const outboundDraft = mergeDraftOverrides(stored, {
    subjectLine: input.subjectLine,
    draftMessage: input.draftMessage,
  });

  let html: string;
  let text: string;

  if (stored.type === "reengagement_quote") {
    const daysSinceLastActivity = getMetadataNumber(stored, "daysSinceLastActivity");
    const historicalLTV = getMetadataNumber(stored, "historicalLTV");
    const amountLabel = `${stored.currency} ${historicalLTV.toFixed(2)}`;
    const subjectLine =
      input.subjectLine?.trim() ||
      `Let's reconnect, ${stored.targetName}`;
    const draftMessage =
      input.draftMessage?.trim() ||
      `It's been ${daysSinceLastActivity} days since we last worked together. Click below to speak with our reactivation agent at a time that suits you.`;

    outboundDraft.subjectLine = subjectLine;
    outboundDraft.draftMessage = draftMessage;

    html = buildReactivationVoiceInviteHtml({
      contactName: stored.targetName,
      daysSinceLastActivity,
      amountLabel,
      callUrl,
      message: draftMessage,
    });
    text = buildReactivationVoiceInviteText({
      contactName: stored.targetName,
      daysSinceLastActivity,
      amountLabel,
      callUrl,
      message: draftMessage,
    });
  } else {
    const daysOverdue = getMetadataNumber(stored, "daysOverdue");
    const invoiceNumber = getMetadataString(stored, "invoiceNumber") ?? "outstanding invoice";
    const amountLabel = `${stored.currency} ${resolveLatePaymentBalance(stored).toFixed(2)}`;
    const subjectLine =
      input.subjectLine?.trim() ||
      `Let's resolve ${invoiceNumber}: speak with our agent`;
    const draftMessage =
      input.draftMessage?.trim() ||
      `Invoice ${invoiceNumber} is ${daysOverdue} days overdue. The current estimated UK late-payment balance is ${amountLabel}. Click below to speak with our collections agent at a time that suits you.`;

    outboundDraft.subjectLine = subjectLine;
    outboundDraft.draftMessage = draftMessage;

    html = buildVoiceInviteHtml({
      contactName: stored.targetName,
      invoiceNumber,
      daysOverdue,
      amountLabel,
      callUrl,
      message: draftMessage,
    });
    text = buildVoiceInviteText({
      contactName: stored.targetName,
      invoiceNumber,
      daysOverdue,
      amountLabel,
      callUrl,
      message: draftMessage,
    });
  }

  const info = await sendWithSmtp(outboundDraft, recipientEmail, { html, text });

  logger.info("communications.voice_invite.sent", {
    draftId,
    contactEmail,
    recipientEmail,
    callUrl,
    messageId: info.messageId
  });

  trackFollowUp(stored, "call");
  logDraftCommunication(stored, {
    eventType: "voice_invite_sent",
    title: stored.type === "reengagement_quote" ? "Reactivation voice invite sent" : "Collections voice invite sent",
    detail: `Delivered to ${recipientEmail}`,
    channel: "voice_invite",
    providerId: info.messageId,
    metadata: {
      recipientEmail,
      subjectLine: outboundDraft.subjectLine,
      callUrl,
    },
  });

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      draftId,
      channel: "voice_invite",
      status: "sent",
      recipientName: stored.targetName,
      recipientEmail,
      providerId: info.messageId,
      callUrl,
      callToken: token,
      message: env.COMMUNICATIONS_TEST_EMAIL.trim()
        ? `Voice invite sent to test inbox (${recipientEmail}).`
        : `Voice invite sent to ${recipientEmail}.`
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

  const draft = await getDraftOrThrow(draftId);
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

  trackFollowUp(draft, "call");
  logDraftCommunication(draft, {
    eventType: "call_queued",
    title: "Reminder call queued",
    detail: `Queued to ${recipientPhone}`,
    channel: "call",
    providerId: result.sid,
    metadata: {
      recipientPhone,
      scriptPreview: script,
    },
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

export async function buildCreateVoiceSessionResponse(draftId: string, invoiceId?: string) {
  const snapshot = await getPhaseOneSnapshotData();
  const id = String(draftId ?? "").trim();
  if (!id) {
    throw new HttpError(400, "Missing draftId");
  }

  const draft = await getDraftOrThrow(id, invoiceId);
  ensureVoiceInviteEligibility(draft);

  if (!isBrowserVoiceConfigured()) {
    throw new HttpError(
      503,
      "Browser voice is not configured. Set GEMINI_API_KEY, AI_API_KEY, or VAPI_PUBLIC_KEY + VAPI_ASSISTANT_ID."
    );
  }

  const token = createVoiceSessionFromDraft(draft);
  const callUrl = buildCallUrl(token);
  logDraftCommunication(draft, {
    eventType: "call_started",
    title: "Browser voice call started",
    detail: `Interactive call launched for ${draft.targetName}`,
    channel: "call",
    metadata: {
      callUrl,
      token,
    },
  });

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      draftId: id,
      callToken: token,
      callUrl
    }
  };
}
