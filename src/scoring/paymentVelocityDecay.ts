import type {
  NormalizedPayment,
  PaymentVelocitySignal,
} from "../types/financial.js";

/** Flag as "slowing down" when current pace is 1.5x historical. */
export const VELOCITY_DECAY_THRESHOLD = 1.5;

/**
 * Payment velocity decay — early churn indicator.
 * velocity_decay = current_avg_payment_days / historical_avg_payment_days
 *
 * Pure formula — no LLM.
 * If > 1.5, flag as "slowing down".
 *
 * Splits payments chronologically: older half = historical, newer half = current.
 */
export function paymentVelocityDecay(
  currentAvgPaymentDays: number,
  historicalAvgPaymentDays: number,
): number {
  if (historicalAvgPaymentDays <= 0) {
    return currentAvgPaymentDays > 0 ? Infinity : 1;
  }
  return currentAvgPaymentDays / historicalAvgPaymentDays;
}

export function isSlowingDown(velocityDecay: number): boolean {
  // Infinity means historical avg was <= 0 while current is positive — treat as slowing.
  // (Number.isFinite(Infinity) is false, so we must not require finite.)
  return velocityDecay > VELOCITY_DECAY_THRESHOLD;
}

export function averageDaysToPay(payments: NormalizedPayment[]): number {
  if (payments.length === 0) return 0;
  const total = payments.reduce((sum, p) => sum + p.daysToPay, 0);
  return total / payments.length;
}

/**
 * Compute velocity signal for a contact from their payment history.
 * Requires at least 2 payments to split historical vs current.
 */
export function paymentVelocityForContact(
  contactId: string,
  contactName: string,
  payments: NormalizedPayment[],
): PaymentVelocitySignal | null {
  if (payments.length < 2) return null;

  const sorted = [...payments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const midpoint = Math.floor(sorted.length / 2);
  const historical = sorted.slice(0, midpoint);
  const current = sorted.slice(midpoint);

  const historicalAvgPaymentDays = averageDaysToPay(historical);
  const currentAvgPaymentDays = averageDaysToPay(current);
  const velocityDecay = paymentVelocityDecay(
    currentAvgPaymentDays,
    historicalAvgPaymentDays,
  );

  return {
    contactId,
    contactName,
    velocityDecay,
    currentAvgPaymentDays,
    historicalAvgPaymentDays,
    isSlowingDown: isSlowingDown(velocityDecay),
  };
}
