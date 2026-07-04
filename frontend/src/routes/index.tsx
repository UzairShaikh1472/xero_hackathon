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
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Landmark,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
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
import {
  fetchControlRoom,
  fetchHealth,
  fetchXeroAuthUrl,
  placeReminderCall,
  sendReminderEmail,
  simulateExecute,
} from "@/lib/kinetic/api";
import { formatMoney, pct, timeAgo } from "@/lib/kinetic/format";
import type {
  AuditEntry,
  CommunicationResult,
  ControlRoomData,
  ExecutionResult,
  NegotiationDraft,
  Urgency,
} from "@/lib/kinetic/types";
import { cn } from "@/lib/utils";

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

function ControlRoom() {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery(controlRoomQuery);
  const { data: health } = useQuery(healthQuery);
  const [openDraft, setOpenDraft] = useState<NegotiationDraft | null>(null);
  const [executions, setExecutions] = useState<ExecutionResult[]>([]);
  const [communications, setCommunications] = useState<CommunicationResult[]>([]);
  const [connectingXero, setConnectingXero] = useState(false);

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

  const handleConnectXero = async () => {
    setConnectingXero(true);
    try {
      const status = health ?? (await fetchHealth());
      if (!status.xeroConfigured) {
        alert(
          "Xero is not configured on the backend.\n\nAdd XERO_CLIENT_ID and XERO_CLIENT_SECRET to .env, confirm the redirect URI, then restart the backend.",
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
        <p className="text-sm text-muted-foreground">Syncing with Xero...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-foreground">
        <AlertTriangle className="size-8 text-critical" />
        <p className="text-center text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Could not load dashboard data from the backend."}
        </p>
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          Retry
        </Button>
      </div>
    );
  }

  const currency = data.snapshot.currency;
  const money = (value: number, opts?: { signed?: boolean; compact?: boolean }) =>
    formatMoney(currency, value, opts);
  const executedTotal = executions.reduce((sum, item) => sum + item.cashImpact, 0);
  const projectedGap = data.liquidity.projectedShortfall + executedTotal;

  const handleSimulate = async (draft: NegotiationDraft) => {
    const result = await simulateExecute(draft, projectedGap);
    setExecutions((prev) => [...prev.filter((item) => item.draftId !== draft.id), result]);
  };

  const handleSendEmail = async (draft: NegotiationDraft) => {
    const result = await sendReminderEmail(draft);
    setCommunications((prev) => [...prev.filter((item) => item.draftId !== draft.id || item.channel !== "email"), result]);
  };

  const handlePlaceCall = async (draft: NegotiationDraft) => {
    const result = await placeReminderCall(draft);
    setCommunications((prev) => [...prev.filter((item) => item.draftId !== draft.id || item.channel !== "call"), result]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
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
          setCommunications([]);
        }}
      />

      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
        <KpiStrip
          currency={currency}
          mode={data.snapshot.mode}
          currentCash={data.snapshot.currentCash + executedTotal}
          projectedGap={projectedGap}
          baselineGap={data.liquidity.projectedShortfall}
          overdueReceivables={data.snapshot.overdueReceivables}
          opportunityTotal={data.snapshot.revenueOpportunityTotal}
          executedTotal={executedTotal}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <CashFlowLens data={data} currency={currency} onOpen={setOpenDraft} />
          <RevenueLens data={data} currency={currency} onOpen={setOpenDraft} />
        </div>

        <AgentsBand
          currency={currency}
          drafts={data.drafts}
          executions={executions}
          communications={communications}
          onOpen={setOpenDraft}
        />

        <AuditRail
          currency={currency}
          audit={data.audit}
          drafts={data.drafts}
          executions={executions}
          communications={communications}
        />
      </main>

      <ApprovalDrawer
        currency={currency}
        health={health ?? null}
        draft={openDraft}
        execution={openDraft ? executions.find((item) => item.draftId === openDraft.id) ?? null : null}
        communication={openDraft ? communications.find((item) => item.draftId === openDraft.id) ?? null : null}
        onClose={() => setOpenDraft(null)}
        onSimulate={handleSimulate}
        onSendEmail={handleSendEmail}
        onPlaceCall={handlePlaceCall}
      />
    </div>
  );
}

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
}) {
  return (
    <header className="border-b hairline bg-surface/60 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Landmark className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="font-sans text-lg font-semibold">UpFlow</div>
            <div className="truncate text-sm text-muted-foreground">
              Connected to <span className="text-foreground">{orgName}</span> via Xero · last sync {timeAgo(lastSyncAt)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 border-hairline",
              mode === "live" ? "border-positive/30 bg-positive/10 text-positive" : "text-warning",
            )}
          >
            <CircleDot className="size-3" />
            {mode === "live" ? "Live from Xero" : "Fallback dataset"}
          </Badge>
          {mode === "fallback" && xeroConfigured && (
            <Button size="sm" onClick={onConnectXero} disabled={connectingXero}>
              <RefreshCw className={cn("size-3.5", connectingXero && "animate-spin")} />
              Connect Xero
            </Button>
          )}
          {mode === "fallback" && !xeroConfigured && (
            <span className="text-xs text-muted-foreground">Add Xero credentials to `.env`</span>
          )}
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isFetching}>
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>
    </header>
  );
}

function KpiStrip({
  currency,
  mode,
  currentCash,
  projectedGap,
  baselineGap,
  overdueReceivables,
  opportunityTotal,
  executedTotal,
}: {
  currency: string;
  mode: "live" | "fallback";
  currentCash: number;
  projectedGap: number;
  baselineGap: number;
  overdueReceivables: number;
  opportunityTotal: number;
  executedTotal: number;
}) {
  const money = (value: number, opts?: { signed?: boolean; compact?: boolean }) =>
    formatMoney(currency, value, opts);

  return (
    <section className="rounded-[calc(var(--radius-2xl)+6px)] border-2 border-accent bg-accent/[0.06] p-1">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          <h2 className="font-serif text-xl leading-none tracking-tight text-foreground">Your four key numbers</h2>
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {mode === "live" ? "Live from Xero" : "Fallback mode"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Current cash"
          value={money(currentCash)}
          hint="Across connected Xero bank feeds"
          icon={<Landmark className="size-4" />}
          trend={executedTotal > 0 ? { value: money(executedTotal, { signed: true }), positive: true } : undefined}
        />
        <KpiCard
          label="Projected 30-day position"
          value={money(projectedGap)}
          hint="Inflows minus outflows over horizon"
          icon={<TrendingDown className="size-4" />}
          tone={projectedGap < 0 ? "critical" : "positive"}
          trend={
            projectedGap !== baselineGap
              ? { value: money(projectedGap - baselineGap, { signed: true }), positive: projectedGap > baselineGap }
              : undefined
          }
        />
        <KpiCard
          label="Overdue receivables"
          value={money(overdueReceivables)}
          hint="Ranked at risk in Cash Flow Lens"
          icon={<AlertTriangle className="size-4" />}
          tone="warning"
        />
        <KpiCard
          label="Revenue opportunities"
          value={money(opportunityTotal)}
          hint="Lapsed and repeat-buyer potential"
          icon={<TrendingUp className="size-4" />}
          tone="positive"
        />
      </div>
    </section>
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
  return (
    <div className="panel p-5" style={{ boxShadow: "var(--shadow-elevated)" }}>
      <div className="flex items-center justify-between text-sm uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className="text-muted-foreground/70">{icon}</span>
      </div>
      <div
        className={cn(
          "numeric mt-3 text-2xl",
          tone === "critical" && "text-critical",
          tone === "warning" && "text-warning",
          tone === "positive" && "text-positive",
        )}
      >
        {value}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
        <span>{hint}</span>
        {trend && (
          <span className={cn("flex items-center gap-1 numeric", trend.positive ? "text-positive" : "text-critical")}>
            <ArrowUpRight className={cn("size-3.5", !trend.positive && "rotate-90")} />
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

function CashFlowLens({
  data,
  currency,
  onOpen,
}: {
  data: ControlRoomData;
  currency: string;
  onOpen: (draft: NegotiationDraft) => void;
}) {
  const money = (value: number, opts?: { signed?: boolean; compact?: boolean }) =>
    formatMoney(currency, value, opts);
  const draftByTarget = useMemo(() => {
    const map = new Map<string, NegotiationDraft>();
    data.drafts.forEach((draft) => map.set(draft.targetName, draft));
    return map;
  }, [data.drafts]);

  return (
    <section className="panel p-6">
      <LensHeader icon={<Activity className="size-4" />} title="Cash Flow Lens" subtitle="Deterministic liquidity signals from Xero" />

      <div className="mt-5 grid grid-cols-3 gap-3">
        <MetricTile label="DSO" value={`${data.liquidity.dso.toFixed(1)}d`} hint="Days sales outstanding" />
        <MetricTile label="DPO" value={`${data.liquidity.dpo.toFixed(1)}d`} hint="Days payables outstanding" />
        <MetricTile label="CCC" value={`${data.liquidity.ccc.toFixed(1)}d`} hint="Cash conversion cycle" tone={data.liquidity.ccc > 10 ? "warning" : "positive"} />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium">30-day cash projection</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Daily inflows, outflows and running balance</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border hairline bg-positive/10 px-2.5 py-1 text-sm numeric text-positive">
              + {money(data.liquidity.projectedInflow)} in
            </div>
            <div className="rounded-full border hairline bg-critical/10 px-2.5 py-1 text-sm numeric text-critical">
              - {money(data.liquidity.projectedOutflow)} out
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
              <XAxis dataKey="day" tick={{ fill: "#78716C", fontSize: 13 }} axisLine={false} tickLine={false} minTickGap={8} />
              <YAxis tick={{ fill: "#78716C", fontSize: 13 }} axisLine={false} tickLine={false} width={72} tickFormatter={(v) => money(v, { compact: true })} />
              <Tooltip
                contentStyle={{ background: "#FFFFFF", border: "1px solid #E5E1DA", borderRadius: 12, fontSize: 13 }}
                labelStyle={{ color: "#78716C" }}
                formatter={(v: number, name: string) => [money(v), name]}
                labelFormatter={(label) => `Day ${label}`}
              />
              <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: 12, color: "#78716C" }} />
              <Bar dataKey="inflow" name="Inflow" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={10} />
              <Bar dataKey="outflow" name="Outflow" fill="#dc2626" radius={[3, 3, 0, 0]} maxBarSize={10} />
              <Area type="monotone" dataKey="balance" name="Balance" stroke="#1C1917" fill="url(#balance)" strokeWidth={2.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">At-risk invoices</div>
          <div className="text-sm text-muted-foreground">{data.atRiskInvoices.length} ranked by risk score</div>
        </div>
        <div className="divide-y divide-hairline">
          {data.atRiskInvoices.map((invoice) => {
            const draft = draftByTarget.get(invoice.customer);
            return (
              <div
                key={invoice.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{invoice.customer}</span>
                    <span className="shrink-0 text-sm text-muted-foreground numeric">#{invoice.id.slice(-4)}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{invoice.reason}</div>
                </div>
                <div className="numeric shrink-0 text-right">
                  <div className="font-medium">{money(invoice.amount)}</div>
                  <div className="text-sm text-critical">{invoice.daysOverdue}d overdue</div>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:contents">
                  <RiskPill score={invoice.riskScore} />
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

function RevenueLens({
  data,
  currency,
  onOpen,
}: {
  data: ControlRoomData;
  currency: string;
  onOpen: (draft: NegotiationDraft) => void;
}) {
  const money = (value: number, opts?: { signed?: boolean; compact?: boolean }) =>
    formatMoney(currency, value, opts);
  const draftByTarget = useMemo(() => {
    const map = new Map<string, NegotiationDraft>();
    data.drafts.forEach((draft) => map.set(draft.targetName, draft));
    return map;
  }, [data.drafts]);
  const recovery =
    data.lapsedCustomers.reduce((sum, item) => sum + item.recoveryPotential, 0) +
    data.repeatBuyers.reduce((sum, item) => sum + item.upsellPotential, 0);

  return (
    <section className="panel p-6">
      <LensHeader
        icon={<TrendingUp className="size-4" />}
        title="Revenue Lens"
        subtitle="Where cash can come back faster"
        right={
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Estimated recovery</div>
            <div className="numeric text-xl text-positive">{money(recovery)}</div>
          </div>
        }
      />

      <div className="mt-5">
        <SectionLabel icon={<Users className="size-3.5" />} text="Lapsed customers" />
        <ul className="mt-2 space-y-2">
          {data.lapsedCustomers.map((customer) => {
            const draft = draftByTarget.get(customer.name);
            return (
              <li
                key={customer.id}
                className="flex items-center justify-between gap-3 rounded-xl border hairline bg-surface-2/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{customer.name}</div>
                  <div className="text-sm text-muted-foreground">
                    LTV <span className="numeric">{money(customer.ltv, { compact: true })}</span> · silent{" "}
                    <span className="numeric">{customer.daysSilent}d</span>
                  </div>
                </div>
                <div className="numeric text-sm text-positive">+{money(customer.recoveryPotential)}</div>
                <Button
                  size="sm"
                  variant={draft ? "default" : "outline"}
                  disabled={!draft}
                  onClick={() => draft && onOpen(draft)}
                  className={cn(!draft && "border-hairline")}
                >
                  {draft ? "Draft" : "No draft"}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-5">
        <SectionLabel icon={<Users className="size-3.5" />} text="Repeat buyers" />
        <ul className="mt-2 space-y-2">
          {data.repeatBuyers.map((customer) => (
            <li
              key={customer.id}
              className="flex items-center justify-between gap-3 rounded-xl border hairline bg-surface-2/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{customer.name}</div>
                <div className="text-sm text-muted-foreground numeric">
                  {customer.transactions12m} orders / 12m · avg {money(customer.avgInvoice)}
                </div>
              </div>
              <div className="numeric text-sm text-positive">+{money(customer.upsellPotential)}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AgentsBand({
  currency,
  drafts,
  executions,
  communications,
  onOpen,
}: {
  currency: string;
  drafts: NegotiationDraft[];
  executions: ExecutionResult[];
  communications: CommunicationResult[];
  onOpen: (draft: NegotiationDraft) => void;
}) {
  const receivables = drafts.filter((draft) => draft.agent === "receivables");
  const payables = drafts.filter((draft) => draft.agent === "payables");
  const executedIds = new Set(executions.map((item) => item.draftId));
  const communicatedIds = new Set(communications.map((item) => item.draftId));

  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-lg font-semibold">Agents at work</div>
          <div className="text-sm text-muted-foreground">Rules identify the risk. AI drafts the action. You review and simulate.</div>
        </div>
        <Badge variant="outline" className="gap-1.5 border-hairline">
          <Bot className="size-3" />
          {drafts.length} prepared drafts
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgentColumn name="Receivables negotiator" currency={currency} drafts={receivables} executedIds={executedIds} communicatedIds={communicatedIds} onOpen={onOpen} accent="positive" />
        <AgentColumn name="Payables negotiator" currency={currency} drafts={payables} executedIds={executedIds} communicatedIds={communicatedIds} onOpen={onOpen} accent="info" />
      </div>
    </section>
  );
}

function AgentColumn({
  name,
  currency,
  drafts,
  executedIds,
  communicatedIds,
  onOpen,
  accent,
}: {
  name: string;
  currency: string;
  drafts: NegotiationDraft[];
  executedIds: Set<string>;
  communicatedIds: Set<string>;
  onOpen: (draft: NegotiationDraft) => void;
  accent: "positive" | "info";
}) {
  const money = (value: number, opts?: { signed?: boolean; compact?: boolean }) =>
    formatMoney(currency, value, opts);

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
        <div className="numeric text-sm text-foreground">{drafts.length} queued</div>
      </div>

      <div className="mt-3 space-y-2">
        {drafts.map((draft) => (
          <button
            key={draft.id}
            onClick={() => onOpen(draft)}
            className="group flex w-full items-start justify-between gap-3 rounded-xl border hairline bg-surface p-3 text-left transition-colors hover:border-primary/40"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <UrgencyDot urgency={draft.urgency} />
                <span className="truncate font-medium">{draft.targetName}</span>
                {executedIds.has(draft.id) && (
                  <Badge className="h-5 gap-1 border-0 bg-positive/15 text-positive">
                    <CheckCircle2 className="size-3" />
                    Simulated
                  </Badge>
                )}
                {communicatedIds.has(draft.id) && (
                  <Badge className="h-5 border-0 bg-info/15 text-info">Live action</Badge>
                )}
              </div>
              <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{draft.reason}</div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="numeric text-sm text-positive">+{money(draft.expectedCashImpact)} in ~{draft.hoursToImpact}h</span>
                <span>·</span>
                <span>confidence {pct(draft.confidence)}</span>
              </div>
            </div>
            <ChevronRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

function AuditRail({
  currency,
  audit,
  drafts,
  executions,
  communications,
}: {
  currency: string;
  audit: AuditEntry[];
  drafts: NegotiationDraft[];
  executions: ExecutionResult[];
  communications: CommunicationResult[];
}) {
  const money = (value: number, opts?: { signed?: boolean; compact?: boolean }) =>
    formatMoney(currency, value, opts);

  const entries = [
    ...communications.map((communication) => {
      const draft = drafts.find((item) => item.id === communication.draftId);
      return {
        id: `${communication.channel}-${communication.draftId}`,
        at: new Date().toISOString(),
        actor: communication.channel === "call" ? "Collections Voice" : "Collections Email",
        action: communication.channel === "call" ? "Queued outbound call" : "Sent reminder email",
        target: `${communication.recipientName} · ${
          communication.channel === "call"
            ? communication.recipientPhone ?? "no phone"
            : communication.recipientEmail ?? "no email"
        }`,
        rationale: communication.message,
        humanInLoop: true,
      };
    }),
    ...executions.map((execution) => {
      const draft = drafts.find((item) => item.id === execution.draftId);
      return {
        id: `execution-${execution.draftId}`,
        at: execution.executedAt,
        actor:
          draft?.agent === "payables"
            ? "Payables Agent"
            : draft?.agent === "reengagement"
              ? "Revenue Agent"
              : "Receivables Agent",
        action: "Simulated execution",
        target: `${draft?.targetName ?? execution.draftId} · ${money(execution.cashImpact, { signed: true })}`,
        rationale: execution.note,
        humanInLoop: true,
      };
    }),
    ...audit,
  ];

  return (
    <section className="panel p-6">
      <div>
        <div className="font-display text-lg font-semibold">Audit trail</div>
        <div className="text-sm text-muted-foreground">Every recommendation keeps its rationale visible.</div>
      </div>

      <ul className="mt-4 divide-y divide-hairline">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-4 py-3 text-sm">
            <div className="numeric w-16 shrink-0 text-sm text-muted-foreground">{timeAgo(entry.at)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{entry.actor}</span>
                <span className="text-muted-foreground">{entry.action}</span>
                <span className="text-foreground">{entry.target}</span>
                {entry.humanInLoop && (
                  <Badge variant="outline" className="h-5 border-hairline text-xs">
                    Human in loop
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">{entry.rationale}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ApprovalDrawer({
  currency,
  health,
  draft,
  execution,
  communication,
  onClose,
  onSimulate,
  onSendEmail,
  onPlaceCall,
}: {
  currency: string;
  health: Awaited<ReturnType<typeof fetchHealth>> | null;
  draft: NegotiationDraft | null;
  execution: ExecutionResult | null;
  communication: CommunicationResult | null;
  onClose: () => void;
  onSimulate: (draft: NegotiationDraft) => void;
  onSendEmail: (draft: NegotiationDraft) => Promise<void>;
  onPlaceCall: (draft: NegotiationDraft) => Promise<void>;
}) {
  const money = (value: number, opts?: { signed?: boolean; compact?: boolean }) =>
    formatMoney(currency, value, opts);
  const [body, setBody] = useState("");
  const [busyAction, setBusyAction] = useState<"email" | "call" | null>(null);

  useEffect(() => {
    if (draft) {
      setBody(draft.body);
    }
  }, [draft]);

  const daysOverdue = draft?.daysOverdue ?? 0;
  const canSendEmail = Boolean(
    draft &&
      draft.agent === "receivables" &&
      typeof draft.daysOverdue === "number" &&
      draft.daysOverdue < 14 &&
      draft.contactEmail
  );
  const canPlaceCall = Boolean(
    draft &&
      draft.agent === "receivables" &&
      typeof draft.daysOverdue === "number" &&
      draft.daysOverdue >= 15 &&
      draft.contactPhone
  );

  const handleEmail = async () => {
    if (!draft) return;
    setBusyAction("email");
    try {
      await onSendEmail(draft);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Email send failed");
    } finally {
      setBusyAction(null);
    }
  };

  const handleCall = async () => {
    if (!draft) return;
    setBusyAction("call");
    try {
      await onPlaceCall(draft);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Call queue failed");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Sheet open={!!draft} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col border-l hairline bg-surface sm:max-w-lg">
        {draft && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 font-display">
                <UrgencyDot urgency={draft.urgency} />
                {draft.agent === "payables" ? "Extend" : draft.agent === "reengagement" ? "Re-engage" : "Collect"} · {draft.targetName}
              </SheetTitle>
              <SheetDescription className="text-muted-foreground">{draft.proposedAction}</SheetDescription>
            </SheetHeader>

            <ScrollArea className="-mx-6 flex-1 px-6">
              <div className="space-y-5 py-4">
                <div className="grid grid-cols-3 gap-2">
                  <StatBlock label="Expected cash" value={money(draft.expectedCashImpact, { signed: true })} tone="positive" />
                  <StatBlock label="Impact ETA" value={`~${draft.hoursToImpact}h`} />
                  <StatBlock label="Confidence" value={pct(draft.confidence)} />
                </div>

                <div className="rounded-xl border hairline bg-surface-2/60 p-3 text-sm">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Client contact</div>
                  <div className="mt-2 space-y-1">
                    <div>
                      <span className="text-muted-foreground">Email: </span>
                      <span>{draft.contactEmail ?? "Not available in Xero"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone: </span>
                      <span>{draft.contactPhone ?? "Not available in Xero"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Overdue: </span>
                      <span>{daysOverdue} days</span>
                    </div>
                  </div>
                </div>

                {draft.agent === "receivables" && (
                  <div className="rounded-xl border hairline bg-surface-2/60 p-3 text-sm">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Communication rule</div>
                    <div className="mt-2 text-sm">
                      {daysOverdue >= 15
                        ? "15+ days overdue: queue a polite outbound reminder call."
                        : "Under 14 days overdue: send a polite reminder email."}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEmail}
                        disabled={!canSendEmail || busyAction !== null || !health?.emailConfigured}
                        className="border-hairline"
                      >
                        {busyAction === "email" ? "Sending..." : "Send reminder email"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCall}
                        disabled={!canPlaceCall || busyAction !== null || !health?.voiceConfigured}
                        className="border-hairline"
                      >
                        {busyAction === "call" ? "Calling..." : "Place reminder call"}
                      </Button>
                    </div>
                    {!health?.emailConfigured && !health?.voiceConfigured && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Add SMTP and Twilio credentials in `.env` to enable live outreach.
                      </div>
                    )}
                  </div>
                )}

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
                    onChange={(event) => setBody(event.target.value)}
                    rows={10}
                    className="border-hairline bg-surface-2 font-sans text-sm"
                  />
                </div>

                {execution && (
                  <div className="rounded-md border border-positive/40 bg-positive/10 p-3 text-sm">
                    <div className="flex items-center gap-2 font-medium text-positive">
                      <CheckCircle2 className="size-4" />
                      Simulation recorded
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{execution.note}</div>
                    <div className="mt-2 numeric text-xs">
                      Updated 30-day position: <span className="text-foreground">{money(execution.newProjectedShortfall)}</span>
                    </div>
                  </div>
                )}

                {communication && (
                  <div className="rounded-md border border-info/40 bg-info/10 p-3 text-sm">
                    <div className="font-medium text-info">
                      {communication.channel === "call" ? "Call queued" : "Email sent"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{communication.message}</div>
                    {communication.providerId && (
                      <div className="mt-2 text-xs text-muted-foreground">Provider ref: {communication.providerId}</div>
                    )}
                    {communication.scriptPreview && (
                      <div className="mt-2 text-xs text-muted-foreground">{communication.scriptPreview}</div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>

            <SheetFooter className="flex-row justify-between border-t hairline pt-4">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onSimulate(draft)} className="border-hairline">
                  Simulate impact
                </Button>
                <Button onClick={() => onSimulate(draft)}>Approve for demo</Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
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
        <div className="grid size-8 place-items-center rounded-xl bg-accent text-accent-foreground">{icon}</div>
        <div>
          <div className="font-display text-lg font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      {right}
    </div>
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

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm uppercase tracking-wider text-muted-foreground">
      {icon}
      {text}
    </div>
  );
}

function RiskPill({ score }: { score: number }) {
  const tone = score >= 85 ? "bg-critical/15 text-critical" : score >= 65 ? "bg-warning/15 text-warning" : "bg-info/15 text-info";
  return <span className={cn("numeric rounded-full px-2 py-0.5 text-sm", tone)}>{score}</span>;
}

function UrgencyDot({ urgency }: { urgency: Urgency }) {
  const tone =
    urgency === "critical"
      ? "bg-critical"
      : urgency === "high"
        ? "bg-warning"
        : urgency === "medium"
          ? "bg-info"
          : "bg-muted-foreground";
  return <span className={cn("size-2 rounded-full", tone)} />;
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
      <div className={cn("numeric mt-1 text-lg", tone === "positive" && "text-positive")}>{value}</div>
    </div>
  );
}
