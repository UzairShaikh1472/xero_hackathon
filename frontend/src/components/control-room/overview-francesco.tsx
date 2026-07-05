import { Link } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock3,
  Landmark,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { gbp, pct, timeAgo } from "@/lib/kinetic/format";
import type {
  ControlRoomData,
  ExecutionResult,
  NegotiationDraft,
} from "@/lib/kinetic/types";

import { TourAnchor } from "./demo-tour";
import { UrgencyDot } from "./shared";

type OverviewFrancescoProps = {
  activeAnchor: string | null;
  data: ControlRoomData;
  executedTotal: number;
  projectedShortfall: number;
  executions: ExecutionResult[];
  onOpenDraft: (draft: NegotiationDraft) => void;
};

type ActivityItem = {
  id: string;
  at: string;
  title: string;
  subtitle: string;
  badge: string;
  accent?: "positive" | "warning";
};

export function OverviewFrancesco({
  activeAnchor,
  data,
  executedTotal,
  projectedShortfall,
  executions,
  onOpenDraft,
}: OverviewFrancescoProps) {
  const projectedPosition = data.snapshot.currentCash + projectedShortfall;

  const draftByName = useMemo(() => {
    const map = new Map<string, NegotiationDraft>();
    data.drafts.forEach((draft) => {
      map.set(draft.targetName, draft);
    });
    return map;
  }, [data.drafts]);

  const receivablesDrafts = data.drafts.filter((draft) => draft.agent === "receivables");
  const payablesDrafts = data.drafts.filter((draft) => draft.agent === "payables");
  const reengagementDrafts = data.drafts.filter((draft) => draft.agent === "reengagement");

  const auditItems = useMemo<ActivityItem[]>(() => {
    const simulated = executions.map((execution) => ({
      id: `simulation-${execution.draftId}`,
      at: execution.executedAt,
      title: "Simulated collection",
      subtitle: execution.note,
      badge: "Preview only",
      accent: "positive" as const,
    }));

    const audit = data.audit.map((entry) => ({
      id: entry.id,
      at: entry.at,
      title: entry.action,
      subtitle: `${entry.target} - ${entry.rationale}`,
      badge: entry.actor,
      accent: entry.humanInLoop ? ("warning" as const) : undefined,
    }));

    return [...simulated, ...audit]
      .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
      .slice(0, 6);
  }, [data.audit, executions]);

  const revenueEstimate =
    data.lapsedCustomers.reduce((sum, customer) => sum + customer.recoveryPotential, 0) +
    data.repeatBuyers.reduce((sum, customer) => sum + customer.upsellPotential, 0);

  return (
    <div className="space-y-6">
      <TourAnchor id="kpi" active={activeAnchor === "kpi"}>
        <div className="rounded-[calc(var(--radius-2xl)+6px)] border-2 border-accent bg-accent/[0.06] p-1">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              <h1 className="font-serif text-xl leading-none tracking-tight text-foreground">
                Your four key numbers
              </h1>
            </div>
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {data.snapshot.mode === "live" ? "Live from Xero" : "Fallback mode"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Current cash"
              value={gbp(data.snapshot.currentCash + executedTotal)}
              hint="Across connected Xero bank feeds"
              icon={<Landmark className="size-4" />}
            />
            <StatCard
              label="Projected 30-day position"
              value={gbp(projectedPosition)}
              hint="Inflows minus outflows over horizon"
              icon={<TrendingDown className="size-4" />}
              tone={projectedPosition < 0 ? "warning" : "positive"}
            />
            <StatCard
              label="Overdue receivables"
              value={gbp(data.snapshot.overdueReceivables)}
              hint="Ranked at risk in Cash Flow Lens"
              icon={<AlertTriangle className="size-4" />}
              tone="warning"
            />
            <StatCard
              label="Revenue opportunities"
              value={gbp(data.snapshot.revenueOpportunityTotal)}
              hint="Lapsed and repeat-buyer potential"
              icon={<TrendingUp className="size-4" />}
              tone="positive"
            />
          </div>
        </div>
      </TourAnchor>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <TourAnchor id="cash" active={activeAnchor === "cash"}>
          <section className="panel p-6">
            <PanelHeader
              icon={<Activity className="size-4" />}
              title="Cash Flow Lens"
              subtitle="Deterministic liquidity signals from Xero"
              right={
                <Link to="/app/cash" search={{ customer: undefined }}>
                  <Button variant="outline" size="sm" className="border-hairline">
                    Open lens
                    <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              }
            />

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricTile label="DSO" value={`${data.liquidity.dso.toFixed(2)}d`} hint="Days sales outstanding" />
              <MetricTile label="DPO" value={`${data.liquidity.dpo.toFixed(2)}d`} hint="Days payables outstanding" />
              <MetricTile
                label="CCC"
                value={`${data.liquidity.ccc.toFixed(2)}d`}
                hint="Cash conversion cycle"
                tone={data.liquidity.ccc > 10 ? "warning" : "positive"}
              />
            </div>

            <div className="mt-6">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-2xl font-semibold tracking-tight">30-day cash projection</div>
                  <div className="text-sm text-muted-foreground">
                    Daily inflows, outflows, and running balance
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className="border-0 bg-positive/10 text-positive hover:bg-positive/10">
                    + {gbp(data.liquidity.projectedInflow)}
                  </Badge>
                  <Badge className="border-0 bg-critical/10 text-critical hover:bg-critical/10">
                    - {gbp(data.liquidity.projectedOutflow)}
                  </Badge>
                </div>
              </div>

              <div className="h-[320px] rounded-[28px] bg-surface-2/80 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.liquidity.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,113,108,0.14)" />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => gbp(Number(value), { compact: true })}
                      width={72}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        gbp(Number(value)),
                        name === "balance"
                          ? "Balance"
                          : name === "inflow"
                            ? "Inflow"
                            : "Outflow",
                      ]}
                      labelFormatter={(label) => `Day ${label}`}
                      contentStyle={{
                        borderRadius: 18,
                        border: "1px solid var(--color-hairline)",
                        background: "rgba(255,255,255,0.96)",
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      name="balance"
                      stroke="var(--color-primary)"
                      fill="rgba(28,25,23,0.08)"
                      strokeWidth={3}
                    />
                    <Bar dataKey="inflow" name="inflow" fill="var(--color-positive)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="outflow" name="outflow" fill="var(--color-critical)" radius={[8, 8, 0, 0]} />
                    <Line type="monotone" dataKey="balance" stroke="var(--color-primary)" dot={false} strokeWidth={2.2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </TourAnchor>

        <section className="panel p-6">
          <PanelHeader
            icon={<TrendingUp className="size-4" />}
            title="Revenue Lens"
            subtitle="Where cash can come back faster"
            right={
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Est. recovery
                </div>
                <div className="numeric text-2xl text-positive">{gbp(revenueEstimate)}</div>
              </div>
            }
          />

          <ListSection
            title="Lapsed customers"
            count={data.lapsedCustomers.length}
            items={data.lapsedCustomers.slice(0, 5).map((customer) => ({
              key: customer.id,
              row: (
                <RevenueRow
                  name={customer.name}
                  subtitle={`LTV ${gbp(customer.ltv)} - silent ${customer.daysSilent}d`}
                  amount={`+${gbp(customer.recoveryPotential)}`}
                  draft={draftByName.get(customer.name)}
                  onOpenDraft={onOpenDraft}
                />
              ),
            }))}
          />

          <ListSection
            title="Repeat buyers"
            count={data.repeatBuyers.length}
            items={data.repeatBuyers.slice(0, 4).map((customer) => ({
              key: customer.id,
              row: (
                <RevenueRow
                  name={customer.name}
                  subtitle={`${customer.transactions12m} orders in 12m - avg ${gbp(customer.avgInvoice)}`}
                  amount={`+${gbp(customer.upsellPotential)}`}
                  draft={draftByName.get(customer.name)}
                  onOpenDraft={onOpenDraft}
                />
              ),
            }))}
          />
        </section>
      </div>

      <TourAnchor id="actions" active={activeAnchor === "actions"}>
        <section className="panel p-6">
          <PanelHeader
            icon={<Bot className="size-4" />}
            title="Agents at work"
            subtitle="Rules identify the risk. Drafts are ready for review."
            right={
              <Link to="/app/actions">
                <Button variant="outline" size="sm" className="border-hairline">
                  Open actions
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            }
          />

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <AgentColumn
              title="Receivables Negotiator"
              count={receivablesDrafts.length}
              drafts={receivablesDrafts}
              onOpenDraft={onOpenDraft}
            />
            <AgentColumn
              title="Payables Negotiator"
              count={payablesDrafts.length}
              drafts={payablesDrafts}
              onOpenDraft={onOpenDraft}
            />
            <AgentColumn
              title="Reengagement Agent"
              count={reengagementDrafts.length}
              drafts={reengagementDrafts}
              onOpenDraft={onOpenDraft}
            />
          </div>
        </section>

        <section className="panel p-6">
          <PanelHeader
            icon={<Clock3 className="size-4" />}
            title="Audit rail"
            subtitle="Recent actions, previews, and rationale"
            right={
              <Badge variant="outline" className="border-hairline">
                {auditItems.length} recent events
              </Badge>
            }
          />

          <div className="mt-5 space-y-3">
            {auditItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-hairline bg-surface-2/40 p-5 text-sm text-muted-foreground">
                No activity yet. Start the demo or review an action to populate the rail.
              </div>
            ) : (
              auditItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-hairline bg-surface-2/40 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-hairline",
                          item.accent === "positive" && "border-positive/30 text-positive",
                          item.accent === "warning" && "border-warning/30 text-warning",
                        )}
                      >
                        {item.badge}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground" suppressHydrationWarning>
                    {timeAgo(item.at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </TourAnchor>
    </div>
  );
}

function PanelHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="grid size-9 place-items-center rounded-full bg-accent text-foreground">
          {icon}
        </div>
        <div>
          <div className="text-[1.9rem] font-semibold leading-none tracking-tight">{title}</div>
          <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone?: "positive" | "warning";
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between text-sm uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className="text-muted-foreground/70">{icon}</span>
      </div>
      <div
        className={cn(
          "numeric mt-3 text-2xl",
          tone === "positive" && "text-positive",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{hint}</div>
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
  tone?: "positive" | "warning";
}) {
  return (
    <div className="rounded-[24px] border border-hairline bg-surface-2/75 p-4">
      <div className="text-sm uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "numeric mt-2 text-2xl",
          tone === "positive" && "text-positive",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{hint}</div>
    </div>
  );
}

function ListSection({
  title,
  count,
  items,
}: {
  title: string;
  count: number;
  items: Array<{ key: string; row: ReactNode }>;
}) {
  if (count === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.14em] text-muted-foreground">
        <span>{title}</span>
        <span>({count})</span>
      </div>
      <div className="space-y-3">{items.map((item) => <div key={item.key}>{item.row}</div>)}</div>
    </div>
  );
}

function RevenueRow({
  name,
  subtitle,
  amount,
  draft,
  onOpenDraft,
}: {
  name: string;
  subtitle: string;
  amount: string;
  draft?: NegotiationDraft;
  onOpenDraft: (draft: NegotiationDraft) => void;
}) {
  return (
    <div className="rounded-[26px] border border-hairline bg-surface-2/60 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xl font-medium">{name}</div>
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="numeric text-xl text-positive">{amount}</div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="icon"
          variant="outline"
          className="rounded-full border-hairline"
          disabled={!draft}
          onClick={() => draft && onOpenDraft(draft)}
        >
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function AgentColumn({
  title,
  count,
  drafts,
  onOpenDraft,
}: {
  title: string;
  count: number;
  drafts: NegotiationDraft[];
  onOpenDraft: (draft: NegotiationDraft) => void;
}) {
  return (
    <div className="rounded-[30px] border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[1.35rem] font-medium">{title}</div>
        <Badge variant="outline" className="border-hairline">
          {count} queued
        </Badge>
      </div>

      <div className="mt-4 space-y-3">
        {drafts.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-hairline bg-surface-2/40 p-4 text-sm text-muted-foreground">
            No drafts in this queue.
          </div>
        ) : (
          drafts.slice(0, 3).map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => onOpenDraft(draft)}
              className="w-full rounded-[24px] border border-hairline bg-surface-2/55 p-4 text-left transition-colors hover:bg-surface-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <UrgencyDot u={draft.urgency} />
                  <span className="truncate text-xl font-medium">{draft.targetName}</span>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-3 text-sm text-muted-foreground">{draft.reason}</div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="numeric text-positive">
                  +{gbp(draft.expectedCashImpact)}
                </span>
                <span className="text-muted-foreground">~{draft.hoursToImpact}h</span>
                <span className="text-muted-foreground">confidence {pct(draft.confidence)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
