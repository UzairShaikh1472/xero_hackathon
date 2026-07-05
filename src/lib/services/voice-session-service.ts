import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { env } from "../config/env.js";
import { getDataFilePath } from "../utils/data-dir.js";
import { buildVoiceCollectionSystemPrompt } from "../../agents/voiceCollectionPrompt.js";
import { buildVoiceReengagementSystemPrompt } from "../../agents/voiceReengagementPrompt.js";
import type { NegotiationDraft, VoiceSessionContext } from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type StoredVoiceSession = {
  draftId: string;
  draftType?: NegotiationDraft["type"];
  contactName: string;
  invoiceNumber: string;
  amountDue: number;
  principalAmount?: number;
  statutoryInterest?: number;
  fixedCompensation?: number;
  overdueBalanceWithCharges?: number;
  statutoryAnnualRatePercent?: number;
  currency: string;
  daysOverdue: number;
  daysSinceLastActivity?: number;
  historicalLTV?: number;
  discountPercent?: number;
  offerPercent?: number;
  expiresAt: number;
};

const sessionFilePath = getDataFilePath("voice-sessions.json");

const sessions = new Map<string, StoredVoiceSession>();

function loadSessions(): Map<string, StoredVoiceSession> {
  const loaded = new Map<string, StoredVoiceSession>();
  try {
    if (!fs.existsSync(sessionFilePath)) {
      return loaded;
    }

    const payload = JSON.parse(fs.readFileSync(sessionFilePath, "utf8")) as Record<
      string,
      StoredVoiceSession
    >;
    const now = Date.now();
    for (const [token, session] of Object.entries(payload)) {
      if (session.expiresAt >= now) {
        loaded.set(token, session);
      }
    }
  } catch {
    // Ignore corrupt or unreadable session files.
  }
  return loaded;
}

function persistSessions() {
  fs.mkdirSync(path.dirname(sessionFilePath), { recursive: true });
  fs.writeFileSync(
    sessionFilePath,
    JSON.stringify(Object.fromEntries(sessions.entries()), null, 2)
  );
}

for (const [token, session] of loadSessions()) {
  sessions.set(token, session);
}

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
  const daysSinceLastActivity = getMetadataNumber(draft, "daysSinceLastActivity") || undefined;
  const historicalLTV = getMetadataNumber(draft, "historicalLTV") || undefined;
  const offerPercent = getMetadataNumber(draft, "offerPercent") || undefined;

  sessions.set(token, {
    draftId: draft.id,
    draftType: draft.type,
    contactName: draft.targetName,
    invoiceNumber:
      draft.type === "reengagement_quote"
        ? "reactivation"
        : getMetadataString(draft, "invoiceNumber") ?? "outstanding invoice",
    amountDue:
      draft.type === "reengagement_quote"
        ? draft.expectedImpact.amount
        : getMetadataNumber(draft, "statutoryTotalAmountDue") || draft.expectedImpact.amount,
    principalAmount: getMetadataNumber(draft, "principalAmount") || undefined,
    statutoryInterest: getMetadataNumber(draft, "statutoryInterest") || undefined,
    fixedCompensation: getMetadataNumber(draft, "fixedCompensation") || undefined,
    overdueBalanceWithCharges:
      getMetadataNumber(draft, "statutoryTotalAmountDue") || undefined,
    statutoryAnnualRatePercent:
      getMetadataNumber(draft, "statutoryAnnualRatePercent") || undefined,
    currency: draft.currency,
    daysOverdue: draft.type === "reengagement_quote" ? daysSinceLastActivity ?? 0 : daysOverdue,
    daysSinceLastActivity,
    historicalLTV,
    discountPercent,
    offerPercent,
    expiresAt: Date.now() + SESSION_TTL_MS
  });

  persistSessions();
  return token;
}

function getSessionOrThrow(token: string): StoredVoiceSession {
  const session = sessions.get(token);
  if (!session) {
    throw new HttpError(404, "Call session not found or expired.");
  }
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    persistSessions();
    throw new HttpError(410, "Call session expired. Request a new voice invite.");
  }
  return session;
}

export function buildVoiceSessionContext(token: string): VoiceSessionContext {
  const session = getSessionOrThrow(token);
  const systemPrompt =
    session.draftType === "reengagement_quote"
      ? buildVoiceReengagementSystemPrompt({
          contactName: session.contactName,
          daysSinceLastActivity:
            session.daysSinceLastActivity ?? session.daysOverdue,
          historicalLTV: session.historicalLTV ?? session.amountDue,
          currency: session.currency,
          offerPercent: session.offerPercent,
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
          discountPercent: session.discountPercent,
        });

  return {
    token,
    draftId: session.draftId,
    draftType: session.draftType,
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
    daysSinceLastActivity: session.daysSinceLastActivity,
    discountPercent: session.discountPercent,
    offerPercent: session.offerPercent,
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
