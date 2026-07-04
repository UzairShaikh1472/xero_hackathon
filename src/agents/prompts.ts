import type {
  InvoiceRisk,
  LapsedCustomer,
  PayablePressure,
} from "../types/financial.js";

export const SYSTEM_PROMPT = `You are a drafting assistant for Xero Kinetic, a cash-flow tool for small businesses.

Rules (non-negotiable):
- You ONLY write a professional draftMessage from the FACTS block.
- Never invent amounts, contact names, invoice IDs, urgency levels, reliability scores, or cash impact.
- Never change the recommended action — phrase the message around it.
- Keep draftMessage concise, polite, and ready to send (email/body tone).
- confidenceLevel is your confidence in draft quality (0–1), not a financial risk score.
- Do NOT include a reason field — explanations are computed separately from scores.
- Respond with a single JSON object with exactly these keys: draftMessage (string), confidenceLevel (number 0–1).`;

export function receivablesUserPrompt(risk: InvoiceRisk): string {
  return `Draft a receivables negotiation message.

FACTS (use only these — do not invent anything else):
- Contact: ${risk.contactName}
- Invoice ID: ${risk.invoiceId}
- Amount due: £${risk.amount.toFixed(2)}
- Days overdue: ${risk.daysOverdue}
- Payment reliability score: ${risk.paymentReliabilityScore.toFixed(0)}/100
- Urgency: ${risk.urgency}
- Recommended action: ${risk.recommendedAction}
- Expected cash impact: £${risk.expectedCashImpact.toFixed(2)}
- Liquidity priority score: ${risk.liquidityPriorityScore.toFixed(2)}

Write draftMessage offering or following the recommended action.`;
}

export function payablesUserPrompt(pressure: PayablePressure): string {
  return `Draft a payables extension / supplier negotiation message.

FACTS (use only these — do not invent anything else):
- Supplier: ${pressure.contactName}
- Invoice ID: ${pressure.invoiceId}
- Amount due: £${pressure.amount.toFixed(2)}
- Days overdue: ${pressure.daysOverdue}
- Urgency: ${pressure.urgency}
- Recommended action: ${pressure.recommendedAction}
- Expected cash impact (cash preserved by delaying): £${pressure.expectedCashImpact.toFixed(2)}

Write draftMessage requesting the recommended action.`;
}

export function reengagementUserPrompt(customer: LapsedCustomer): string {
  return `Draft a lapsed-customer re-engagement / win-back message.

FACTS (use only these — do not invent anything else):
- Contact: ${customer.contactName}
- Last invoice date: ${customer.lastInvoiceDate}
- Days since last activity: ${customer.daysSinceLastActivity}
- Historical LTV: £${customer.historicalLTV.toFixed(2)}
- Lapsed score: ${customer.lapsedScore.toFixed(2)}
- Recommended action: ${customer.recommendedAction}

Write draftMessage following the recommended action (e.g. re-engagement quote).`;
}
