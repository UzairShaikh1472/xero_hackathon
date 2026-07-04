// Swap seam: maps live backend envelopes into ControlRoomData for the dashboard.
import type {
  ControlRoomData,
  ExecutionResult,
  InvoiceRisk,
  LapsedCustomer,
  NegotiationDraft,
  RepeatBuyer,
} from "./types";
import { seedData } from "./seed";

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

async function fetchEnvelope<T>(path: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Xero rate limit reached — wait a minute and click Retry");
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

function daysFromReason(reason: string): number {
  const match = reason.match(/(\d+)\s+days?/i);
  return match ? Number(match[1]) : 0;
}

function avgInvoiceFromReason(reason: string): number {
  const match = reason.match(/average invoice value of\s+[A-Z]{3}\s+(\d+(?:\.\d+)?)/i);
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
      // Backend estimates recovery as ~35% of outstanding; invert for a rough LTV stand-in.
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
): ControlRoomData {
  const normalized = normalizeLiquidity(liquidity);
  const lapsedCustomers = mapLapsed(revenue.data.items);
  // Lapsed-customer value only — repeat-buyer upsell isn't "recovery," and lapsed
  // value already double-counts against overdue receivables for anyone also at risk
  // (see recoverableCash, which is the honest overdue-recovery number).
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
    drafts: [],
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

  // No Xero connection yet: show the curated Acme Trading Co. demo dataset
  // (with narrative negotiation drafts + audit trail) instead of the thin
  // synthetic fixtures behind the fallback API endpoints.
  if (summary.mode === "fallback") {
    return seedData;
  }

  warnIfModeMismatch(summary, [
    { label: "/api/liquidity", envelope: liquidity },
    { label: "/api/invoices/at-risk", envelope: atRisk },
    { label: "/api/revenue-opportunities", envelope: revenue },
  ]);

  return toControlRoomData(summary, liquidity, atRisk, revenue);
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
    note: `Simulated ${draft.agent === "receivables" ? "collection" : "extension"} — no Xero write-back performed.`,
  };
}
