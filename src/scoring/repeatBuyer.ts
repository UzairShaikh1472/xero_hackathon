/**
 * Repeat buyer score — higher = stronger upsell / retention target.
 * repeat_score = transaction_count * average_invoice_size * recency_weight
 *
 * Pure formula — no LLM.
 *
 * recency_weight defaults to a decay based on days since last invoice:
 * weight = max(0.1, 1 - days_since_last / 365)
 */
export function recencyWeight(daysSinceLastActivity: number): number {
  const days = Math.max(0, daysSinceLastActivity);
  return Math.max(0.1, 1 - days / 365);
}

export function repeatBuyerScore(
  transactionCount: number,
  averageInvoiceSize: number,
  daysSinceLastActivity: number,
): number {
  const count = Math.max(0, transactionCount);
  const avg = Math.max(0, averageInvoiceSize);
  return count * avg * recencyWeight(daysSinceLastActivity);
}
