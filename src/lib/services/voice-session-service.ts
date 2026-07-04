import { randomBytes } from "node:crypto";

import { env } from "../config/env.js";
import { buildVoiceCollectionSystemPrompt } from "../../agents/voiceCollectionPrompt.js";
import type { NegotiationDraft, VoiceSessionContext } from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type StoredVoiceSession = {
  draftId: string;
  contactName: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  daysOverdue: number;
  discountPercent?: number;
  expiresAt: number;
};

const sessions = new Map<string, StoredVoiceSession>();

function getMetadataNumber(draft: NegotiationDraft, field: string) {
  const value = draft.metadata[field];
  return typeof value === "number" ? value : 0;
}

function getMetadataString(draft: NegotiationDraft, field: string) {
  const value = draft.metadata[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function createVoiceSessionFromDraft(draft: NegotiationDraft) {
  const token = randomBytes(24).toString("hex");
  const daysOverdue = getMetadataNumber(draft, "daysOverdue");
  const discountPercent = getMetadataNumber(draft, "discountPercent") || undefined;

  sessions.set(token, {
    draftId: draft.id,
    contactName: draft.targetName,
    invoiceNumber: getMetadataString(draft, "invoiceNumber") ?? "outstanding invoice",
    amountDue: draft.expectedImpact.amount,
    currency: draft.currency,
    daysOverdue,
    discountPercent,
    expiresAt: Date.now() + SESSION_TTL_MS
  });

  return token;
}

function getSessionOrThrow(token: string): StoredVoiceSession {
  const session = sessions.get(token);
  if (!session) {
    throw new HttpError(404, "Call session not found or expired.");
  }
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    throw new HttpError(410, "Call session expired. Request a new voice invite.");
  }
  return session;
}

export function buildVoiceSessionContext(token: string): VoiceSessionContext {
  const session = getSessionOrThrow(token);
  const systemPrompt = buildVoiceCollectionSystemPrompt({
    contactName: session.contactName,
    invoiceNumber: session.invoiceNumber,
    amountDue: session.amountDue,
    currency: session.currency,
    daysOverdue: session.daysOverdue,
    discountPercent: session.discountPercent
  });

  return {
    token,
    draftId: session.draftId,
    contactName: session.contactName,
    invoiceNumber: session.invoiceNumber,
    amountDue: session.amountDue,
    currency: session.currency,
    daysOverdue: session.daysOverdue,
    discountPercent: session.discountPercent,
    expiresAt: new Date(session.expiresAt).toISOString(),
    vapiPublicKey: env.VAPI_PUBLIC_KEY || undefined,
    vapiAssistantId: env.VAPI_ASSISTANT_ID || undefined,
    systemPrompt
  };
}

export function getVoiceSessionForChat(token: string) {
  return getSessionOrThrow(token);
}

export function buildCallUrl(token: string) {
  return `${env.FRONTEND_APP_URL.replace(/\/$/, "")}/call/${token}`;
}
