// Swap seam: maps live backend envelopes into ControlRoomData for the dashboard.
import type {
  CommunicationResult,
  ControlRoomData,
  ExecutionResult,
  FollowUpsData,
  InvoiceRisk,
  LapsedCustomer,
  NegotiationDraft,
  RepeatBuyer,
  Urgency,
} from "./types";
import { seedData } from "./seed";
import { seedFollowUps } from "./seed-follow-ups";

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
  daily: Array<{ day: number; inflow: number; outflow: number; balance: number }>;
  projectedInflow: number;
  projectedOutflow: number;
};

type AtRiskItem = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  amountDue: Money;
  daysOverdue: number;
  priority: string;
  riskScore: number;
  reason: string;
  recommendedAction: string;
  recoveryProbability: number;
  expectedDaysToCollect: number;
  expectedRecovery: Money;
};

type AtRiskData = {
  organizationName: string;
  currency: string;
  totalAtRisk: number;
  totalRecoverableCash: Money;
  items: AtRiskItem[];
};

type RevenueItem = {
  id: string;
  type: "lapsed_customer" | "repeat_buyer";
  contactId: string;
  contactName: string;
  estimatedValue: Money;
  reason: string;
  priority: string;
  recommendedAction: string;
};

type RevenueData = {
  organizationName: string;
  currency: string;
  totalOpportunities: number;
  estimatedRevenueUnlock: Money;
  items: RevenueItem[];
};

type BackendNegotiationDraft = {
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

export type VoiceSessionData = {
  token: string;
  draftId: string;
  contactName: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  daysOverdue: number;
  discountPercent?: number;
  expiresAt: string;
  vapiPublicKey?: string;
  vapiAssistantId?: string;
  systemPrompt: string;
};

async function fetchEnvelope<T>(path: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Xero rate limit reached. Wait a minute and click Retry");
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

async function postJson<T>(path: string, payload: unknown): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as ApiEnvelope<T> & {
    data?: { message?: string };
  };
  if (!res.ok || !body.ok) {
    throw new Error(body.data?.message ?? `Request failed: ${res.status} ${res.statusText}`);
  }
  return body;
}

function daysFromReason(reason: string): number {
  const match = reason.match(/(\d+)\s+days?/i);
  return match ? Number(match[1]) : 0;
}

function avgInvoiceFromReason(reason: string): number {
  const match = reason.match(/average invoice value of\s+[A-Z]{3}\s+(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : 0;
}

function priorityToUrgency(priority: string, daysOverdue: number): Urgency {
  if (priority === "high" && daysOverdue >= 21) return "critical";
  if (priority === "high" || daysOverdue >= 14) return "high";
  if (daysOverdue >= 7) return "medium";
  return "low";
}

export function mapBackendDraft(draft: BackendNegotiationDraft): NegotiationDraft {
  const daysOverdue =
    typeof draft.metadata.daysOverdue === "number"
      ? draft.metadata.daysOverdue
      : daysFromReason(draft.reason);

  const agent =
    draft.type === "receivables_discount"
      ? "receivables"
      : draft.type === "payables_extension"
        ? "payables"
        : "reengagement";

  return {
    id: draft.id,
    actionType: draft.type,
    agent,
    targetName: draft.targetName,
    targetId: draft.targetId,
    invoiceId: draft.type === "receivables_discount" ? draft.targetId : undefined,
    currency: draft.currency,
    contactEmail:
      typeof draft.metadata.contactEmail === "string"
        ? draft.metadata.contactEmail
        : undefined,
    contactPhone:
      typeof draft.metadata.contactPhone === "string"
        ? draft.metadata.contactPhone
        : undefined,
    daysOverdue,
    urgency: priorityToUrgency(draft.priority, daysOverdue),
    reason: draft.reason,
    proposedAction:
      typeof draft.metadata.recommendedAction === "string"
        ? draft.metadata.recommendedAction
        : draft.reason,
    expectedCashImpact: draft.expectedImpact.amount,
    hoursToImpact: Math.max(24, Math.round(daysOverdue * 12)),
    confidence: 0.85,
    subject: draft.subjectLine,
    body: draft.draftMessage,
  };
}

async function fetchReceivablesDraft(invoiceId: string): Promise<NegotiationDraft | null> {
  try {
    const envelope = await postJson<BackendNegotiationDraft>("/api/agent/receivables-draft", {
      invoiceId,
    });
    return mapBackendDraft(envelope.data);
  } catch (error) {
    console.warn(`[UpFlow] Failed to load draft for invoice ${invoiceId}`, error);
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function fetchReceivablesDrafts(items: AtRiskItem[]): Promise<NegotiationDraft[]> {
  const overdue = items.filter((item) => item.daysOverdue > 0);
  const drafts = await mapWithConcurrency(overdue, 5, (item) =>
    fetchReceivablesDraft(item.invoiceId),
  );
  return drafts.filter((draft): draft is NegotiationDraft => draft !== null);
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
    recoveryProbability: item.recoveryProbability,
    expectedDaysToCollect: item.expectedDaysToCollect,
    expectedRecovery: item.expectedRecovery.amount,
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
    "Unexpected /api/liquidity response shape. Restart the backend (npm run dev in repo root) to load the updated liquidity endpoint.",
  );
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

function toControlRoomData(
  summary: ApiEnvelope<SummaryData>,
  liquidity: ApiEnvelope<LiquidityData | LegacyLiquidityData>,
  atRisk: ApiEnvelope<AtRiskData>,
  revenue: ApiEnvelope<RevenueData>,
  drafts: NegotiationDraft[],
): ControlRoomData {
  const normalized = normalizeLiquidity(liquidity);
  const lapsedCustomers = mapLapsed(revenue.data.items);
  const revenueOpportunityTotal = lapsedCustomers.reduce(
    (sum, c) => sum + c.recoveryPotential,
    0,
  );

  return {
    snapshot: {
      orgName: summary.data.organizationName,
      connectedVia: "Xero",
      lastSyncAt: summary.generatedAt,
      mode: summary.mode,
      currency: "GBP",
      currentCash: normalized.cash,
      overdueReceivables: summary.data.overdueReceivables.amount,
      recoverableCash: atRisk.data.totalRecoverableCash.amount,
      revenueOpportunityTotal,
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
    supplierOpportunities: [],
    lapsedCustomers,
    repeatBuyers: mapRepeatBuyers(revenue.data.items),
    drafts,
    audit: [],
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
      body.data?.message ??
        `Failed to fetch Xero auth URL: ${res.status} ${res.statusText}`,
    );
  }
  return body.data.authUrl;
}

export type HealthData = {
  xeroConfigured: boolean;
  xeroConnected: boolean;
  authReady: boolean;
  fallbackEnabled: boolean;
  lastSyncAt: string | null;
  emailConfigured: boolean;
  voiceConfigured: boolean;
  browserVoiceConfigured: boolean;
};

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
  const [summary, liquidity, atRisk, revenue] = await Promise.all([
    fetchEnvelope<SummaryData>("/api/summary"),
    fetchEnvelope<LiquidityData | LegacyLiquidityData>("/api/liquidity"),
    fetchEnvelope<AtRiskData>("/api/invoices/at-risk"),
    fetchEnvelope<RevenueData>("/api/revenue-opportunities"),
  ]);

  if (summary.mode === "fallback") {
    return seedData;
  }

  warnIfModeMismatch(summary, [
    { label: "/api/liquidity", envelope: liquidity },
    { label: "/api/invoices/at-risk", envelope: atRisk },
    { label: "/api/revenue-opportunities", envelope: revenue },
  ]);

  // Drafts load in background via draftsQuery — do not block dashboard on LLM calls.
  return toControlRoomData(summary, liquidity, atRisk, revenue, []);
}

export async function fetchReceivablesDraftsBatch(): Promise<NegotiationDraft[]> {
  try {
    const envelope = await fetchEnvelope<{ drafts: BackendNegotiationDraft[] }>(
      "/api/agent/receivables-drafts?fast=1",
    );
    if (envelope.mode === "fallback") {
      return seedData.drafts;
    }
    return envelope.data.drafts.map(mapBackendDraft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load drafts";
    if (message.includes("Failed to fetch") || message.includes("ECONNREFUSED")) {
      throw new Error(
        `Cannot reach backend at ${API_BASE}. Start it with npm run dev in the project root.`,
      );
    }
    throw error;
  }
}

export async function simulateExecute(
  draft: NegotiationDraft,
  currentShortfall: number,
): Promise<ExecutionResult> {
  return {
    draftId: draft.id,
    status: "simulated",
    executedAt: new Date().toISOString(),
    cashImpact: draft.expectedCashImpact,
    newProjectedShortfall: currentShortfall + draft.expectedCashImpact,
    note: `Simulated ${draft.agent === "receivables" ? "collection" : "extension"}: no Xero write-back performed.`,
  };
}

export async function sendDraftEmail(
  draftId: string,
  edits?: { subject?: string; body?: string },
  invoiceId?: string,
): Promise<CommunicationResult> {
  const envelope = await postJson<CommunicationResult>("/api/communications/send-email", {
    draftId,
    invoiceId,
    subjectLine: edits?.subject,
    draftMessage: edits?.body,
  });
  return envelope.data;
}

export async function sendVoiceInvite(
  draftId: string,
  edits?: { subject?: string; body?: string },
  invoiceId?: string,
): Promise<CommunicationResult> {
  const envelope = await postJson<CommunicationResult>(
    "/api/communications/send-voice-invite",
    {
      draftId,
      invoiceId,
      subjectLine: edits?.subject,
      draftMessage: edits?.body,
    },
  );
  return envelope.data;
}

export async function createVoiceSession(
  draftId: string,
  invoiceId?: string,
): Promise<{ callToken: string; callUrl: string }> {
  const envelope = await postJson<{ callToken: string; callUrl: string }>(
    "/api/voice/sessions",
    { draftId, invoiceId },
  );
  return envelope.data;
}

export async function fetchVoiceSession(token: string): Promise<VoiceSessionData> {
  const envelope = await fetchEnvelope<VoiceSessionData>(`/api/voice/sessions/${token}`);
  return envelope.data;
}

export async function sendVoiceChat(
  token: string,
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const envelope = await postJson<{ reply: string }>("/api/voice/chat", {
    token,
    message,
    history,
  });
  return envelope.data.reply;
}

export async function fetchFollowUps(): Promise<FollowUpsData> {
  try {
    const envelope = await fetchEnvelope<FollowUpsData>("/api/actions/follow-ups");
    if (envelope.mode === "fallback") {
      return seedFollowUps;
    }
    return envelope.data;
  } catch (error) {
    console.warn("[UpFlow] Failed to load follow-ups", error);
    return { open: [], resolved: [] };
  }
}
