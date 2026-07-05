// Data contract for UpFlow. Person 1's backend must return these shapes.
// Frontend imports only from here — never from seed.ts directly.

export type Currency = string;

export interface CompanySnapshot {
  orgName: string;
  connectedVia: "Xero";
  lastSyncAt: string; // ISO
  mode: "live" | "fallback";
  currency: Currency;
  currentCash: number;
  lastMonthCashFlow: number;
  overdueReceivables: number;
  statutoryInterestEstimate?: number;
  fixedCompensationEstimate?: number;
  overdueWithLatePaymentCharges?: number;
  statutoryAnnualRatePercent?: number;
  statutoryBaseRatePercent?: number;
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
  statutoryInterest?: number;
  fixedCompensation?: number;
  overdueBalanceWithCharges?: number;
  statutoryAnnualRatePercent?: number;
  statutoryBaseRatePercent?: number;
  latePaymentAssumptionNote?: string;
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

export type DraftActionType =
  | "receivables_discount"
  | "payables_extension"
  | "reengagement_quote";

export type AgentKind = "receivables" | "payables" | "reengagement";
export type Urgency = "low" | "medium" | "high" | "critical";
export type FollowUpChannel = "email" | "agent_call" | "human_call";

export interface NegotiationDraft {
  id: string;
  actionType: DraftActionType;
  agent: AgentKind;
  targetName: string;
  targetId: string;
  /** Receivables drafts — Xero invoice id used for resolved reconciliation. */
  invoiceId?: string;
  currency: Currency;
  contactEmail?: string;
  contactPhone?: string;
  daysOverdue?: number;
  /** Lapsed-customer days since last order — drives email vs voice-agent outreach. */
  daysSilent?: number;
  latePaymentEstimate?: {
    principalAmount: number;
    statutoryInterest: number;
    fixedCompensation: number;
    updatedBalance: number;
    statutoryAnnualRatePercent: number;
    statutoryBaseRatePercent: number;
    dailyInterest: number;
    assumptionNote: string;
  };
  urgency: Urgency;
  reason: string;
  proposedAction: string;
  expectedCashImpact: number; // + inflow, - retained outflow
  hoursToImpact: number;
  confidence: number; // 0-1
  subject: string;
  body: string;
}

export interface CommunicationResult {
  draftId: string;
  channel: "email" | "call" | "voice_invite";
  status: "sent" | "queued";
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  providerId?: string;
  message: string;
  scriptPreview?: string;
  callUrl?: string;
  callToken?: string;
  /** Set client-side when the action is recorded in the audit rail. */
  sentAt?: string;
}

export interface ExecutionResult {
  draftId: string;
  status: "simulated" | "rejected";
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

export type FollowUpChannelType = "email" | "call";

export interface FollowUpRecord {
  id: string;
  draftId: string;
  invoiceId: string;
  invoiceNumber: string;
  contactName: string;
  channel: FollowUpChannelType;
  sentAt: string;
  expectedCashImpact: number;
  currency: string;
}

export interface ResolvedAction {
  id: string;
  draftId: string;
  invoiceId: string;
  contactName: string;
  invoiceNumber: string;
  channel: FollowUpChannelType;
  sentAt: string;
  resolvedAt: string;
  amountCollected: number;
  currency: string;
  source: "xero";
}

export interface FollowUpsData {
  open: FollowUpRecord[];
  resolved: ResolvedAction[];
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
