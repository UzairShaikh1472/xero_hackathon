import { addDays, daysBetween, toDateString } from "../lib/dates.js";
import {
  liquidityPriorityScore,
  paymentReliabilityByContact,
} from "../scoring/index.js";
import type {
  CompanySnapshot,
  InvoiceRisk,
  NormalizedData,
  NormalizedInvoice,
  Urgency,
} from "../types/financial.js";

const RELIABLE_THRESHOLD = 80;
const EARLY_SETTLEMENT_RATE = 0.98;

export interface LiquidityAnalysis {
  snapshot: CompanySnapshot;
  atRiskInvoices: InvoiceRisk[];
}

export function analyzeLiquidity(data: NormalizedData): LiquidityAnalysis {
  const asOf = data.asOfDate;
  const horizon = toDateString(addDays(asOf, 30));

  const openReceivables = data.invoices.filter(
    (inv) => inv.type === "ACCREC" && inv.amountDue > 0,
  );
  const openPayables = data.invoices.filter(
    (inv) => inv.type === "ACCPAY" && inv.amountDue > 0,
  );

  const totalReceivables = sumAmountDue(openReceivables);
  const totalPayables = sumAmountDue(openPayables);

  const arDueIn30 = sumAmountDue(
    openReceivables.filter((inv) => inv.dueDate <= horizon),
  );
  const apDueIn30 = sumAmountDue(
    openPayables.filter((inv) => inv.dueDate <= horizon),
  );

  const dso =
    data.revenueLast90Days > 0
      ? (totalReceivables / data.revenueLast90Days) * 90
      : 0;
  const dpo =
    data.cogsLast90Days > 0
      ? (totalPayables / data.cogsLast90Days) * 90
      : 0;

  const snapshot: CompanySnapshot = {
    cash: data.cash,
    totalReceivables,
    totalPayables,
    workingCapital: data.cash + totalReceivables - totalPayables,
    dso,
    dpo,
    ccc: dso - dpo,
    projectedGap30Days: data.cash + arDueIn30 - apDueIn30,
  };

  const reliability = paymentReliabilityByContact(data.payments);

  const atRiskInvoices = openReceivables
    .map((inv) => toInvoiceRisk(inv, asOf, reliability.get(inv.contactId) ?? 50))
    .sort((a, b) => b.liquidityPriorityScore - a.liquidityPriorityScore);

  return { snapshot, atRiskInvoices };
}

function sumAmountDue(invoices: NormalizedInvoice[]): number {
  return invoices.reduce((sum, inv) => sum + inv.amountDue, 0);
}

function toInvoiceRisk(
  inv: NormalizedInvoice,
  asOf: string,
  paymentReliabilityScore: number,
): InvoiceRisk {
  const rawOverdue = daysBetween(inv.dueDate, asOf);
  const daysOverdue = Math.max(0, rawOverdue);
  const priority = liquidityPriorityScore(
    inv.amountDue,
    daysOverdue,
    paymentReliabilityScore,
  );

  const notYetDue = rawOverdue < 0;

  return {
    contactId: inv.contactId,
    contactName: inv.contactName,
    invoiceId: inv.invoiceId,
    amount: inv.amountDue,
    daysOverdue,
    paymentReliabilityScore,
    urgency: urgencyFromDaysOverdue(daysOverdue, notYetDue),
    recommendedAction: recommendedReceivableAction(
      daysOverdue,
      paymentReliabilityScore,
      notYetDue,
    ),
    expectedCashImpact: expectedCashImpact(
      inv.amountDue,
      paymentReliabilityScore,
    ),
    liquidityPriorityScore: priority,
  };
}

function urgencyFromDaysOverdue(
  daysOverdue: number,
  notYetDue: boolean,
): Urgency {
  if (notYetDue || daysOverdue === 0) return "low";
  if (daysOverdue >= 30) return "critical";
  if (daysOverdue >= 14) return "high";
  if (daysOverdue >= 7) return "medium";
  return "low";
}

function recommendedReceivableAction(
  daysOverdue: number,
  reliability: number,
  notYetDue: boolean,
): string {
  if (notYetDue) {
    return "Monitor — invoice not yet due";
  }
  // Due today (daysOverdue === 0) is payable now — not "not yet due".
  if (daysOverdue === 0) {
    if (reliability >= RELIABLE_THRESHOLD) {
      return "Offer 2% early settlement discount";
    }
    return "Send payment due notice";
  }
  if (reliability >= RELIABLE_THRESHOLD) {
    return "Offer 2% early settlement discount";
  }
  if (reliability < 40) {
    return "Escalate collection call";
  }
  return "Send payment reminder";
}

function expectedCashImpact(amount: number, reliability: number): number {
  if (reliability >= RELIABLE_THRESHOLD) {
    return amount * EARLY_SETTLEMENT_RATE;
  }
  return amount;
}
