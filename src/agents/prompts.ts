import type {
  InvoiceRisk,
  LapsedCustomer,
  PayablePressure,
} from "../types/financial.js";

export const SYSTEM_PROMPT = `You are a drafting assistant for Xero Kinetic, a cash-flow tool for small businesses.

Rules (non-negotiable):
- You ONLY write a professional draftMessage from the FACTS block.
- Never invent amounts, contact names, invoice numbers, urgency levels, reliability scores, or cash impact.
- Never change the recommended action. Phrase the message around it.
- Keep draftMessage concise, polite, and ready to send (email/body tone).
- Write body paragraphs ONLY: no greeting (Hi/Dear), no sign-off, no placeholders like [Your Name] or [Your Company].
- Never reference UUIDs or internal invoice IDs. Use the human-readable invoice number from FACTS.
- confidenceLevel is your confidence in draft quality (0–1), not a financial risk score.
- Do NOT include a reason field. Explanations are computed separately from scores.
- Respond with a single JSON object with exactly these keys: draftMessage (string), confidenceLevel (number 0–1).`;

export interface ReceivablesPromptContext {
  invoiceNumber: string;
  discountPercent?: number;
  discountedAmount?: number;
  organizationName?: string;
}

export function receivablesUserPrompt(
  risk: InvoiceRisk,
  context: ReceivablesPromptContext,
): string {
  const discountLine =
    context.discountPercent != null && context.discountedAmount != null
      ? `- Discount offer: ${context.discountPercent}% early settlement → £${context.discountedAmount.toFixed(2)} if paid within 7 days`
      : "";

  const orgLine = context.organizationName
    ? `- Sender organization: ${context.organizationName}`
    : "";

  return `Draft a receivables negotiation message.

FACTS (use only these; do not invent anything else):
- Contact: ${risk.contactName}
- Invoice number: ${context.invoiceNumber}
- Amount due: £${risk.amount.toFixed(2)}
- Days overdue: ${risk.daysOverdue}
- Payment reliability score: ${risk.paymentReliabilityScore.toFixed(0)}/100
- Urgency: ${risk.urgency}
- Recommended action: ${risk.recommendedAction}
- Expected cash impact: £${risk.expectedCashImpact.toFixed(2)}
- Liquidity priority score: ${risk.liquidityPriorityScore.toFixed(2)}
${discountLine}
${orgLine}

Write draftMessage (body paragraphs only: no greeting or sign-off) offering or following the recommended action.`;
}

export function payablesUserPrompt(pressure: PayablePressure): string {
  return `Draft a payables extension / supplier negotiation message.

FACTS (use only these; do not invent anything else):
- Supplier: ${pressure.contactName}
- Invoice ID: ${pressure.invoiceId}
- Amount due: £${pressure.amount.toFixed(2)}
- Days overdue: ${pressure.daysOverdue}
- Urgency: ${pressure.urgency}
- Recommended action: ${pressure.recommendedAction}
- Expected cash impact (cash preserved by delaying): £${pressure.expectedCashImpact.toFixed(2)}

Write draftMessage requesting the recommended action.`;
}

export function reengagementUserPrompt(
  customer: LapsedCustomer,
  channel: "email" | "voice_invite",
): string {
  const channelGuidance =
    channel === "voice_invite"
      ? "This customer has been inactive for a long time. Write a brief email body inviting them to speak with our voice agent via a call link — warm, not pushy."
      : "This customer was recently lapsed. Write a friendly win-back email with the returning-customer incentive — no call link needed.";

  return `Draft a lapsed-customer re-engagement / win-back message.

FACTS (use only these; do not invent anything else):
- Contact: ${customer.contactName}
- Last invoice date: ${customer.lastInvoiceDate}
- Days since last activity: ${customer.daysSinceLastActivity}
- Historical LTV: £${customer.historicalLTV.toFixed(2)}
- Lapsed score: ${customer.lapsedScore.toFixed(2)}
- Recommended action: ${customer.recommendedAction}
- Outreach channel: ${channel === "voice_invite" ? "voice agent invite email" : "direct win-back email"}

${channelGuidance}

Write draftMessage following the recommended action (e.g. re-engagement quote).`;
}
