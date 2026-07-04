import type { InvoiceRisk, NegotiationDraft } from "../types/financial.js";
import { composeNegotiationDraft } from "./compose.js";
import {
  receivablesUserPrompt,
  type ReceivablesPromptContext,
} from "./prompts.js";
import { receivablesReason } from "./reasons.js";

export async function draftReceivablesNegotiation(
  risk: InvoiceRisk,
  context?: ReceivablesPromptContext,
): Promise<NegotiationDraft> {
  const promptContext: ReceivablesPromptContext = {
    invoiceNumber: context?.invoiceNumber ?? risk.invoiceId,
    discountPercent: context?.discountPercent,
    discountedAmount: context?.discountedAmount,
    organizationName: context?.organizationName,
  };

  return composeNegotiationDraft(receivablesUserPrompt(risk, promptContext), {
    targetType: "receivable",
    contactName: risk.contactName,
    urgency: risk.urgency,
    proposedAction: risk.recommendedAction,
    expectedCashImpact: risk.expectedCashImpact,
    reason: receivablesReason(risk),
  });
}
