const UK_REFERENCE_BASE_RATE = 0.0375;
const UK_STATUTORY_MARGIN_RATE = 0.08;
const UK_STATUTORY_ANNUAL_RATE = UK_REFERENCE_BASE_RATE + UK_STATUTORY_MARGIN_RATE;
const UK_REFERENCE_PERIOD_START = "2026-07-01";
const UK_REFERENCE_PERIOD_END = "2026-12-31";

export type UkLatePaymentEstimate = {
  eligible: boolean;
  principalAmount: number;
  daysOverdue: number;
  baseRate: number;
  statutoryMarginRate: number;
  statutoryAnnualRate: number;
  dailyInterestRate: number;
  statutoryInterest: number;
  fixedCompensation: number;
  totalCharges: number;
  updatedBalance: number;
  referencePeriodStart: string;
  referencePeriodEnd: string;
  assumptionNote: string;
};

function fixedCompensationForDebt(amount: number) {
  if (amount >= 10000) return 100;
  if (amount >= 1000) return 70;
  if (amount > 0) return 40;
  return 0;
}

export function calculateUkLatePaymentEstimate(
  principalAmount: number,
  daysOverdue: number,
): UkLatePaymentEstimate {
  const normalizedPrincipal = Number(Math.max(0, principalAmount).toFixed(2));
  const normalizedDays = Math.max(0, Math.trunc(daysOverdue));
  const eligible = normalizedPrincipal > 0 && normalizedDays > 0;
  const dailyInterestRate = UK_STATUTORY_ANNUAL_RATE / 365;

  const statutoryInterest = eligible
    ? Number((normalizedPrincipal * dailyInterestRate * normalizedDays).toFixed(2))
    : 0;
  const fixedCompensation = eligible ? fixedCompensationForDebt(normalizedPrincipal) : 0;
  const totalCharges = Number((statutoryInterest + fixedCompensation).toFixed(2));
  const updatedBalance = Number((normalizedPrincipal + totalCharges).toFixed(2));

  return {
    eligible,
    principalAmount: normalizedPrincipal,
    daysOverdue: normalizedDays,
    baseRate: UK_REFERENCE_BASE_RATE,
    statutoryMarginRate: UK_STATUTORY_MARGIN_RATE,
    statutoryAnnualRate: UK_STATUTORY_ANNUAL_RATE,
    dailyInterestRate,
    statutoryInterest,
    fixedCompensation,
    totalCharges,
    updatedBalance,
    referencePeriodStart: UK_REFERENCE_PERIOD_START,
    referencePeriodEnd: UK_REFERENCE_PERIOD_END,
    assumptionNote:
      "Estimate for UK B2B statutory late-payment charges using the July-December 2026 reference rate window. Contract-specific terms may differ.",
  };
}
