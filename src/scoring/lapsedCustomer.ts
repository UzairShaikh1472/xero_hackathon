/**
 * Lapsed customer score — higher = stronger re-engagement target.
 * lapsed_score = (historical_ltv * days_since_last_activity) / 10000
 *
 * Pure formula — no LLM.
 */
export function lapsedCustomerScore(
  historicalLtv: number,
  daysSinceLastActivity: number,
): number {
  const days = Math.max(0, daysSinceLastActivity);
  const ltv = Math.max(0, historicalLtv);
  return (ltv * days) / 10000;
}
