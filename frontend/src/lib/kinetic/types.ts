// Data contract for UpFlow. Person 1's backend must return these shapes.
// Frontend imports only from here — never from seed.ts directly.

export type Currency = "GBP";

export interface CompanySnapshot {
  orgName: string;
  connectedVia: "Xero";
  lastSyncAt: string; // ISO
  mode: "live" | "fallback";
  currency: Currency;
  currentCash: number;
  overdueReceivables: number;
  /** Sum of expectedRecovery across overdue invoices — see engines/recovery.ts. */
  recoverableCash: number;
  /** Lapsed-customer reactivation value only — repeat-buyer upsell isn't included. */
  revenueOpportunityTotal: number;
}

export interface LiquidityGap {
  dso: number; // days
  dpo: number; // days
  ccc: number; // days
  horizonDays: 30;
  projectedInflow: number;
  projectedOutflow: number;
  projectedShortfall: number; // negative = gap
  daily: Array<{ day: number; inflow: number; outflow: number; balance: number }>;
}

export interface InvoiceRisk {
  id: string;
  customer: string;
  amount: number;
  daysOverdue: number; // negative = not yet due
  dueDate: string;
  riskScore: number; // 0-100
  reason: string;
  /** 0-1, probability-weighted and time-discounted recovery estimate. */
  recoveryProbability: number;
  expectedDaysToCollect: number;
  expectedRecovery: number;
}

export interface SupplierOpportunity {
  id: string;
  supplier: string;
  amount: number;
  daysUntilDue: number;
  extensionDays: number;
  cashRetained: number;
  reason: string;
}

export interface LapsedCustomer {
  id: string;
  name: string;
  ltv: number;
  daysSilent: number;
  recoveryPotential: number;
  lastInvoice: string;
}

export interface RepeatBuyer {
  id: string;
  name: string;
  transactions12m: number;
  avgInvoice: number;
  upsellPotential: number;
}

export type AgentKind = "receivables" | "payables";
export type Urgency = "low" | "medium" | "high" | "critical";

export interface NegotiationDraft {
  id: string;
  agent: AgentKind;
  targetName: string;
  targetId: string;
  urgency: Urgency;
  reason: string;
  proposedAction: string;
  expectedCashImpact: number; // + inflow, - retained outflow
  hoursToImpact: number;
  confidence: number; // 0-1
  subject: string;
  body: string;
}

export interface ExecutionResult {
  draftId: string;
  status: "simulated" | "approved" | "rejected";
  executedAt: string;
  cashImpact: number;
  newProjectedShortfall: number;
  note: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  rationale: string;
  humanInLoop: boolean;
}

export interface ControlRoomData {
  snapshot: CompanySnapshot;
  liquidity: LiquidityGap;
  atRiskInvoices: InvoiceRisk[];
  supplierOpportunities: SupplierOpportunity[];
  lapsedCustomers: LapsedCustomer[];
  repeatBuyers: RepeatBuyer[];
  drafts: NegotiationDraft[];
  audit: AuditEntry[];
}
