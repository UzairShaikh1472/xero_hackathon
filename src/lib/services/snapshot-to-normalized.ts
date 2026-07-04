import { getNormalizedData } from "../../handlers/data.js";
import type { PhaseOneSnapshot } from "../domain/types.js";
import type {
  InvoiceStatus,
  InvoiceType,
  NormalizedContact,
  NormalizedData,
  NormalizedInvoice
} from "../../types/financial.js";

const INVOICE_STATUSES = new Set<InvoiceStatus>([
  "DRAFT",
  "SUBMITTED",
  "AUTHORISED",
  "PAID",
  "VOIDED"
]);

/**
 * Adapt Person 1's live/fallback snapshot into Person 2's scoring input shape.
 * Payment history is not in phase-one sync yet, so reliability defaults apply.
 */
export function snapshotToNormalized(snapshot: PhaseOneSnapshot): NormalizedData {
  const asOfDate = new Date().toISOString().slice(0, 10);
  const invoices: NormalizedInvoice[] = snapshot.invoices
    .filter((invoice) => invoice.invoiceType === "ACCREC" || invoice.invoiceType === "ACCPAY")
    .map((invoice) => ({
      invoiceId: invoice.id,
      contactId: invoice.contactId,
      contactName: invoice.contactName,
      amount: invoice.total.amount,
      amountDue: invoice.amountDue.amount,
      dueDate: invoice.dueDate || asOfDate,
      date: invoice.issueDate || asOfDate,
      status: toInvoiceStatus(invoice.status),
      type: invoice.invoiceType as InvoiceType
    }));

  const contacts: NormalizedContact[] = snapshot.contacts.map((contact) => ({
    contactId: contact.id,
    contactName: contact.name,
    isCustomer: contact.totalInvoices > 0,
    isSupplier: invoices.some(
      (invoice) => invoice.contactId === contact.id && invoice.type === "ACCPAY"
    )
  }));

  const receivableTotals = invoices
    .filter((invoice) => invoice.type === "ACCREC")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const payableTotals = invoices
    .filter((invoice) => invoice.type === "ACCPAY")
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  return {
    // Phase-one sync has no bank balance yet; use demo fixture cash until Xero feeds land.
    cash: getNormalizedData().cash,
    asOfDate,
    invoices,
    contacts,
    payments: [],
    revenueLast90Days: receivableTotals || 1,
    cogsLast90Days: payableTotals || 1
  };
}

function toInvoiceStatus(status: string): InvoiceStatus {
  const upper = status.toUpperCase();
  if (INVOICE_STATUSES.has(upper as InvoiceStatus)) {
    return upper as InvoiceStatus;
  }
  return "AUTHORISED";
}
