/**
 * Liquidity priority score — higher = chase first.
 * priority = (invoice_amount * days_overdue * (1 - reliability_score / 100)) / 1000
 *
 * Pure formula — no LLM.
 *
 * reliabilityScore is 0–100. Low reliability increases priority.
 */
export function liquidityPriorityScore(
  invoiceAmount: number,
  daysOverdue: number,
  reliabilityScore: number,
): number {
  const overdue = Math.max(0, daysOverdue);
  // Floor at 0.1 so large overdue invoices still surface even for reliable payers
  // (demo: Aurora is reliable but still the best cash-unlock target).
  const reliabilityFactor = Math.max(
    0.1,
    1 - clamp(reliabilityScore, 0, 100) / 100,
  );
  return (invoiceAmount * overdue * reliabilityFactor) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
