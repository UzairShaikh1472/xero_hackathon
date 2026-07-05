/**
 * Expected Recovery = Invoice Amount × Recovery Probability × (1 − Time Discount)
 *
 * Recovery probability is anchored on commercial credit industry benchmarks
 * (Atradius / UK late-payment data): collectability decays as an invoice ages.
 * Time discount prices the cost of cash arriving later using the UK statutory
 * late-payment rate (Bank of England reference rate 3.75% + 8% = 11.75% APR).
 */

const RECOVERY_PROBABILITY_BUCKETS: Array<{ maxDays: number; probability: number }> = [
  { maxDays: 30, probability: 0.95 },
  { maxDays: 60, probability: 0.85 },
  { maxDays: 90, probability: 0.7 },
  { maxDays: 120, probability: 0.5 },
  { maxDays: Infinity, probability: 0.25 }
];

const EXPECTED_DAYS_TO_COLLECT_BUCKETS: Array<{ maxDays: number; days: number }> = [
  { maxDays: 30, days: 14 },
  { maxDays: 60, days: 21 },
  { maxDays: 90, days: 30 },
  { maxDays: Infinity, days: 45 }
];

/** UK statutory late payment rate: Bank of England reference rate (3.75%) + 8%. */
const UK_LATE_PAYMENT_APR = 0.1175;

export type PaymentHistoryTier =
  | "early_or_on_time"
  | "slightly_late"
  | "chronically_late"
  | "no_history";

const RELIABILITY_MULTIPLIER: Record<PaymentHistoryTier, number> = {
  early_or_on_time: 1.1,
  slightly_late: 1.0,
  chronically_late: 0.8,
  no_history: 0.9
};

function baseRecoveryProbability(daysOverdue: number): number {
  const days = Math.max(0, daysOverdue);
  const bucket = RECOVERY_PROBABILITY_BUCKETS.find((b) => days <= b.maxDays);
  return bucket ? bucket.probability : 0.25;
}

function expectedDaysToCollect(daysOverdue: number): number {
  const days = Math.max(0, daysOverdue);
  const bucket = EXPECTED_DAYS_TO_COLLECT_BUCKETS.find((b) => days <= b.maxDays);
  return bucket ? bucket.days : 45;
}

export interface RecoveryEstimate {
  /** 0–1, after the payment-history reliability adjustment, capped at 0.98. */
  recoveryProbability: number;
  expectedDaysToCollect: number;
  expectedRecovery: number;
}

/**
 * historyTier defaults to "no_history" because the live Xero sync doesn't fetch
 * Payments yet (would need the accounting.transactions scope) — every contact
 * is treated as unknown-reliability until that's wired in.
 */
export function estimateRecovery(
  amountDue: number,
  daysOverdue: number,
  historyTier: PaymentHistoryTier = "no_history"
): RecoveryEstimate {
  const base = baseRecoveryProbability(daysOverdue);
  const multiplier = RELIABILITY_MULTIPLIER[historyTier];
  const recoveryProbability = Math.min(0.98, base * multiplier);

  const days = expectedDaysToCollect(daysOverdue);
  const timeDiscount = (UK_LATE_PAYMENT_APR / 365) * days;

  const expectedRecovery = Number(
    (amountDue * recoveryProbability * (1 - timeDiscount)).toFixed(2)
  );

  return { recoveryProbability, expectedDaysToCollect: days, expectedRecovery };
}
