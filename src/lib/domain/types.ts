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
  pendingOrgSelection: boolean;
  authReady: boolean;
  fallbackEnabled: boolean;
  lastSyncAt: string | null;
  organizationName: string | null;
  emailConfigured: boolean;
  voiceConfigured: boolean;
  browserVoiceConfigured: boolean;
  elevenLabsConfigured: boolean;
};

export type SyncStatus = {
  source: BackendMode;
  invoicesCount: number;
  contactsCount: number;
  lastSyncAt: string | null;
  tenantId: string | null;
  organizationName: string | null;
  currency: string;
  bankCash?: number;
  lastMonthCashFlow?: number;
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
  statutoryInterestEstimate: Money;
  fixedCompensationEstimate: Money;
  overdueWithLatePaymentCharges: Money;
  statutoryAnnualRatePercent: number;
  statutoryBaseRatePercent: number;
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
  statutoryInterest: Money;
  fixedCompensation: Money;
  overdueBalanceWithCharges: Money;
  statutoryAnnualRatePercent: number;
  statutoryBaseRatePercent: number;
  latePaymentAssumptionNote: string;
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
  /** When false, skip LLM and return template draft. When true, force LLM even if cached. */
  useAgent?: boolean;
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
  invoiceId?: string;
  subjectLine?: string;
  draftMessage?: string;
};

export type SendVoiceInviteRequest = {
  draftId: string;
  invoiceId?: string;
  subjectLine?: string;
  draftMessage?: string;
};

export type PlaceDraftCallRequest = {
  draftId: string;
};

export type CommunicationActionResult = {
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
};

export type VoiceSessionContext = {
  token: string;
  draftId: string;
  draftType?: NegotiationDraft["type"];
  contactName: string;
  invoiceNumber: string;
  amountDue: number;
  principalAmount?: number;
  statutoryInterest?: number;
  fixedCompensation?: number;
  overdueBalanceWithCharges?: number;
  statutoryAnnualRatePercent?: number;
  currency: string;
  daysOverdue: number;
  daysSinceLastActivity?: number;
  discountPercent?: number;
  offerPercent?: number;
  expiresAt: string;
  vapiPublicKey?: string;
  vapiAssistantId?: string;
  systemPrompt: string;
};

export type CreateVoiceSessionRequest = {
  draftId: string;
};

export type VoiceChatRequest = {
  token: string;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type VoiceChatResponse = {
  reply: string;
  audioUrl?: string;
  audioProvider?: "elevenlabs";
};

export type DemoNarrationRequest = {
  text: string;
};

export type DemoNarrationResponse = {
  text: string;
  audioUrl?: string;
  audioProvider?: "elevenlabs";
};

export type VoiceCallTurn = {
  role: "user" | "assistant";
  content: string;
};

export type VoiceCallCompleteRequest = {
  token: string;
  transcript: VoiceCallTurn[];
};

export type VoiceCallCompleteResponse = {
  contactName: string;
  invoiceNumber: string;
  summary: string;
  transcript: VoiceCallTurn[];
  emailSent: boolean;
  recipientEmail?: string;
  message: string;
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

export type FollowUpRecord = {
  id: string;
  draftId: string;
  invoiceId: string;
  invoiceNumber: string;
  contactName: string;
  channel: "email" | "call";
  sentAt: string;
  expectedCashImpact: number;
  currency: string;
};

export type ResolvedAction = {
  id: string;
  draftId: string;
  invoiceId: string;
  contactName: string;
  invoiceNumber: string;
  channel: "email" | "call";
  sentAt: string;
  resolvedAt: string;
  amountCollected: number;
  currency: string;
  source: "xero";
};

export type FollowUpsSnapshot = {
  open: FollowUpRecord[];
  resolved: ResolvedAction[];
};
