import { REACTIVATION_VOICE_THRESHOLD_DAYS } from "../../engines/revenue.js";
import type { ActivityLogStep, NegotiationDraft } from "../domain/types.js";

function getMetadataNumber(draft: NegotiationDraft, field: string) {
  const value = draft.metadata[field];
  return typeof value === "number" ? value : 0;
}

function getMetadataString(draft: NegotiationDraft, field: string) {
  const value = draft.metadata[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function deriveDraftLogStep(draft: NegotiationDraft): ActivityLogStep {
  if (draft.type === "payables_extension") {
    return "human_call";
  }

  if (draft.type === "reengagement_quote") {
    const daysSilent = getMetadataNumber(draft, "daysSinceLastActivity");
    return daysSilent >= REACTIVATION_VOICE_THRESHOLD_DAYS ? "agent_call" : "email";
  }

  const daysOverdue = getMetadataNumber(draft, "daysOverdue");
  return daysOverdue >= 14 ? "agent_call" : "email";
}

export function getDraftInvoiceId(draft: NegotiationDraft) {
  return draft.type === "receivables_discount" ? draft.targetId : draft.id;
}

export function getDraftInvoiceNumber(draft: NegotiationDraft) {
  return (
    getMetadataString(draft, "invoiceNumber") ??
    (draft.type === "reengagement_quote" ? "reactivation" : draft.targetId)
  );
}

