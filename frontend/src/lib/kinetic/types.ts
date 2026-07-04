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
  overdueReceivables: number;
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

export interface NegotiationDraft {
  id: string;
  actionType: DraftActionType;
  agent: AgentKind;
  targetName: string;
  targetId: string;
  currency: Currency;
  contactEmail?: string;
  contactPhone?: string;
  daysOverdue?: number;
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
  channel: "email" | "call";
  status: "sent" | "queued";
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  providerId?: string;
  message: string;
  scriptPreview?: string;
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
