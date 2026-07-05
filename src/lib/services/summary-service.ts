import type { ApiEnvelope, CompanySnapshot } from "../domain/types.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";
import { calculateUkLatePaymentEstimate } from "./uk-late-payment-service.js";

export async function buildSummaryResponse(): Promise<ApiEnvelope<CompanySnapshot>> {
  const snapshot = await getPhaseOneSnapshotData();
  const currency = snapshot.sync.currency;
  const receivableInvoices = snapshot.invoices.filter((invoice) => invoice.direction === "receivable");
  const openInvoices = receivableInvoices.filter((invoice) => invoice.isOutstanding);
  const totalOutstanding = openInvoices.reduce((sum, invoice) => sum + invoice.amountDue.amount, 0);
  const overdueInvoices = openInvoices.filter((invoice) => invoice.isOverdue);
  const overdueReceivables = overdueInvoices.reduce((sum, invoice) => sum + invoice.amountDue.amount, 0);
  const latePaymentEstimates = overdueInvoices.map((invoice) =>
    calculateUkLatePaymentEstimate(invoice.amountDue.amount, invoice.daysOverdue),
  );
  const statutoryInterestEstimate = Number(
    latePaymentEstimates.reduce((sum, item) => sum + item.statutoryInterest, 0).toFixed(2),
  );
  const fixedCompensationEstimate = Number(
    latePaymentEstimates.reduce((sum, item) => sum + item.fixedCompensation, 0).toFixed(2),
  );
  const overdueWithLatePaymentCharges = Number(
    latePaymentEstimates.reduce((sum, item) => sum + item.updatedBalance, 0).toFixed(2),
  );
  const averageInvoiceValue =
    openInvoices.length > 0 ? Number((totalOutstanding / openInvoices.length).toFixed(2)) : 0;
  const atRiskInvoicesCount = openInvoices.filter(
    (invoice) => invoice.isOverdue || invoice.amountDue.amount >= 5000
  ).length;
  const referenceRate = latePaymentEstimates[0];

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      organizationName: snapshot.sync.organizationName ?? "Unknown Organization",
      currency,
      lastSyncAt: snapshot.sync.lastSyncAt,
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
      statutoryInterestEstimate: {
        amount: statutoryInterestEstimate,
        currency,
      },
      fixedCompensationEstimate: {
        amount: fixedCompensationEstimate,
        currency,
      },
      overdueWithLatePaymentCharges: {
        amount: overdueWithLatePaymentCharges,
        currency,
      },
      statutoryAnnualRatePercent: Number(
        (((referenceRate?.statutoryAnnualRate ?? 0) * 100)).toFixed(2),
      ),
      statutoryBaseRatePercent: Number(
        (((referenceRate?.baseRate ?? 0) * 100)).toFixed(2),
      ),
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
