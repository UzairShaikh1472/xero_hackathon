import type {
  InvoiceRisk,
  LapsedCustomer,
  PayablePressure,
} from "../types/financial.js";

/** Format £ amounts for "Why this action?" strings (guide style). */
function gbp(amount: number): string {
  return `£${amount.toLocaleString("en-GB", {
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Deterministic "Why this action?" for receivables.
 * Example: £8,000 overdue 12 days; reliability 92%; priority score 4.8
 */
export function receivablesReason(risk: InvoiceRisk): string {
  const overdue =
    risk.daysOverdue === 0
      ? "due today"
      : `overdue ${risk.daysOverdue} days`;
  return `${gbp(risk.amount)} ${overdue}; reliability ${risk.paymentReliabilityScore.toFixed(0)}%; priority score ${risk.liquidityPriorityScore.toFixed(1)}`;
}

/**
 * Deterministic "Why this action?" for payables.
 * Example: £9,800 payable; 0 days overdue; extension preserves £9,800
 */
export function payablesReason(pressure: PayablePressure): string {
  const overdue =
    pressure.daysOverdue === 0
      ? "not yet overdue"
      : `${pressure.daysOverdue} days overdue`;
  return `${gbp(pressure.amount)} payable; ${overdue}; extension preserves ${gbp(pressure.expectedCashImpact)}`;
}

/**
 * Deterministic "Why this action?" for lapsed customers.
 * Example: £14,000 LTV; 197 days inactive; lapsed score 275.8
 */
export function reengagementReason(customer: LapsedCustomer): string {
  return `${gbp(customer.historicalLTV)} LTV; ${customer.daysSinceLastActivity} days inactive; lapsed score ${customer.lapsedScore.toFixed(1)}`;
}
