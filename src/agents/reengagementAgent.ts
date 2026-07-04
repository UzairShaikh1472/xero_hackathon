import type { LapsedCustomer, NegotiationDraft } from "../types/financial.js";
import { reactivationChannel } from "../engines/revenue.js";
import { composeNegotiationDraft } from "./compose.js";
import { reengagementUserPrompt } from "./prompts.js";
import { reengagementReason } from "./reasons.js";

export async function draftReengagementQuote(
  customer: LapsedCustomer,
): Promise<NegotiationDraft> {
  const channel = reactivationChannel(customer.daysSinceLastActivity);
  return composeNegotiationDraft(reengagementUserPrompt(customer, channel), {
    targetType: "lapsed_customer",
    contactName: customer.contactName,
    urgency: urgencyFromDaysInactive(customer.daysSinceLastActivity),
    proposedAction: customer.recommendedAction,
    expectedCashImpact: customer.historicalLTV,
    reason: reengagementReason(customer),
  });
}

function urgencyFromDaysInactive(days: number): NegotiationDraft["urgency"] {
  if (days >= 180) return "critical";
  if (days >= 120) return "high";
  if (days >= 90) return "medium";
  return "low";
}
