import type { ApiEnvelope, InvoiceRisk, InvoiceRiskSnapshot } from "../domain/types.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";

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
    .filter((invoice) => invoice.isOutstanding && (invoice.isOverdue || invoice.amountDue.amount >= 2500))
    .map((invoice) => {
      const riskScore = buildRiskScore(invoice.daysOverdue, invoice.amountDue.amount);
      const priority = buildPriority(riskScore);

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
            : "Prepare a polite follow-up and monitor payment timing."
      };

      return item;
    })
    .sort((left, right) => right.riskScore - left.riskScore);

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      organizationName: snapshot.sync.organizationName ?? "Unknown Organization",
      currency,
      totalAtRisk: items.length,
      items
    }
  };
}
