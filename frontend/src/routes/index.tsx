import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Landmark,
  Play,
  RefreshCw,
  TrendingDown,

  TrendingUp,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { fetchControlRoom, fetchHealth, fetchXeroAuthUrl, simulateExecute } from "@/lib/kinetic/api";
import { gbp, pct, timeAgo } from "@/lib/kinetic/format";
import type {
  ExecutionResult,
  NegotiationDraft,
  Urgency,
} from "@/lib/kinetic/types";

const controlRoomQuery = queryOptions({
  queryKey: ["kinetic", "control-room"],
  queryFn: () => fetchControlRoom(),
  staleTime: 60_000,
  refetchOnWindowFocus: false,
});

const healthQuery = queryOptions({
  queryKey: ["kinetic", "health"],
  queryFn: () => fetchHealth(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/")({
  component: ControlRoom,
});

// ────────────────────────────────────────────────────────────────────────────

function ControlRoom() {
  const { data, isPending, isError, error, refetch, isFetching } =
    useQuery(controlRoomQuery);
  const { data: health } = useQuery(healthQuery);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("xero") === "connected") {
      refetch();
      params.delete("xero");
      const next = params.toString();
      window.history.replaceState(
        {},
        "",
        next ? `${window.location.pathname}?${next}` : window.location.pathname,
      );
    }
  }, [refetch]);
  const [openDraft, setOpenDraft] = useState<NegotiationDraft | null>(null);
  const [executions, setExecutions] = useState<ExecutionResult[]>([]);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [connectingXero, setConnectingXero] = useState(false);

  const handleConnectXero = async () => {
    setConnectingXero(true);
    try {
      const status = health ?? (await fetchHealth());
      if (!status.xeroConfigured) {
        alert(
          "Xero is not configured on the backend.\n\nAdd XERO_CLIENT_ID and XERO_CLIENT_SECRET to .env (from developer.xero.com), set the redirect URI to http://localhost:3001/api/xero/callback, then restart the backend.",
        );
        return;
      }
      const authUrl = await fetchXeroAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not start Xero connection");
    } finally {
      setConnectingXero(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Syncing with Xero…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-foreground">
        <AlertTriangle className="size-8 text-critical" />
        <p className="text-center text-sm text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "Could not load dashboard data from the backend."}
        </p>
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          Retry
        </Button>
      </div>
    );
  }

  const executedTotal = executions.reduce((s, e) => s + e.cashImpact, 0);
  const projectedShortfall = data.liquidity.projectedShortfall + executedTotal;

  const handleSimulate = async (draft: NegotiationDraft) => {
    const res = await simulateExecute(draft, projectedShortfall);
    setExecutions((prev) => [...prev.filter((e) => e.draftId !== draft.id), res]);
  };

  const activeAnchor = tourStep !== null ? TOUR_STEPS[tourStep].anchor : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "var(--gradient-glow)" }}
      />

      <Header
        orgName={data.snapshot.orgName}
        mode={data.snapshot.mode}
        lastSyncAt={data.snapshot.lastSyncAt}
        xeroConfigured={health?.xeroConfigured ?? false}
        isFetching={isFetching}
        connectingXero={connectingXero}
        onConnectXero={handleConnectXero}
        onRefresh={() => refetch()}
        onReset={() => {
          setExecutions([]);
          setTourStep(null);
        }}
        onStartTour={() => setTourStep(0)}
      />


      <main className="mx-auto max-w-[1440px] px-4 py-6 space-y-6 sm:px-6">
        <TourAnchor id="kpi" active={activeAnchor === "kpi"}>
          <KpiStrip
            mode={data.snapshot.mode}
            currentCash={data.snapshot.currentCash + executedTotal}
            projectedShortfall={projectedShortfall}
            baselineShortfall={data.liquidity.projectedShortfall}
            overdueReceivables={data.snapshot.overdueReceivables}
            opportunityTotal={data.snapshot.revenueOpportunityTotal}
            executedTotal={executedTotal}
          />
        </TourAnchor>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <TourAnchor id="cash" active={activeAnchor === "cash"}>
            <CashFlowLens data={data} onOpen={setOpenDraft} />
          </TourAnchor>
          <TourAnchor id="revenue" active={activeAnchor === "revenue"}>
            <RevenueLens data={data} onOpen={setOpenDraft} />
          </TourAnchor>
        </div>

        <TourAnchor id="agents" active={activeAnchor === "agents"}>
          <AgentsBand
            drafts={data.drafts}
            executions={executions}
            onOpen={setOpenDraft}
          />
        </TourAnchor>

        <TourAnchor id="audit" active={activeAnchor === "audit"}>
          <AuditRail
            audit={data.audit}
            executions={executions}
            drafts={data.drafts}
          />
        </TourAnchor>

        <footer className="pt-6 pb-10 text-center text-xs text-muted-foreground">
          UpFlow · deterministic financial logic + agentic recommendations ·
          {data.snapshot.mode === "live" ? "live Xero data" : "fallback dataset"}
        </footer>
      </main>

      <ApprovalDrawer
        draft={openDraft}
        execution={
          openDraft ? executions.find((e) => e.draftId === openDraft.id) ?? null : null
        }
        onClose={() => setOpenDraft(null)}
        onSimulate={handleSimulate}
      />

      <DemoTour

        step={tourStep}
        onNext={() =>
          setTourStep((s) =>
            s === null ? null : s + 1 >= TOUR_STEPS.length ? null : s + 1,
          )
        }
        onPrev={() => setTourStep((s) => (s === null || s === 0 ? s : s - 1))}
        onClose={() => setTourStep(null)}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Header

function Header({
  orgName,
  mode,
  lastSyncAt,
  xeroConfigured,
  isFetching,
  connectingXero,
  onConnectXero,
  onRefresh,
  onReset,
  onStartTour,
}: {
  orgName: string;
  mode: "live" | "fallback";
  lastSyncAt: string;
  xeroConfigured: boolean;
  isFetching: boolean;
  connectingXero: boolean;
  onConnectXero: () => void;
  onRefresh: () => void;
  onReset: () => void;
  onStartTour: () => void;
}) {

  return (
    <header className="border-b hairline bg-surface/60 backdrop-blur">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:flex sm:flex-wrap sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground overflow-hidden shadow-sm">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M7 19H14M10.5 19V11.5C10.5 8.5 12 7 14.5 7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6.5 13H18M18 13L14.75 9.75M18 13L14.75 16.25"
                stroke="var(--accent)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-sans text-lg font-semibold">UpFlow</span>
            </div>

            <div className="truncate text-sm text-muted-foreground">
              Connected to <span className="text-foreground">{orgName}</span> via Xero ·
              last sync {timeAgo(lastSyncAt)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 border-hairline",
              mode === "live"
                ? "border-positive/30 bg-positive/10 text-positive"
                : "text-warning",
            )}
          >
            <CircleDot className="size-3" />
            {mode === "live" ? "Live from Xero" : "Demo Dataset"}
          </Badge>
          {mode === "fallback" && xeroConfigured && (
            <Button size="sm" onClick={onConnectXero} disabled={connectingXero}>
              <RefreshCw className={cn("size-3.5", connectingXero && "animate-spin")} />
              Connect Xero
            </Button>
          )}
          {mode === "fallback" && !xeroConfigured && (
            <span className="text-xs text-muted-foreground">
              Add Xero credentials to .env
            </span>
          )}
          <Button size="sm" onClick={onStartTour}>
            <Play className="size-3.5" />
            Start demo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="text-muted-foreground"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground"
          >

            <RefreshCw className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Reset</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// KPI strip

function KpiStrip({
  mode,
  currentCash,
  projectedShortfall,
  baselineShortfall,
  overdueReceivables,
  opportunityTotal,
  executedTotal,
}: {
  mode: "live" | "fallback";
  currentCash: number;
  projectedShortfall: number;
  baselineShortfall: number;
  overdueReceivables: number;
  opportunityTotal: number;
  executedTotal: number;
}) {
  const gapDelta = projectedShortfall - baselineShortfall;
  return (
    <div className="rounded-[calc(var(--radius-2xl)+6px)] border-2 border-accent bg-accent/[0.06] p-1">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          <h2 className="font-serif text-xl leading-none tracking-tight text-foreground">
            Your four key numbers
          </h2>
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {mode === "live" ? "Live from Xero" : "Demo dataset"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <KpiCard
          label="Current cash"
          value={gbp(currentCash)}
          hint="Across connected Xero bank feeds"
          icon={<Landmark className="size-4" />}
          trend={executedTotal > 0 ? { value: gbp(executedTotal, { signed: true }), positive: true } : undefined}
        />
        <KpiCard
          label="Projected 30-day gap"
          value={gbp(projectedShortfall)}
          hint="Inflows − outflows over horizon"
          icon={<TrendingDown className="size-4" />}
          tone={projectedShortfall < 0 ? "critical" : "positive"}
          trend={
            gapDelta !== 0
              ? { value: gbp(gapDelta, { signed: true }), positive: gapDelta > 0 }
              : undefined
          }
        />
        <KpiCard
          label="Overdue receivables"
          value={gbp(overdueReceivables)}
          hint="Ranked at-risk in Cash Flow Lens"
          icon={<AlertTriangle className="size-4" />}
          tone="warning"
        />
        <KpiCard
          label="Revenue opportunities"
          value={gbp(opportunityTotal)}
          hint="Lapsed + repeat + upsell potential"
          icon={<TrendingUp className="size-4" />}
          tone="positive"
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone,
  trend,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "positive" | "warning" | "critical";
  trend?: { value: string; positive: boolean };
}) {
  const toneClass =
    tone === "critical"
      ? "text-critical"
      : tone === "warning"
        ? "text-warning"
        : tone === "positive"
          ? "text-positive"
          : "text-foreground";
  return (
    <div
      className="panel p-5"
      style={{ boxShadow: "var(--shadow-elevated)" }}
    >
      <div className="flex items-center justify-between text-sm uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className="text-muted-foreground/70">{icon}</span>
      </div>
      <div className={cn("numeric mt-3 text-2xl", toneClass)}>{value}</div>
      <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
        <span>{hint}</span>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-1 numeric",
              trend.positive ? "text-positive" : "text-critical",
            )}
          >
            <ArrowUpRight
              className={cn("size-3.5", !trend.positive && "rotate-90")}
            />
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Cash Flow Lens

function CashFlowLens({
  data,
  onOpen,
}: {
  data: Awaited<ReturnType<typeof fetchControlRoom>>;
  onOpen: (d: NegotiationDraft) => void;
}) {
  const draftByInvoice = useMemo(() => {
    const m = new Map<string, NegotiationDraft>();
    data.drafts.forEach((d) => m.set(d.targetName, d));
    return m;
  }, [data.drafts]);

  return (
    <section className="panel p-6">
      <LensHeader
        icon={<Activity className="size-4" />}
        title="Cash Flow Lens"
        subtitle="Deterministic liquidity signals from Xero"
      />

      <div className="mt-5 grid grid-cols-3 gap-3">
        <MetricTile label="DSO" value={`${data.liquidity.dso.toFixed(1)}d`} hint="Days sales outstanding" />
        <MetricTile label="DPO" value={`${data.liquidity.dpo.toFixed(1)}d`} hint="Days payables outstanding" />
        <MetricTile
          label="CCC"
          value={`${data.liquidity.ccc.toFixed(1)}d`}
          hint="Cash conversion cycle"
          tone={data.liquidity.ccc > 10 ? "warning" : "positive"}
        />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium">30-day cash projection</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Daily inflows, outflows and running balance
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border hairline bg-positive/10 px-2.5 py-1 text-sm numeric text-positive">
              + {gbp(data.liquidity.projectedInflow)} in
            </div>
            <div className="rounded-full border hairline bg-critical/10 px-2.5 py-1 text-sm numeric text-critical">
              − {gbp(data.liquidity.projectedOutflow)} out
            </div>
          </div>
        </div>
        <div className="h-64 rounded-2xl bg-surface-2 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.liquidity.daily} barGap={2}>
              <defs>
                <linearGradient id="balance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1C1917" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#1C1917" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E5E1DA" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: "#78716C", fontSize: 13 }}
                axisLine={false}
                tickLine={false}
                minTickGap={8}
              />
              <YAxis
                tick={{ fill: "#78716C", fontSize: 13 }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v) => `£${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E1DA",
                  borderRadius: 12,
                  fontSize: 13,
                }}
                labelStyle={{ color: "#78716C" }}
                formatter={(v: number, name: string) => [gbp(v), name]}
                labelFormatter={(l) => `Day ${l}`}
              />
              <Legend
                verticalAlign="top"
                height={24}
                iconType="circle"
                wrapperStyle={{ fontSize: 12, color: "#78716C" }}
              />
              <Bar dataKey="inflow" name="Inflow" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={10} />
              <Bar dataKey="outflow" name="Outflow" fill="#dc2626" radius={[3, 3, 0, 0]} maxBarSize={10} />
              <Area
                type="monotone"
                dataKey="balance"
                name="Balance"
                stroke="#1C1917"
                fill="url(#balance)"
                strokeWidth={2.5}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>



      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">At-risk invoices</div>
          <div className="text-sm text-muted-foreground">
            {data.atRiskInvoices.length} ranked by risk score
          </div>
        </div>
        <div className="divide-y divide-hairline">
          {data.atRiskInvoices.map((inv) => {
            const draft = draftByInvoice.get(inv.customer);
            return (
              <div
                key={inv.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{inv.customer}</span>
                    <span className="text-sm text-muted-foreground numeric shrink-0">
                      #{inv.id.slice(-4)}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {inv.reason}
                  </div>
                </div>
                <div className="numeric text-right shrink-0">
                  <div className="font-medium">{gbp(inv.amount)}</div>
                  <div className="text-sm text-critical">
                    {inv.daysOverdue}d overdue
                  </div>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:contents">
                  <RiskPill score={inv.riskScore} />
                  <Button
                    size="sm"
                    variant={draft ? "default" : "outline"}
                    disabled={!draft}
                    onClick={() => draft && onOpen(draft)}
                    className={cn(!draft && "border-hairline")}
                  >
                    {draft ? "Review draft" : "No draft"}
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RiskPill({ score }: { score: number }) {
  const tone =
    score >= 85 ? "bg-critical/15 text-critical" :
    score >= 65 ? "bg-warning/15 text-warning" :
    "bg-info/15 text-info";
  return (
    <span className={cn("numeric rounded-full px-2 py-0.5 text-sm", tone)}>
      {score}
    </span>
  );
}

function MetricTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "positive" | "warning" | "critical";
}) {
  return (
    <div className="rounded-xl border hairline bg-surface-2/60 p-3">
      <div className="text-sm uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "numeric mt-1 text-2xl",
          tone === "warning" && "text-warning",
          tone === "critical" && "text-critical",
          tone === "positive" && "text-positive",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Revenue Lens

function RevenueLens({
  data,
  onOpen,
}: {
  data: Awaited<ReturnType<typeof fetchControlRoom>>;
  onOpen: (d: NegotiationDraft) => void;
}) {
  const draftByCustomer = useMemo(() => {
    const m = new Map<string, NegotiationDraft>();
    data.drafts.forEach((d) => m.set(d.targetName, d));
    return m;
  }, [data.drafts]);

  const recovery =
    data.lapsedCustomers.reduce((s, c) => s + c.recoveryPotential, 0) +
    data.repeatBuyers.reduce((s, c) => s + c.upsellPotential, 0);

  return (
    <section className="panel p-6">
      <LensHeader
        icon={<TrendingUp className="size-4" />}
        title="Revenue Lens"
        subtitle="Where cash can come back faster"
        right={
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Est. recovery
            </div>
            <div className="numeric text-xl text-positive">{gbp(recovery)}</div>
          </div>
        }
      />

      <div className="mt-5">
        <SectionLabel icon={<Users className="size-3.5" />} text="Lapsed customers" />
        <ul className="mt-2 space-y-2">
          {data.lapsedCustomers.map((c) => {
            const draft = draftByCustomer.get(c.name);
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border hairline bg-surface-2/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-sm text-muted-foreground">
                    LTV <span className="numeric">{gbp(c.ltv, { compact: true })}</span> ·
                    silent <span className="numeric">{c.daysSilent}d</span>
                  </div>
                </div>
                <div className="numeric text-sm text-positive">
                  +{gbp(c.recoveryPotential)}
                </div>
                <Button
                  size="sm"
                  variant={draft ? "default" : "outline"}
                  disabled={!draft}
                  onClick={() => draft && onOpen(draft)}
                  className={cn(!draft && "border-hairline")}
                >
                  {draft ? "Draft" : "—"}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-5">
        <SectionLabel icon={<Users className="size-3.5" />} text="Repeat buyers" />
        <ul className="mt-2 space-y-2">
          {data.repeatBuyers.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border hairline bg-surface-2/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-sm text-muted-foreground numeric">
                  {c.transactions12m} orders / 12m · avg {gbp(c.avgInvoice)}
                </div>
              </div>
              <div className="numeric text-sm text-positive">
                +{gbp(c.upsellPotential)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm uppercase tracking-wider text-muted-foreground">
      {icon}
      {text}
    </div>
  );
}

function LensHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="grid size-8 place-items-center rounded-xl bg-accent text-accent-foreground">
          {icon}
        </div>
        <div>
          <div className="font-display text-lg font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Agents band

function AgentsBand({
  drafts,
  executions,
  onOpen,
}: {
  drafts: NegotiationDraft[];
  executions: ExecutionResult[];
  onOpen: (d: NegotiationDraft) => void;
}) {
  const receivables = drafts.filter((d) => d.agent === "receivables");
  const payables = drafts.filter((d) => d.agent === "payables");
  const executedIds = new Set(executions.map((e) => e.draftId));

  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-lg font-semibold">Agents at work</div>
          <div className="text-sm text-muted-foreground">
            Rules identify the risk · AI drafts the action · you approve
          </div>
        </div>
        <Badge variant="outline" className="border-hairline gap-1.5">
          <Bot className="size-3" />
          {drafts.length} pending drafts
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgentColumn
          name="Receivables Negotiator"
          drafts={receivables}
          executedIds={executedIds}
          onOpen={onOpen}
          accent="positive"
        />
        <AgentColumn
          name="Payables Negotiator"
          drafts={payables}
          executedIds={executedIds}
          onOpen={onOpen}
          accent="info"
        />
      </div>
    </section>
  );
}

function AgentColumn({
  name,
  drafts,
  executedIds,
  onOpen,
  accent,
}: {
  name: string;
  drafts: NegotiationDraft[];
  executedIds: Set<string>;
  onOpen: (d: NegotiationDraft) => void;
  accent: "positive" | "info";
}) {
  return (
    <div className="rounded-2xl border hairline bg-surface-2/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-7 place-items-center rounded-md",
              accent === "positive" ? "bg-positive/15 text-positive" : "bg-info/15 text-info",
            )}
          >
            <Bot className="size-4" />
          </span>
          <div className="font-medium">{name}</div>
        </div>
        <div className="text-sm text-foreground numeric">
          {drafts.length} queued
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {drafts.map((d) => (
          <button
            key={d.id}
            onClick={() => onOpen(d)}
            className="group flex w-full items-start justify-between gap-3 rounded-xl border hairline bg-surface p-3 text-left transition-colors hover:border-primary/40"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <UrgencyDot u={d.urgency} />
                <span className="font-medium truncate">{d.targetName}</span>
                {executedIds.has(d.id) && (
                  <Badge className="bg-positive/15 text-positive border-0 gap-1 h-5">
                    <CheckCircle2 className="size-3" /> Simulated
                  </Badge>
                )}
              </div>
              <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {d.reason}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="numeric text-sm text-positive">
                  +{gbp(d.expectedCashImpact)} in ~{d.hoursToImpact}h
                </span>
                <span>·</span>
                <span>confidence {pct(d.confidence)}</span>
              </div>
            </div>
            <ChevronRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

function UrgencyDot({ u }: { u: Urgency }) {
  const c =
    u === "critical" ? "bg-critical" :
    u === "high" ? "bg-warning" :
    u === "medium" ? "bg-info" : "bg-muted-foreground";
  return <span className={cn("size-2 rounded-full", c)} />;
}

// ────────────────────────────────────────────────────────────────────────────
// Audit rail

function AuditRail({
  audit,
  executions,
  drafts,
}: {
  audit: Awaited<ReturnType<typeof fetchControlRoom>>["audit"];
  executions: ExecutionResult[];
  drafts: NegotiationDraft[];
}) {
  const entries = [
    ...executions.map((e) => {
      const d = drafts.find((x) => x.id === e.draftId);
      return {
        id: `exec-${e.draftId}`,
        at: e.executedAt,
        actor: d?.agent === "receivables" ? "Receivables Agent" : "Payables Agent",
        action: "Simulated execution",
        target: `${d?.targetName ?? ""} · ${gbp(e.cashImpact, { signed: true })}`,
        rationale: e.note,
        humanInLoop: true,
      };
    }),
    ...audit,
  ];

  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-lg font-semibold">Audit trail</div>
          <div className="text-sm text-muted-foreground">
            Every recommendation has a rationale and a human sign-off
          </div>
        </div>
      </div>
      <ul className="mt-4 divide-y divide-hairline">
        {entries.map((e) => (
          <li key={e.id} className="flex items-start gap-4 py-3 text-sm">
            <div className="numeric w-16 shrink-0 text-sm text-muted-foreground">
              {timeAgo(e.at)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.actor}</span>
                <span className="text-muted-foreground">{e.action}</span>
                <span className="text-foreground">{e.target}</span>
                {e.humanInLoop && (
                  <Badge variant="outline" className="border-hairline text-xs h-5">
                    Human in loop
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">{e.rationale}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Approval drawer

function ApprovalDrawer({
  draft,
  execution,
  onClose,
  onSimulate,
}: {
  draft: NegotiationDraft | null;
  execution: ExecutionResult | null;
  onClose: () => void;
  onSimulate: (d: NegotiationDraft) => void;
}) {
  const [body, setBody] = useState("");
  const activeId = draft?.id;
  useEffect(() => {
    if (draft) setBody(draft.body);
  }, [activeId, draft]);

  return (
    <Sheet open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-surface border-l hairline flex flex-col"
      >
        {draft && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display flex items-center gap-2">
                <UrgencyDot u={draft.urgency} />
                {draft.agent === "receivables" ? "Collect" : "Extend"} · {draft.targetName}
              </SheetTitle>
              <SheetDescription className="text-muted-foreground">
                {draft.proposedAction}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="-mx-6 flex-1 px-6">
              <div className="space-y-5 py-4">
                <div className="grid grid-cols-3 gap-2">
                  <StatBlock label="Expected cash" value={gbp(draft.expectedCashImpact, { signed: true })} tone="positive" />
                  <StatBlock label="Impact ETA" value={`~${draft.hoursToImpact}h`} />
                  <StatBlock label="Confidence" value={pct(draft.confidence)} />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Rationale</div>
                  <p className="mt-1 text-sm">{draft.reason}</p>
                </div>

                <Separator className="bg-hairline" />

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                    <span>Draft message</span>
                    <span>Subject: {draft.subject}</span>
                  </div>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="bg-surface-2 border-hairline font-sans text-sm"
                  />
                </div>

                {execution && (
                  <div className="rounded-md border border-positive/40 bg-positive/10 p-3 text-sm">
                    <div className="flex items-center gap-2 font-medium text-positive">
                      <CheckCircle2 className="size-4" />
                      Simulated
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{execution.note}</div>
                    <div className="mt-2 numeric text-xs">
                      New projected 30-day gap:{" "}
                      <span className="text-foreground">
                        {gbp(execution.newProjectedShortfall)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <SheetFooter className="flex-row justify-between border-t hairline pt-4">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onSimulate(draft)}
                  className="border-hairline"
                >
                  Simulate execution
                </Button>
                <Button onClick={() => onSimulate(draft)}>Approve & send</Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive";
}) {
  return (
    <div className="rounded-xl border hairline bg-surface-2/60 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("numeric mt-1 text-lg", tone === "positive" && "text-positive")}>
        {value}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Guided demo tour — walks the user through key dashboard moments.

type TourAnchorId = "kpi" | "cash" | "revenue" | "agents" | "audit";

interface TourStep {
  anchor: TourAnchorId;
  title: string;
  body: string;
  action?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    anchor: "kpi",
    title: "The 30-second read",
    body:
      "Acme has £48k on hand today but is projected to run a cash gap inside 30 days. Overdue receivables are £62k — the money already exists, it's just stuck.",
  },
  {
    anchor: "cash",
    title: "Cash Flow Lens — deterministic",
    body:
      "DSO / DPO / CCC are computed from real Xero invoices and payments. The chart shows the projected day-14 dip when payroll and supplier bills bunch.",
  },
  {
    anchor: "revenue",
    title: "Revenue Lens — cash you already earned",
    body:
      "Same Xero data, different question: who used to buy and stopped? Blackwood & Sons is a 92-day-silent £84k LTV account. That's £12.8k recoverable this week.",
  },
  {
    anchor: "agents",
    title: "Agents draft the action",
    body:
      "Rules identified the risk. AI drafts the message — subject, body, tone, expected cash impact, confidence. Open Northwind's draft to review.",
    action: "Open a draft →",
  },
  {
    anchor: "audit",
    title: "Approve, simulate, audit",
    body:
      "Every action is human-approved. Simulate shows the post-execution cash impact before it touches Xero. Every recommendation is logged with a rationale.",
  },
];

function TourAnchor({
  id,
  active,
  children,
}: {
  id: TourAnchorId;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      id={`tour-${id}`}
      className={cn(
        "scroll-mt-24 rounded-lg transition-all duration-300",
        active && "ring-2 ring-primary ring-offset-4 ring-offset-background",
      )}
    >
      {children}
    </div>
  );
}

function DemoTour({
  step,
  onNext,
  onPrev,
  onClose,
}: {
  step: number | null;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (step === null) return;
    const el = document.getElementById(`tour-${TOUR_STEPS[step].anchor}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  if (step === null) return null;
  const s = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-w-sm">
      <div
        className="panel p-4 shadow-2xl backdrop-blur"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary border-0">
              Step {step + 1} / {TOUR_STEPS.length}
            </Badge>
            <span className="font-display text-sm font-semibold">{s.title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close demo"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
        {s.action && (
          <div className="mt-2 text-xs text-primary">{s.action}</div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 w-6 rounded-full",
                  i <= step ? "bg-primary" : "bg-hairline",
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={onPrev}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={isLast ? onClose : onNext}>
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight className="size-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

