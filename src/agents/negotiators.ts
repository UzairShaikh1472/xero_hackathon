/**
 * Escalation message templates — static today.
 * Future: swap body generation for getAgentResponse() with grounded invoice facts.
 */

export type NegotiationKind =
  | "polite_email_reminder"
  | "call_scheduling_email"
  | "voice_agent_script";

export interface InvoiceNegotiationContext {
  contactName: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  daysOverdue: number;
  calendlyUrl?: string;
}

export interface NegotiationMessage {
  subject?: string;
  body: string;
}

const DEFAULT_CALENDLY = "https://calendly.com/upflow-ar-recovery/15min";

function formatAmount(amountDue: number, currency: string): string {
  return amountDue.toLocaleString("en-GB", {
    style: "currency",
    currency,
  });
}

function politeEmailReminder(ctx: InvoiceNegotiationContext): NegotiationMessage {
  const formattedAmount = formatAmount(ctx.amountDue, ctx.currency);
  const dayLabel = ctx.daysOverdue === 1 ? "day" : "days";

  return {
    subject: `Friendly reminder: Invoice ${ctx.invoiceNumber} — ${formattedAmount} outstanding`,
    body: `Hi ${ctx.contactName},

I hope you're well. I'm writing regarding invoice ${ctx.invoiceNumber} for ${formattedAmount}, which is now ${ctx.daysOverdue} ${dayLabel} past due.

Could you let us know when we might expect payment, or if there's anything we can help clarify?

Thank you for your continued business.

Best regards,
Accounts Receivable Team`,
  };
}

function callSchedulingEmail(ctx: InvoiceNegotiationContext): NegotiationMessage {
  const formattedAmount = formatAmount(ctx.amountDue, ctx.currency);
  const calendlyUrl = ctx.calendlyUrl ?? DEFAULT_CALENDLY;

  return {
    subject: `Action required: Invoice ${ctx.invoiceNumber} — let's schedule a call`,
    body: `Hi ${ctx.contactName},

Invoice ${ctx.invoiceNumber} for ${formattedAmount} is now ${ctx.daysOverdue} days overdue. We'd like to resolve this promptly and understand if anything is blocking payment.

Please book a 15-minute call at your earliest convenience:

${calendlyUrl}

If you've already sent payment, please reply with remittance details and we'll close this out.

Best regards,
Accounts Receivable Team`,
  };
}

function voiceAgentScript(ctx: InvoiceNegotiationContext): NegotiationMessage {
  const formattedAmount = formatAmount(ctx.amountDue, ctx.currency);

  return {
    body: `Hi ${ctx.contactName}, this is the accounts team calling about invoice ${ctx.invoiceNumber} for ${formattedAmount}, which is ${ctx.daysOverdue} days overdue.

We need to get this resolved this week. Can you confirm when payment will be made, or if there's a dispute we should know about?

If we don't hear back, we'll have to escalate this further. What's the earliest date you can settle this balance?`,
  };
}

export function getNegotiationMessage(
  kind: NegotiationKind,
  ctx: InvoiceNegotiationContext,
): NegotiationMessage {
  switch (kind) {
    case "polite_email_reminder":
      return politeEmailReminder(ctx);
    case "call_scheduling_email":
      return callSchedulingEmail(ctx);
    case "voice_agent_script":
      return voiceAgentScript(ctx);
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unknown negotiation kind: ${_exhaustive}`);
    }
  }
}
