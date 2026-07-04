import type { ContactSummary, InvoiceSummary, Money } from "./types.js";

function money(amount: unknown, currency = "GBP"): Money {
  return {
    amount: Number(amount ?? 0),
    currency
  };
}

export function normalizeInvoice(raw: Record<string, unknown>): InvoiceSummary {
  const invoiceType = String(raw.Type ?? "UNKNOWN").toUpperCase() as
    | "ACCREC"
    | "ACCPAY"
    | "UNKNOWN";
  const status = String(raw.Status ?? "UNKNOWN").toUpperCase();
  const dueDate = String(raw.DueDateString ?? raw.DueDate ?? "");
  const amountDue = money(raw.AmountDue, String(raw.CurrencyCode ?? "GBP"));
  const today = new Date();
  const due = dueDate ? new Date(dueDate) : null;
  const direction =
    invoiceType === "ACCREC"
      ? "receivable"
      : invoiceType === "ACCPAY"
        ? "payable"
        : "unknown";
  const isOutstanding =
    amountDue.amount > 0 &&
    !["PAID", "DRAFT", "VOIDED", "DELETED"].includes(status);
  const daysOverdue =
    isOutstanding && due && !Number.isNaN(due.getTime())
      ? Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000))
      : 0;

  return {
    id: String(raw.InvoiceID ?? ""),
    contactId: String((raw.Contact as { ContactID?: string } | undefined)?.ContactID ?? ""),
    contactName: String((raw.Contact as { Name?: string } | undefined)?.Name ?? "Unknown"),
    invoiceNumber: String(raw.InvoiceNumber ?? ""),
    invoiceType,
    status,
    issueDate: String(raw.DateString ?? raw.Date ?? ""),
    dueDate,
    total: money(raw.Total, String(raw.CurrencyCode ?? "GBP")),
    amountDue,
    isOutstanding,
    direction,
    daysOverdue,
    isOverdue: daysOverdue > 0
  };
}

export function normalizeContact(raw: Record<string, unknown>): ContactSummary {
  return {
    id: String(raw.ContactID ?? ""),
    name: String(raw.Name ?? "Unknown"),
    email: raw.EmailAddress ? String(raw.EmailAddress) : undefined,
    totalInvoices: 0,
    totalPaid: money(0),
    averageInvoice: money(0),
    lastInvoiceDate: undefined,
    paymentReliability: undefined
  };
}
