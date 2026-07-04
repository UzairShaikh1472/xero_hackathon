/** Shared contracts for Person 1 (normalize) → Person 2 (score) → Person 3 (UI). */

export type Urgency = "critical" | "high" | "medium" | "low";

export type InvoiceType = "ACCREC" | "ACCPAY";

export type InvoiceStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "AUTHORISED"
  | "PAID"
  | "VOIDED";

/** Input shape Person 1 should normalize Xero data into. */
export interface NormalizedInvoice {
  invoiceId: string;
  contactId: string;
  contactName: string;
  amount: number;
  amountDue: number;
  dueDate: string;
  date: string;
  status: InvoiceStatus;
  type: InvoiceType;
}

export interface NormalizedContact {
  contactId: string;
  contactName: string;
  isCustomer: boolean;
  isSupplier: boolean;
}

export interface NormalizedPayment {
  paymentId: string;
  invoiceId: string;
  contactId: string;
  amount: number;
  date: string;
  /** Days from invoice due date to payment date. Negative = paid early. */
  daysToPay: number;
  onTime: boolean;
}

export interface NormalizedData {
  cash: number;
  asOfDate: string;
  invoices: NormalizedInvoice[];
  contacts: NormalizedContact[];
  payments: NormalizedPayment[];
  /** Trailing revenue for DSO (e.g. last 90 days). */
  revenueLast90Days: number;
  /** Trailing COGS/purchases for DPO (e.g. last 90 days). */
  cogsLast90Days: number;
}

/** Scored / derived outputs Person 2 produces. */

export interface CompanySnapshot {
  cash: number;
  totalReceivables: number;
  totalPayables: number;
  workingCapital: number;
  dso: number;
  dpo: number;
  ccc: number;
  projectedGap30Days: number;
}

export interface InvoiceRisk {
  contactId: string;
  contactName: string;
  invoiceId: string;
  amount: number;
  daysOverdue: number;
  paymentReliabilityScore: number;
  urgency: Urgency;
  recommendedAction: string;
  expectedCashImpact: number;
  liquidityPriorityScore: number;
}

/** Pre-scored supplier payable for the payables negotiator agent. */
export interface PayablePressure {
  contactId: string;
  contactName: string;
  invoiceId: string;
  amount: number;
  daysOverdue: number;
  urgency: Urgency;
  recommendedAction: string;
  /** Cash preserved by delaying payment. */
  expectedCashImpact: number;
}

export interface LapsedCustomer {
  contactId: string;
  contactName: string;
  lastInvoiceDate: string;
  daysSinceLastActivity: number;
  historicalLTV: number;
  lapsedScore: number;
  recommendedAction: string;
}

export interface RepeatBuyer {
  contactId: string;
  contactName: string;
  transactionCount: number;
  averageInvoiceSize: number;
  repeatScore: number;
  upsellOpportunity: string;
}

export interface PaymentVelocitySignal {
  contactId: string;
  contactName: string;
  velocityDecay: number;
  currentAvgPaymentDays: number;
  historicalAvgPaymentDays: number;
  isSlowingDown: boolean;
}

export interface NegotiationDraft {
  targetType: "receivable" | "payable" | "lapsed_customer";
  contactName: string;
  reason: string;
  urgency: Urgency;
  proposedAction: string;
  expectedCashImpact: number;
  draftMessage: string;
  confidenceLevel: number;
}
