import type { ApiEnvelope, LiquiditySnapshot } from "../domain/types.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";

function daysBetween(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

export async function buildLiquidityResponse(): Promise<ApiEnvelope<LiquiditySnapshot>> {
  const snapshot = await getPhaseOneSnapshotData();
  const today = new Date();
  const currency = snapshot.sync.currency;
  const receivableInvoices = snapshot.invoices.filter((invoice) => invoice.direction === "receivable");
  const payableInvoices = snapshot.invoices.filter((invoice) => invoice.direction === "payable");
  const openReceivables = receivableInvoices.filter((invoice) => invoice.isOutstanding);
  const openPayables = payableInvoices.filter((invoice) => invoice.isOutstanding);

  const receivablesDue30d = openReceivables
    .filter((invoice) => {
      const dueDate = new Date(invoice.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        return false;
      }

      const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
      return daysUntilDue <= 30;
    })
    .reduce((sum, invoice) => sum + invoice.amountDue.amount, 0);

  const payablesDue30d = openPayables
    .filter((invoice) => {
      const dueDate = new Date(invoice.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        return false;
      }

      const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
      return daysUntilDue <= 30;
    })
    .reduce((sum, invoice) => sum + invoice.amountDue.amount, 0);

  const receivablesOverdue = openReceivables
    .filter((invoice) => invoice.isOverdue)
    .reduce((sum, invoice) => sum + invoice.amountDue.amount, 0);

  const invoiceAges = openReceivables.map((invoice) => daysBetween(invoice.issueDate, today.toISOString()));
  const dso =
    invoiceAges.length > 0
      ? Math.round(invoiceAges.reduce((sum, age) => sum + age, 0) / invoiceAges.length)
      : 0;

  const payableAges = openPayables.map((invoice) => daysBetween(invoice.issueDate, today.toISOString()));
  const dpo =
    payableAges.length > 0
      ? Math.round(payableAges.reduce((sum, age) => sum + age, 0) / payableAges.length)
      : 0;
  const ccc = dso - dpo;
  const projectedGap30d = Number((payablesDue30d - receivablesDue30d).toFixed(2));

  let status: LiquiditySnapshot["status"] = "healthy";
  if (receivablesOverdue > 0 || projectedGap30d > 0) {
    status = "watch";
  }
  if (receivablesOverdue >= 5000 || projectedGap30d >= 5000) {
    status = "critical";
  }

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      currency,
      currentCash: null,
      receivablesDue30d: {
        amount: Number(receivablesDue30d.toFixed(2)),
        currency
      },
      payablesDue30d: {
        amount: Number(payablesDue30d.toFixed(2)),
        currency
      },
      receivablesOverdue: {
        amount: Number(receivablesOverdue.toFixed(2)),
        currency
      },
      projectedGap30d: {
        amount: projectedGap30d,
        currency
      },
      dso,
      dpo,
      ccc,
      status
    }
  };
}
