import type { InvoiceRisk, NegotiationDraft } from "../types/financial.js";
import { composeNegotiationDraft } from "./compose.js";
import { receivablesUserPrompt } from "./prompts.js";
import { receivablesReason } from "./reasons.js";

export async function draftReceivablesNegotiation(
  risk: InvoiceRisk,
): Promise<NegotiationDraft> {
  return composeNegotiationDraft(receivablesUserPrompt(risk), {
    targetType: "receivable",
    contactName: risk.contactName,
    urgency: risk.urgency,
    proposedAction: risk.recommendedAction,
    expectedCashImpact: risk.expectedCashImpact,
    reason: receivablesReason(risk),
  });
}
