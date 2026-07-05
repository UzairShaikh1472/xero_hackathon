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
import { REACTIVATION_VOICE_THRESHOLD_DAYS } from "./reactivation";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:3001";

export const BACKEND_UNREACHABLE_MESSAGE = `Cannot reach backend at ${API_BASE}. Start it with npm run dev in the project root.`;

export function isBackendUnreachableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes(BACKEND_UNREACHABLE_MESSAGE) ||
    message.includes("Failed to fetch") ||
    message.includes("ECONNREFUSED") ||
    message.includes("NetworkError")
  );
}

function rethrowIfBackendUnreachable(error: unknown): never {
  if (isBackendUnreachableError(error)) {
    throw new Error(BACKEND_UNREACHABLE_MESSAGE);
  }
  throw error;
}

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
  lastSyncAt?: string | null;
  totalInvoices?: number;
  contactsCount?: number;
  overdueReceivables: Money;
  statutoryInterestEstimate?: Money;
  fixedCompensationEstimate?: Money;
  overdueWithLatePaymentCharges?: Money;
  statutoryAnnualRatePercent?: number;
  statutoryBaseRatePercent?: number;
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
  lastMonthCashFlow?: number;
  lastMonthCashFlowAvailable?: boolean;
  currentCashSource?: "bank" | "derived";
  currentCashNote?: string;
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
  statutoryInterest?: Money;
  fixedCompensation?: Money;
  overdueBalanceWithCharges?: Money;
  statutoryAnnualRatePercent?: number;
  statutoryBaseRatePercent?: number;
  latePaymentAssumptionNote?: string;
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

type ActivityLogItem = {
  id: string;
  at: string;
  eventType:
    | "email_sent"
    | "voice_invite_sent"
    | "call_queued"
    | "call_started"
    | "call_turn"
    | "call_completed"
    | "call_report_sent"
    | "simulation_recorded";
  actor: "system" | "agent" | "client";
  step: "email" | "agent_call" | "human_call" | "resolved";
  title: string;
  detail?: string;
  draftId?: string;
  targetId?: string;
  targetName?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  channel?: "email" | "call" | "voice_invite";
  amount?: number;
  currency?: string;
  providerId?: string;
  status?: "completed" | "pending" | "simulated";
};

type ActivityLogData = {
  totalEvents: number;
  items: ActivityLogItem[];
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
  draftType?: "receivables_discount" | "payables_extension" | "reengagement_quote";
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

function normalizeConfidence(
  metadata: Record<string, string | number | boolean | null>,
  fallback = 0.72,
) {
  const raw =
    typeof metadata.confidenceLevel === "number" ? metadata.confidenceLevel : fallback;
  return Number(Math.min(0.95, Math.max(0.55, raw)).toFixed(2));
}

async function fetchEnvelope<T>(path: string): Promise<ApiEnvelope<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    const body = (await res.json()) as ApiEnvelope<T> & {
      data?: { message?: string };
    };
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error("Xero rate limit reached. Wait a minute and click Retry");
      }
      throw new Error(
        body.data?.message ?? `Failed to fetch ${path}: ${res.status} ${res.statusText}`,
      );
    }
    if (!body.ok) {
      const message = body.data?.message ?? `Backend returned ok:false for ${path}`;
      throw new Error(message);
    }
    return body;
  } catch (error) {
    rethrowIfBackendUnreachable(error);
  }
}

async function postJson<T>(path: string, payload: unknown): Promise<ApiEnvelope<T>> {
  try {
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
  } catch (error) {
    rethrowIfBackendUnreachable(error);
  }
}

function daysFromReason(reason: string): number {
  const inactive = reason.match(/(\d+)\s+days?\s+inactive/i);
  if (inactive) return Number(inactive[1]);
  const silent = reason.match(/(\d+)\s+days?\s+silent/i);
  if (silent) return Number(silent[1]);
  const generic = reason.match(/(\d+)\s+days?/i);
  return generic ? Number(generic[1]) : 0;
}

function reengagementUrgency(daysSilent: number): Urgency {
  if (daysSilent >= 180) return "critical";
  if (daysSilent >= REACTIVATION_VOICE_THRESHOLD_DAYS) return "high";
  if (daysSilent >= 90) return "medium";
  return "low";
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
  const isReengagement = draft.type === "reengagement_quote";
  const daysOverdue =
    typeof draft.metadata.daysOverdue === "number"
      ? draft.metadata.daysOverdue
      : isReengagement
        ? undefined
        : daysFromReason(draft.reason);
  const daysSilent =
    typeof draft.metadata.daysSinceLastActivity === "number"
      ? draft.metadata.daysSinceLastActivity
      : isReengagement
        ? daysFromReason(draft.reason)
        : undefined;

  const agent =
    draft.type === "receivables_discount"
      ? "receivables"
      : draft.type === "payables_extension"
        ? "payables"
        : "reengagement";

  const urgency = isReengagement
    ? reengagementUrgency(daysSilent ?? 0)
    : priorityToUrgency(draft.priority, daysOverdue ?? 0);

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
    daysSilent,
    latePaymentEstimate:
      typeof draft.metadata.statutoryTotalAmountDue === "number"
        ? {
            principalAmount:
              typeof draft.metadata.principalAmount === "number"
                ? draft.metadata.principalAmount
                : typeof draft.metadata.amountDue === "number"
                  ? draft.metadata.amountDue
                  : draft.expectedImpact.amount,
            statutoryInterest:
              typeof draft.metadata.statutoryInterest === "number"
                ? draft.metadata.statutoryInterest
                : 0,
            fixedCompensation:
              typeof draft.metadata.fixedCompensation === "number"
                ? draft.metadata.fixedCompensation
                : 0,
            updatedBalance: draft.metadata.statutoryTotalAmountDue,
            statutoryAnnualRatePercent:
              typeof draft.metadata.statutoryAnnualRatePercent === "number"
                ? draft.metadata.statutoryAnnualRatePercent
                : 0,
            statutoryBaseRatePercent:
              typeof draft.metadata.statutoryBaseRatePercent === "number"
                ? draft.metadata.statutoryBaseRatePercent
                : 0,
            dailyInterest:
              typeof draft.metadata.statutoryDailyInterest === "number"
                ? draft.metadata.statutoryDailyInterest
                : 0,
            assumptionNote:
              typeof draft.metadata.latePaymentAssumptionNote === "string"
                ? draft.metadata.latePaymentAssumptionNote
                : "Estimated UK B2B statutory late-payment charges.",
          }
        : undefined,
    urgency,
    reason: draft.reason,
    proposedAction:
      typeof draft.metadata.recommendedAction === "string"
        ? draft.metadata.recommendedAction
        : draft.reason,
    expectedCashImpact: draft.expectedImpact.amount,
    hoursToImpact: isReengagement
      ? Math.max(24, Math.round((daysSilent ?? 90) * 2))
      : Math.max(24, Math.round((daysOverdue ?? 0) * 12)),
    confidence: normalizeConfidence(draft.metadata),
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
    statutoryInterest: item.statutoryInterest?.amount,
    fixedCompensation: item.fixedCompensation?.amount,
    overdueBalanceWithCharges: item.overdueBalanceWithCharges?.amount,
    statutoryAnnualRatePercent: item.statutoryAnnualRatePercent,
    statutoryBaseRatePercent: item.statutoryBaseRatePercent,
    latePaymentAssumptionNote: item.latePaymentAssumptionNote,
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
  lastMonthCashFlow: number;
  lastMonthCashFlowAvailable: boolean;
  currentCashSource: "bank" | "derived";
  currentCashNote?: string;
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
      lastMonthCashFlow: data.lastMonthCashFlow ?? 0,
      lastMonthCashFlowAvailable: data.lastMonthCashFlowAvailable ?? false,
      currentCashSource: data.currentCashSource ?? "derived",
      currentCashNote: data.currentCashNote,
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
      lastMonthCashFlow: 0,
      lastMonthCashFlowAvailable: false,
      currentCashSource: "derived",
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

function mapActivityLogs(items: ActivityLogItem[]) {
  return items.map((item) => ({
    id: item.id,
    at: item.at,
    actor:
      item.actor === "client"
        ? "Client"
        : item.actor === "agent"
          ? "Voice agent"
          : "UpFlow",
    action: item.title,
    target: item.targetName ?? item.invoiceNumber ?? "Activity",
    rationale: item.detail ?? "",
    humanInLoop: false,
    kind: item.eventType,
    step: item.step,
    channel: item.channel,
    amount: item.amount,
    currency: item.currency,
    draftId: item.draftId,
    status: item.status ?? "completed",
  }));
}

function toControlRoomData(
  summary: ApiEnvelope<SummaryData>,
  liquidity: ApiEnvelope<LiquidityData | LegacyLiquidityData>,
  atRisk: ApiEnvelope<AtRiskData>,
  revenue: ApiEnvelope<RevenueData>,
  logs: ApiEnvelope<ActivityLogData>,
  drafts: NegotiationDraft[],
): ControlRoomData {
  const normalized = normalizeLiquidity(liquidity);
  const lapsedCustomers = mapLapsed(revenue.data.items);
  const revenueOpportunityTotal = revenue.data.estimatedRevenueUnlock.amount;

  return {
    snapshot: {
      orgName: summary.data.organizationName,
      connectedVia: "Xero",
      lastSyncAt: summary.data.lastSyncAt ?? summary.generatedAt,
      totalInvoices: summary.data.totalInvoices,
      contactsCount: summary.data.contactsCount,
      mode: summary.mode,
      currency: "GBP",
      currentCash: normalized.cash,
      currentCashSource: normalized.currentCashSource,
      currentCashNote: normalized.currentCashNote,
      lastMonthCashFlow: normalized.lastMonthCashFlow,
      lastMonthCashFlowAvailable: normalized.lastMonthCashFlowAvailable,
      overdueReceivables: summary.data.overdueReceivables.amount,
      statutoryInterestEstimate: summary.data.statutoryInterestEstimate?.amount,
      fixedCompensationEstimate: summary.data.fixedCompensationEstimate?.amount,
      overdueWithLatePaymentCharges: summary.data.overdueWithLatePaymentCharges?.amount,
      statutoryAnnualRatePercent: summary.data.statutoryAnnualRatePercent,
      statutoryBaseRatePercent: summary.data.statutoryBaseRatePercent,
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
    audit: mapActivityLogs(logs.data.items),
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
  try {
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
  } catch (error) {
    rethrowIfBackendUnreachable(error);
  }
}

export type HealthData = {
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
  elevenLabsConfigured?: boolean;
};

export type XeroOrganization = {
  tenantId: string;
  tenantName: string;
  tenantType: string;
};

export async function fetchXeroOrganizations(): Promise<{
  organizations: XeroOrganization[];
  selectedTenantId: string | null;
  needsSelection: boolean;
}> {
  const res = await fetch(`${API_BASE}/api/xero/organizations`);
  const body = (await res.json()) as {
    ok: boolean;
    data?: {
      organizations: XeroOrganization[];
      selectedTenantId: string | null;
      needsSelection: boolean;
      message?: string;
    };
  };
  if (!res.ok || !body.ok || !body.data) {
    throw new Error(body.data?.message ?? `Failed to fetch organizations: ${res.status}`);
  }
  return body.data;
}

export async function selectXeroOrganization(tenantId: string): Promise<{
  tenantId: string;
  tenantName: string;
  connected: boolean;
}> {
  const envelope = await postJson<{
    tenantId: string;
    tenantName: string;
    connected: boolean;
  }>("/api/xero/select-organization", { tenantId });
  return envelope.data;
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export async function syncXeroData(): Promise<{
  lastSyncAt: string;
  invoicesCount: number;
  contactsCount: number;
  organizationName: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/xero/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as ApiEnvelope<{
      lastSyncAt: string;
      invoicesCount: number;
      contactsCount: number;
      organizationName: string;
    }> & { data?: { message?: string } };
    if (!res.ok || !body.ok) {
      throw new ApiRequestError(
        body.data?.message ?? `Sync failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    return body.data;
  } catch (error) {
    rethrowIfBackendUnreachable(error);
  }
}

export async function fetchHealth(): Promise<HealthData> {
  try {
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
  } catch (error) {
    rethrowIfBackendUnreachable(error);
  }
}

export async function fetchControlRoom(): Promise<ControlRoomData> {
  const [summary, liquidity, atRisk, revenue, logs] = await Promise.all([
    fetchEnvelope<SummaryData>("/api/summary"),
    fetchEnvelope<LiquidityData | LegacyLiquidityData>("/api/liquidity"),
    fetchEnvelope<AtRiskData>("/api/invoices/at-risk"),
    fetchEnvelope<RevenueData>("/api/revenue-opportunities"),
    fetchEnvelope<ActivityLogData>("/api/activity/logs"),
  ]);

  if (summary.mode === "fallback") {
    return seedData;
  }

  warnIfModeMismatch(summary, [
    { label: "/api/liquidity", envelope: liquidity },
    { label: "/api/invoices/at-risk", envelope: atRisk },
    { label: "/api/revenue-opportunities", envelope: revenue },
    { label: "/api/activity/logs", envelope: logs },
  ]);

  // Drafts load in background via draftsQuery — do not block dashboard on LLM calls.
  return toControlRoomData(summary, liquidity, atRisk, revenue, logs, []);
}

export async function fetchReceivablesDraftsBatch(): Promise<NegotiationDraft[]> {
  try {
    const [receivables, reengagement] = await Promise.all([
      fetchEnvelope<{ drafts: BackendNegotiationDraft[] }>(
        "/api/agent/receivables-drafts?fast=1",
      ),
      fetchEnvelope<{ drafts: BackendNegotiationDraft[] }>(
        "/api/agent/reengagement-drafts?fast=1",
      ),
    ]);

    if (receivables.mode === "fallback") {
      return seedData.drafts;
    }

    return [...receivables.data.drafts, ...reengagement.data.drafts].map(mapBackendDraft);
  } catch (error) {
    rethrowIfBackendUnreachable(error);
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
): Promise<{ reply: string; audioUrl?: string; audioProvider?: "elevenlabs" }> {
  const envelope = await postJson<{
    reply: string;
    audioUrl?: string;
    audioProvider?: "elevenlabs";
  }>("/api/voice/chat", {
    token,
    message,
    history,
  });
  return envelope.data;
}

export async function fetchDemoNarration(
  text: string,
): Promise<{ text: string; audioUrl?: string; audioProvider?: "elevenlabs" }> {
  const envelope = await postJson<{
    text: string;
    audioUrl?: string;
    audioProvider?: "elevenlabs";
  }>("/api/demo/narration", { text });
  return envelope.data;
}

export type VoiceTtsResult = {
  fallback: boolean;
  audioBase64?: string;
  mimeType?: string;
  message?: string;
};

export async function fetchVoiceTts(text: string): Promise<VoiceTtsResult> {
  const envelope = await postJson<VoiceTtsResult>("/api/voice/tts", { text });
  return envelope.data;
}

export type VoiceCallReport = {
  contactName: string;
  invoiceNumber: string;
  summary: string;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
  emailSent: boolean;
  recipientEmail?: string;
  message: string;
};

export async function completeVoiceCall(
  token: string,
  transcript: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<VoiceCallReport> {
  const envelope = await postJson<VoiceCallReport>("/api/voice/calls/complete", {
    token,
    transcript,
  });
  return envelope.data;
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
