export type BackendMode = "live" | "fallback";

export type Money = {
  amount: number;
  currency: string;
};

export type ApiEnvelope<T> = {
  ok: boolean;
  mode: BackendMode;
  generatedAt: string;
  data: T;
};

export type ContactSummary = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  totalInvoices: number;
  totalPaid: Money;
  averageInvoice: Money;
  lastInvoiceDate?: string;
  paymentReliability?: number;
};

export type InvoiceSummary = {
  id: string;
  contactId: string;
  contactName: string;
  invoiceNumber: string;
  invoiceType: "ACCREC" | "ACCPAY" | "UNKNOWN";
  status: string;
  issueDate: string;
  dueDate: string;
  total: Money;
  amountDue: Money;
  isOutstanding: boolean;
  direction: "receivable" | "payable" | "unknown";
  daysOverdue: number;
  isOverdue: boolean;
  paymentRisk?: "low" | "medium" | "high";
};

export type HealthStatus = {
  service: "xero-kinetic-backend";
  xeroConfigured: boolean;
  xeroConnected: boolean;
  authReady: boolean;
  fallbackEnabled: boolean;
  lastSyncAt: string | null;
  emailConfigured: boolean;
  voiceConfigured: boolean;
};

export type SyncStatus = {
  source: BackendMode;
  invoicesCount: number;
  contactsCount: number;
  lastSyncAt: string | null;
  tenantId: string | null;
  organizationName: string | null;
  currency: string;
};

export type PhaseOneSnapshot = {
  invoices: InvoiceSummary[];
  contacts: ContactSummary[];
  sync: SyncStatus;
};

export type CompanySnapshot = {
  organizationName: string;
  currency: string;
  totalInvoices: number;
  contactsCount: number;
  totalOutstandingReceivables: Money;
  overdueReceivables: Money;
  averageInvoiceValue: Money;
  overdueInvoicesCount: number;
  atRiskInvoicesCount: number;
  suggestedActionsCount: number;
};

export type LiquidityDailyPoint = {
  day: number;
  inflow: number;
  outflow: number;
  balance: number;
};

export type LiquidityEngineSnapshot = {
  cash: number;
  totalReceivables: number;
  totalPayables: number;
  workingCapital: number;
  dso: number;
  dpo: number;
  ccc: number;
  projectedGap30Days: number;
};

export type LiquidityAtRiskInvoice = {
  contactId: string;
  contactName: string;
  invoiceId: string;
  amount: number;
  daysOverdue: number;
  paymentReliabilityScore: number;
  urgency: "critical" | "high" | "medium" | "low";
  recommendedAction: string;
  expectedCashImpact: number;
  liquidityPriorityScore: number;
};

export type LiquiditySnapshot = {
  currency: string;
  snapshot: LiquidityEngineSnapshot;
  atRiskInvoices: LiquidityAtRiskInvoice[];
  daily: LiquidityDailyPoint[];
  projectedInflow: number;
  projectedOutflow: number;
};

export type RevenueOpportunity = {
  id: string;
  type: "lapsed_customer" | "repeat_buyer";
  contactId: string;
  contactName: string;
  estimatedValue: Money;
  reason: string;
  priority: "low" | "medium" | "high";
  recommendedAction: string;
};

export type RevenueOpportunitiesSnapshot = {
  organizationName: string;
  currency: string;
  totalOpportunities: number;
  estimatedRevenueUnlock: Money;
  items: RevenueOpportunity[];
};

export type InvoiceRisk = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  amountDue: Money;
  daysOverdue: number;
  priority: "low" | "medium" | "high";
  riskScore: number;
  reason: string;
  recommendedAction: string;
  /** 0–1, probability-weighted and time-discounted. See engines/recovery.ts. */
  recoveryProbability: number;
  expectedDaysToCollect: number;
  expectedRecovery: Money;
};

export type InvoiceRiskSnapshot = {
  organizationName: string;
  currency: string;
  totalAtRisk: number;
  /** Sum of expectedRecovery across invoices that are actually overdue (daysOverdue > 0). */
  totalRecoverableCash: Money;
  items: InvoiceRisk[];
};

export type DraftTone = "friendly" | "firm" | "direct";

export type ReceivablesDraftRequest = {
  invoiceId: string;
  tone?: DraftTone;
  discountPercent?: number;
};

export type PayablesDraftRequest = {
  supplierName: string;
  amount: number;
  currency?: string;
  extensionDays?: number;
  tone?: DraftTone;
};

export type ReengagementQuoteRequest = {
  contactId: string;
  tone?: DraftTone;
  offerPercent?: number;
};

export type NegotiationDraft = {
  id: string;
  type: "receivables_discount" | "payables_extension" | "reengagement_quote";
  targetId: string;
  targetName: string;
  currency: string;
  priority: "low" | "medium" | "high";
  reason: string;
  expectedImpact: Money;
  subjectLine: string;
  draftMessage: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type SendDraftEmailRequest = {
  draftId: string;
};

export type PlaceDraftCallRequest = {
  draftId: string;
};

export type CommunicationActionResult = {
  draftId: string;
  channel: "email" | "call";
  status: "sent" | "queued";
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  providerId?: string;
  message: string;
  scriptPreview?: string;
};

export type SimulationExecuteRequest = {
  actionType: NegotiationDraft["type"];
  actionId: string;
  approved: boolean;
  idempotencyKey: string;
};

export type ExecutionResult = {
  executionId: string;
  actionType: NegotiationDraft["type"];
  actionId: string;
  status: "simulated" | "rejected";
  idempotencyKey: string;
  expectedCashUnlocked: Money;
  cashUnlocked: Money;
  auditLog: {
    createdAt: string;
    message: string;
  };
};

export type ExecutionHistoryEntry = ExecutionResult & {
  targetName: string | null;
  recordedAt: string;
};

export type ExecutionHistorySnapshot = {
  totalExecutions: number;
  items: ExecutionHistoryEntry[];
};
