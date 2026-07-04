import type { NegotiationDraft, PayablePressure } from "../types/financial.js";
import { composeNegotiationDraft } from "./compose.js";
import { payablesUserPrompt } from "./prompts.js";
import { payablesReason } from "./reasons.js";

export async function draftPayablesNegotiation(
  pressure: PayablePressure,
): Promise<NegotiationDraft> {
  return composeNegotiationDraft(payablesUserPrompt(pressure), {
    targetType: "payable",
    contactName: pressure.contactName,
    urgency: pressure.urgency,
    proposedAction: pressure.recommendedAction,
    expectedCashImpact: pressure.expectedCashImpact,
    reason: payablesReason(pressure),
  });
}
