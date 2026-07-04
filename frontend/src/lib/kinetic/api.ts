import type {
  ControlRoomData,
  CommunicationResult,
  DraftActionType,
  ExecutionResult,
  InvoiceRisk,
  LapsedCustomer,
  NegotiationDraft,
  RepeatBuyer,
  SupplierOpportunity,
} from "./types";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:3001";

type Money = { amount: number; currency: string };

type ApiEnvelope<T> = {
  ok: boolean;
  mode: "live" | "fallback";
  generatedAt: string;
  data: T;
};

type SummaryData = {
  organizationName: string;
  currency: string;
  overdueReceivables: Money;
};

type LiquidityData = {
  currency: string;
  snapshot: {
    cash: number;
    totalReceivables: number;
    totalPayables: number;
    workingCapital: number;
    dso: number;
    dpo: number;
    ccc: number;
    projectedGap30Days: number;
  };
  atRiskInvoices: Array<{
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
  }>;
  daily: Array<{ day: number; inflow: number; outflow: number; balance: number }>;
  projectedInflow: number;
  projectedOutflow: number;
};

type LegacyLiquidityData = {
  currency: string;
  currentCash: Money | null;
  receivablesDue30d: Money;
  payablesDue30d: Money;
  receivablesOverdue: Money;
  projectedGap30d: Money;
  dso: number;
  dpo: number;
  ccc: number;
  status: string;
};

type AtRiskItem = {
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
};

type AtRiskData = {
  organizationName: string;
  currency: string;
  totalAtRisk: number;
  items: AtRiskItem[];
};

type RevenueItem = {
  id: string;
  type: "lapsed_customer" | "repeat_buyer";
  contactId: string;
  contactName: string;
  estimatedValue: Money;
  reason: string;
  priority: "low" | "medium" | "high";
  recommendedAction: string;
};

type RevenueData = {
  organizationName: string;
  currency: string;
  totalOpportunities: number;
  estimatedRevenueUnlock: Money;
  items: RevenueItem[];
};

type OpenPayableItem = {
  id: string;
  contactId: string;
  contactName: string;
  amount: number;
  daysOverdue: number;
  urgency: "critical" | "high" | "medium" | "low";
  recommendedAction: string;
  expectedCashImpact: number;
};

type OpenPayablesData = {
  currency: string;
  totalOpen: number;
  items: OpenPayableItem[];
};

type BackendDraft = {
  id: string;
  type: DraftActionType;
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

type ExecutionHistoryItem = {
  executionId: string;
  actionType: DraftActionType;
  actionId: string;
  status: "simulated" | "rejected";
  idempotencyKey: string;
  expectedCashUnlocked: Money;
  cashUnlocked: Money;
  auditLog: {
    createdAt: string;
    message: string;
  };
  targetName: string | null;
  recordedAt: string;
};

type ExecutionHistoryData = {
  totalExecutions: number;
  items: ExecutionHistoryItem[];
};

type SimulationExecuteResponse = {
  executionId: string;
  actionType: DraftActionType;
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

type HealthData = {
  xeroConfigured: boolean;
  xeroConnected: boolean;
  authReady: boolean;
  fallbackEnabled: boolean;
  lastSyncAt: string | null;
  emailConfigured: boolean;
  voiceConfigured: boolean;
};

type NormalizedLiquidity = {
  cash: number;
  dso: number;
  dpo: number;
  ccc: number;
  projectedGap30Days: number;
  projectedInflow: number;
  projectedOutflow: number;
  daily: LiquidityData["daily"];
};

async function fetchEnvelope<T>(path: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Xero rate limit reached. Wait a minute and click Refresh.");
    }
    throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as ApiEnvelope<T> & {
    data?: { message?: string };
  };
  if (!body.ok) {
    const message = body.data?.message ?? `Backend returned ok:false for ${path}`;
    throw new Error(message);
  }

  return body;
}

async function postEnvelope<T>(path: string, payload: unknown): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = (await res.json()) as ApiEnvelope<T> & {
    data?: { message?: string };
  };
  if (!res.ok || !body.ok) {
    throw new Error(body.data?.message ?? `Failed to post ${path}: ${res.statusText}`);
  }

  return body;
}

async function tryPostEnvelope<T>(
  path: string,
  payload: unknown,
): Promise<ApiEnvelope<T> | null> {
  try {
    return await postEnvelope<T>(path, payload);
  } catch (error) {
    console.warn(`[UpFlow] Draft generation failed for ${path}`, error);
    return null;
  }
}

function normalizeLiquidity(
  liquidity: ApiEnvelope<LiquidityData | LegacyLiquidityData>,
): NormalizedLiquidity {
  const data = liquidity.data as LiquidityData & LegacyLiquidityData;
  const hasSnapshot = data.snapshot != null && typeof data.snapshot.cash === "number";
  const hasLegacy = "currentCash" in data || "receivablesDue30d" in data;

  if (hasSnapshot) {
    return {
      cash: data.snapshot.cash,
      dso: data.snapshot.dso,
      dpo: data.snapshot.dpo,
      ccc: data.snapshot.ccc,
      projectedGap30Days: data.snapshot.projectedGap30Days,
      projectedInflow: data.projectedInflow ?? 0,
      projectedOutflow: data.projectedOutflow ?? 0,
      daily: data.daily ?? [],
    };
  }

  if (hasLegacy) {
    const inflow = data.receivablesDue30d?.amount ?? 0;
    const outflow = data.payablesDue30d?.amount ?? 0;
    return {
      cash: data.currentCash?.amount ?? 0,
      dso: data.dso ?? 0,
      dpo: data.dpo ?? 0,
      ccc: data.ccc ?? 0,
      projectedGap30Days: inflow - outflow,
      projectedInflow: inflow,
      projectedOutflow: outflow,
      daily: [],
    };
  }

  throw new Error(
    "Unexpected /api/liquidity response shape. Restart the backend to load the updated liquidity endpoint.",
  );
}

function daysFromReason(reason: string): number {
  const match = reason.match(/(\d+)\s+days?/i);
  return match ? Number(match[1]) : 0;
}

function avgInvoiceFromReason(reason: string): number {
  const match = reason.match(/average invoice value of\s+[A-Z]{3}\s+([\d.]+)/i);
  return match ? Number(match[1]) : 0;
}

function mapAtRisk(items: AtRiskItem[]): InvoiceRisk[] {
  return items.map((item) => ({
    id: item.invoiceId,
    customer: item.contactName,
    amount: item.amountDue.amount,
    daysOverdue: item.daysOverdue,
    dueDate: "",
    riskScore: item.riskScore,
    reason: item.reason,
  }));
}

function mapSupplierOpportunities(items: OpenPayableItem[]): SupplierOpportunity[] {
  return items.map((item) => ({
    id: item.id,
    supplier: item.contactName,
    amount: item.amount,
    daysUntilDue: Math.max(0, -item.daysOverdue),
    extensionDays: item.daysOverdue > 0 ? 7 : 14,
    cashRetained: item.expectedCashImpact,
    reason: item.recommendedAction,
  }));
}

function mapLapsed(items: RevenueItem[]): LapsedCustomer[] {
  return items
    .filter((item) => item.type === "lapsed_customer")
    .map((item) => {
      const recoveryPotential = item.estimatedValue.amount;
      const ltv = recoveryPotential > 0 ? Number((recoveryPotential / 0.35).toFixed(2)) : 0;

      return {
        id: item.contactId,
        name: item.contactName,
        ltv,
        daysSilent: daysFromReason(item.reason),
        recoveryPotential,
        lastInvoice: "",
      };
    });
}

function mapRepeatBuyers(items: RevenueItem[]): RepeatBuyer[] {
  return items
    .filter((item) => item.type === "repeat_buyer")
    .map((item) => ({
      id: item.contactId,
      name: item.contactName,
      transactions12m: 2,
      avgInvoice: avgInvoiceFromReason(item.reason),
      upsellPotential: item.estimatedValue.amount,
    }));
}

function urgencyFromPriority(priority: "low" | "medium" | "high") {
  return priority === "high" ? "high" : priority === "medium" ? "medium" : "low";
}

function agentFromActionType(actionType: DraftActionType) {
  if (actionType === "payables_extension") return "payables" as const;
  if (actionType === "reengagement_quote") return "reengagement" as const;
  return "receivables" as const;
}

function hoursToImpactFromActionType(actionType: DraftActionType) {
  if (actionType === "payables_extension") return 24;
  if (actionType === "reengagement_quote") return 168;
  return 48;
}

function confidenceFromMetadata(metadata: BackendDraft["metadata"]) {
  const value = metadata.confidenceLevel;
  return typeof value === "number" ? value : 0.72;
}

function toFrontendDraft(draft: BackendDraft): NegotiationDraft {
  return {
    id: draft.id,
    actionType: draft.type,
    agent: agentFromActionType(draft.type),
    targetName: draft.targetName,
    targetId: draft.targetId,
    currency: draft.currency,
    contactEmail:
      typeof draft.metadata.contactEmail === "string" ? draft.metadata.contactEmail : undefined,
    contactPhone:
      typeof draft.metadata.contactPhone === "string" ? draft.metadata.contactPhone : undefined,
    daysOverdue:
      typeof draft.metadata.daysOverdue === "number" ? draft.metadata.daysOverdue : undefined,
    urgency: urgencyFromPriority(draft.priority),
    reason: draft.reason,
    proposedAction:
      typeof draft.metadata.proposedAction === "string"
        ? draft.metadata.proposedAction
        : draft.subjectLine,
    expectedCashImpact: draft.expectedImpact.amount,
    hoursToImpact: hoursToImpactFromActionType(draft.type),
    confidence: confidenceFromMetadata(draft.metadata),
    subject: draft.subjectLine,
    body: draft.draftMessage,
  };
}

function dedupeDrafts(drafts: NegotiationDraft[]) {
  const byId = new Map<string, NegotiationDraft>();
  drafts.forEach((draft) => byId.set(draft.id, draft));
  return [...byId.values()];
}

async function buildDrafts(
  atRisk: ApiEnvelope<AtRiskData>,
  payables: ApiEnvelope<OpenPayablesData>,
  revenue: ApiEnvelope<RevenueData>,
): Promise<NegotiationDraft[]> {
  const receivablesRequests = atRisk.data.items.slice(0, 3).map((item) =>
    tryPostEnvelope<BackendDraft>("/api/agent/receivables-draft", {
      invoiceId: item.invoiceId,
      tone: item.priority === "high" ? "firm" : "friendly",
      discountPercent: item.daysOverdue >= 14 ? 2 : 1,
    }),
  );

  const payablesRequests = payables.data.items.slice(0, 2).map((item) =>
    tryPostEnvelope<BackendDraft>("/api/agent/payables-draft", {
      supplierName: item.contactName,
      amount: item.amount,
      currency: payables.data.currency,
      extensionDays: item.daysOverdue > 0 ? 7 : 14,
      tone: "friendly",
    }),
  );

  const reengagementRequests = revenue.data.items
    .filter((item) => item.type === "lapsed_customer")
    .slice(0, 2)
    .map((item) =>
      tryPostEnvelope<BackendDraft>("/api/agent/reengagement-quote", {
        contactId: item.contactId,
        tone: "friendly",
        offerPercent: 10,
      }),
    );

  const responses = await Promise.all([
    ...receivablesRequests,
    ...payablesRequests,
    ...reengagementRequests,
  ]);

  return dedupeDrafts(
    responses
      .filter((response): response is ApiEnvelope<BackendDraft> => Boolean(response))
      .map((response) => toFrontendDraft(response.data)),
  );
}

function actorFromDraft(draft: NegotiationDraft) {
  if (draft.agent === "payables") return "Payables Agent";
  if (draft.agent === "reengagement") return "Revenue Agent";
  return "Receivables Agent";
}

function actorFromActionType(actionType: DraftActionType) {
  if (actionType === "payables_extension") return "Payables Agent";
  if (actionType === "reengagement_quote") return "Revenue Agent";
  return "Receivables Agent";
}

function buildAuditEntries(
  generatedAt: string,
  drafts: NegotiationDraft[],
  history: ApiEnvelope<ExecutionHistoryData>,
): ControlRoomData["audit"] {
  const draftEntries = drafts.map((draft) => ({
    id: `draft-${draft.id}`,
    at: generatedAt,
    actor: actorFromDraft(draft),
    action:
      draft.agent === "reengagement"
        ? "Prepared re-engagement draft"
        : draft.agent === "payables"
          ? "Prepared extension draft"
          : "Prepared collection draft",
    target: draft.targetName,
    rationale: draft.reason,
    humanInLoop: true,
  }));

  const historyEntries = history.data.items.map((item) => ({
    id: item.executionId,
    at: item.recordedAt,
    actor: actorFromActionType(item.actionType),
    action: item.status === "rejected" ? "Execution rejected" : "Execution simulated",
    target: item.targetName ?? item.actionId,
    rationale: item.auditLog.message,
    humanInLoop: true,
  }));

  return [...historyEntries, ...draftEntries];
}

function toControlRoomData(
  summary: ApiEnvelope<SummaryData>,
  liquidity: ApiEnvelope<LiquidityData | LegacyLiquidityData>,
  atRisk: ApiEnvelope<AtRiskData>,
  revenue: ApiEnvelope<RevenueData>,
  payables: ApiEnvelope<OpenPayablesData>,
  history: ApiEnvelope<ExecutionHistoryData>,
  drafts: NegotiationDraft[],
): ControlRoomData {
  const normalized = normalizeLiquidity(liquidity);
  const currency = summary.data.currency || revenue.data.currency || payables.data.currency || "GBP";

  return {
    snapshot: {
      orgName: summary.data.organizationName,
      connectedVia: "Xero",
      lastSyncAt: summary.generatedAt,
      mode: summary.mode,
      currency,
      currentCash: normalized.cash,
      overdueReceivables: summary.data.overdueReceivables.amount,
      revenueOpportunityTotal: revenue.data.estimatedRevenueUnlock.amount,
    },
    liquidity: {
      dso: normalized.dso,
      dpo: normalized.dpo,
      ccc: normalized.ccc,
      horizonDays: 30,
      projectedInflow: normalized.projectedInflow,
      projectedOutflow: normalized.projectedOutflow,
      projectedShortfall: normalized.projectedGap30Days,
      daily: normalized.daily,
    },
    atRiskInvoices: mapAtRisk(atRisk.data.items),
    supplierOpportunities: mapSupplierOpportunities(payables.data.items),
    lapsedCustomers: mapLapsed(revenue.data.items),
    repeatBuyers: mapRepeatBuyers(revenue.data.items),
    drafts,
    audit: buildAuditEntries(summary.generatedAt, drafts, history),
  };
}

function warnIfModeMismatch(
  canonical: ApiEnvelope<unknown>,
  others: Array<{ label: string; envelope: ApiEnvelope<unknown> }>,
): void {
  for (const { label, envelope } of others) {
    if (envelope.mode !== canonical.mode) {
      console.warn(
        `[UpFlow] Mode mismatch: /api/summary is "${canonical.mode}" but ${label} is "${envelope.mode}"`,
      );
    }
  }
}

export async function fetchXeroAuthUrl(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/xero/auth-url`);
  const body = (await res.json()) as {
    ok: boolean;
    data?: { authUrl?: string; message?: string };
  };
  if (!res.ok || !body.ok || !body.data?.authUrl) {
    throw new Error(
      body.data?.message ?? `Failed to fetch Xero auth URL: ${res.status} ${res.statusText}`,
    );
  }
  return body.data.authUrl;
}

export async function fetchHealth(): Promise<HealthData> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`Failed to fetch health: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as {
    ok: boolean;
    data?: HealthData & { message?: string };
  };
  if (!body.ok || !body.data) {
    throw new Error(body.data?.message ?? "Backend health check failed");
  }

  return body.data;
}

export async function fetchControlRoom(): Promise<ControlRoomData> {
  const [summary, liquidity, atRisk, revenue, payables, history] = await Promise.all([
    fetchEnvelope<SummaryData>("/api/summary"),
    fetchEnvelope<LiquidityData | LegacyLiquidityData>("/api/liquidity"),
    fetchEnvelope<AtRiskData>("/api/invoices/at-risk"),
    fetchEnvelope<RevenueData>("/api/revenue-opportunities"),
    fetchEnvelope<OpenPayablesData>("/api/payables/open"),
    fetchEnvelope<ExecutionHistoryData>("/api/executions/history"),
  ]);

  warnIfModeMismatch(summary, [
    { label: "/api/liquidity", envelope: liquidity },
    { label: "/api/invoices/at-risk", envelope: atRisk },
    { label: "/api/revenue-opportunities", envelope: revenue },
    { label: "/api/payables/open", envelope: payables },
    { label: "/api/executions/history", envelope: history },
  ]);

  const drafts = await buildDrafts(atRisk, payables, revenue);

  return toControlRoomData(summary, liquidity, atRisk, revenue, payables, history, drafts);
}

export async function simulateExecute(
  draft: NegotiationDraft,
  currentShortfall: number,
): Promise<ExecutionResult> {
  const response = await postEnvelope<SimulationExecuteResponse>("/api/simulate/execute", {
    actionType: draft.actionType,
    actionId: draft.id,
    approved: true,
    idempotencyKey: `ui-${draft.id}`,
  });

  return {
    draftId: response.data.actionId,
    status: response.data.status,
    executedAt: response.data.auditLog.createdAt,
    cashImpact: response.data.cashUnlocked.amount,
    newProjectedShortfall: currentShortfall + response.data.cashUnlocked.amount,
    note: response.data.auditLog.message,
  };
}

export async function sendReminderEmail(draft: NegotiationDraft): Promise<CommunicationResult> {
  const response = await postEnvelope<CommunicationResult>("/api/communications/send-email", {
    draftId: draft.id,
  });

  return response.data;
}

export async function placeReminderCall(draft: NegotiationDraft): Promise<CommunicationResult> {
  const response = await postEnvelope<CommunicationResult>("/api/communications/place-call", {
    draftId: draft.id,
  });

  return response.data;
}
