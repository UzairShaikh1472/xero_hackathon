import type { NormalizedPayment } from "../types/financial.js";

/**
 * Payment reliability score (0–100).
 * reliability = (on_time_payments / total_payments) * 100
 *
 * Pure formula — no LLM.
 */
export function paymentReliabilityScore(
  payments: NormalizedPayment[],
): number {
  if (payments.length === 0) {
    return 50; // neutral default when no history
  }

  const onTime = payments.filter((p) => p.onTime).length;
  return (onTime / payments.length) * 100;
}

export function paymentReliabilityByContact(
  payments: NormalizedPayment[],
): Map<string, number> {
  const byContact = new Map<string, NormalizedPayment[]>();

  for (const payment of payments) {
    const list = byContact.get(payment.contactId) ?? [];
    list.push(payment);
    byContact.set(payment.contactId, list);
  }

  const scores = new Map<string, number>();
  for (const [contactId, contactPayments] of byContact) {
    scores.set(contactId, paymentReliabilityScore(contactPayments));
  }
  return scores;
}
