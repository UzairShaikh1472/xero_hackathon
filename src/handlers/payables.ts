import { daysBetween } from "../lib/dates.js";
import type {
  NormalizedData,
  NormalizedInvoice,
  PayablePressure,
  Urgency,
} from "../types/financial.js";

export function toPayablePressure(
  inv: NormalizedInvoice,
  asOf: string,
): PayablePressure {
  const daysOverdue = Math.max(0, daysBetween(inv.dueDate, asOf));
  return {
    contactId: inv.contactId,
    contactName: inv.contactName,
    invoiceId: inv.invoiceId,
    amount: inv.amountDue,
    daysOverdue,
    urgency: payableUrgency(daysOverdue, daysBetween(asOf, inv.dueDate)),
    recommendedAction: "Request 14-day payment extension",
    expectedCashImpact: inv.amountDue,
  };
}

export function openPayables(data: NormalizedData): PayablePressure[] {
  return data.invoices
    .filter((inv) => inv.type === "ACCPAY" && inv.amountDue > 0)
    .map((inv) => toPayablePressure(inv, data.asOfDate));
}

function payableUrgency(daysOverdue: number, daysUntilDue: number): Urgency {
  if (daysOverdue >= 14) return "critical";
  if (daysOverdue > 0) return "high";
  if (daysUntilDue <= 7) return "medium";
  return "low";
}

export function isPayablePressure(value: unknown): value is PayablePressure {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.contactId === "string" &&
    typeof v.contactName === "string" &&
    typeof v.invoiceId === "string" &&
    typeof v.amount === "number" &&
    typeof v.daysOverdue === "number" &&
    typeof v.urgency === "string" &&
    typeof v.recommendedAction === "string" &&
    typeof v.expectedCashImpact === "number"
  );
}
