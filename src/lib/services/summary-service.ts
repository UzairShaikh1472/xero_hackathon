import type { ApiEnvelope, CompanySnapshot } from "../domain/types.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";

export async function buildSummaryResponse(): Promise<ApiEnvelope<CompanySnapshot>> {
  const snapshot = await getPhaseOneSnapshotData();
  const currency = snapshot.sync.currency;
  const receivableInvoices = snapshot.invoices.filter((invoice) => invoice.direction === "receivable");
  const openInvoices = receivableInvoices.filter((invoice) => invoice.isOutstanding);
  const totalOutstanding = openInvoices.reduce((sum, invoice) => sum + invoice.amountDue.amount, 0);
  const overdueInvoices = openInvoices.filter((invoice) => invoice.isOverdue);
  const overdueReceivables = overdueInvoices.reduce((sum, invoice) => sum + invoice.amountDue.amount, 0);
  const averageInvoiceValue =
    openInvoices.length > 0 ? Number((totalOutstanding / openInvoices.length).toFixed(2)) : 0;
  const atRiskInvoicesCount = openInvoices.filter(
    (invoice) => invoice.isOverdue || invoice.amountDue.amount >= 5000
  ).length;

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      organizationName: snapshot.sync.organizationName ?? "Unknown Organization",
      currency,
      totalInvoices: receivableInvoices.length,
      contactsCount: snapshot.contacts.length,
      totalOutstandingReceivables: {
        amount: totalOutstanding,
        currency
      },
      overdueReceivables: {
        amount: overdueReceivables,
        currency
      },
      averageInvoiceValue: {
        amount: averageInvoiceValue,
        currency
      },
      overdueInvoicesCount: overdueInvoices.length,
      atRiskInvoicesCount,
      suggestedActionsCount: atRiskInvoicesCount
    }
  };
}
