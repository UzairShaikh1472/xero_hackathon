import type { ApiEnvelope, InvoiceRisk, InvoiceRiskSnapshot } from "../domain/types.js";
import { estimateRecovery } from "../../engines/recovery.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";
import { calculateUkLatePaymentEstimate } from "./uk-late-payment-service.js";

function buildRiskScore(daysOverdue: number, amountDue: number) {
  const overdueWeight = Math.min(50, daysOverdue * 4);
  const amountWeight = Math.min(50, Math.round(amountDue / 200));
  return Math.min(100, overdueWeight + amountWeight);
}

function buildPriority(riskScore: number): InvoiceRisk["priority"] {
  if (riskScore >= 75) {
    return "high";
  }
  if (riskScore >= 45) {
    return "medium";
  }
  return "low";
}

export async function buildInvoiceRiskResponse(): Promise<ApiEnvelope<InvoiceRiskSnapshot>> {
  const snapshot = await getPhaseOneSnapshotData();
  const currency = snapshot.sync.currency;

  const items = snapshot.invoices
    .filter(
      (invoice) =>
        invoice.direction === "receivable" &&
        invoice.isOutstanding &&
        (invoice.isOverdue || invoice.amountDue.amount >= 2500)
    )
    .map((invoice) => {
      const riskScore = buildRiskScore(invoice.daysOverdue, invoice.amountDue.amount);
      const priority = buildPriority(riskScore);
      const recovery = estimateRecovery(invoice.amountDue.amount, invoice.daysOverdue);
      const latePaymentEstimate = calculateUkLatePaymentEstimate(
        invoice.amountDue.amount,
        invoice.daysOverdue,
      );

      const item: InvoiceRisk = {
        id: `risk_${invoice.id}`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        contactId: invoice.contactId,
        contactName: invoice.contactName,
        amountDue: invoice.amountDue,
        daysOverdue: invoice.daysOverdue,
        priority,
        riskScore,
        reason:
          invoice.daysOverdue > 0
            ? `${invoice.contactName} is ${invoice.daysOverdue} days overdue on ${invoice.invoiceNumber}.`
            : `${invoice.invoiceNumber} has a high outstanding value and should be watched closely.`,
        recommendedAction:
          priority === "high"
            ? "Draft an urgent collection message and route for same-day follow-up."
            : "Prepare a polite follow-up and monitor payment timing.",
        recoveryProbability: recovery.recoveryProbability,
        expectedDaysToCollect: recovery.expectedDaysToCollect,
        expectedRecovery: { amount: recovery.expectedRecovery, currency },
        statutoryInterest: {
          amount: latePaymentEstimate.statutoryInterest,
          currency,
        },
        fixedCompensation: {
          amount: latePaymentEstimate.fixedCompensation,
          currency,
        },
        overdueBalanceWithCharges: {
          amount: latePaymentEstimate.updatedBalance,
          currency,
        },
        statutoryAnnualRatePercent: Number(
          (latePaymentEstimate.statutoryAnnualRate * 100).toFixed(2),
        ),
        statutoryBaseRatePercent: Number((latePaymentEstimate.baseRate * 100).toFixed(2)),
        latePaymentAssumptionNote: latePaymentEstimate.assumptionNote,
      };

      return item;
    })
    .sort((left, right) => right.riskScore - left.riskScore);

  // Only invoices that are actually overdue count toward recoverable cash —
  // the high-value-but-not-yet-due watchlist items aren't "recovery" targets.
  const totalRecoverableCash = Number(
    items
      .filter((item) => item.daysOverdue > 0)
      .reduce((sum, item) => sum + item.expectedRecovery.amount, 0)
      .toFixed(2)
  );

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      organizationName: snapshot.sync.organizationName ?? "Unknown Organization",
      currency,
      totalAtRisk: items.length,
      totalRecoverableCash: { amount: totalRecoverableCash, currency },
      items
    }
  };
}
