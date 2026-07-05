import {
  Banknote,
  Landmark,
  Plus,
  TrendingUp,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { gbp } from "@/lib/kinetic/format";

export function KpiStrip({
  currentCash,
  lastMonthCashFlow,
  recoverableCash,
  opportunityTotal,
  overdueCount,
  loyaltyCount,
}: {
  currentCash: number;
  lastMonthCashFlow: number;
  recoverableCash: number;
  opportunityTotal: number;
  executedTotal: number;
  overdueCount: number;
  loyaltyCount: number;
}) {
  const projectedCash = currentCash + recoverableCash + opportunityTotal;
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toLocaleString("default", { month: "short" });
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <KpiCard
        label="Current cash"
        value={gbp(currentCash)}
        subValue={`${gbp(lastMonthCashFlow)} ${lastMonth}`}
        hint="Bank balance · last month net in parentheses"
        icon={<Landmark className="size-4" />}
      />
      <Operator symbol="+" />
      <KpiCard
        label="Recoverable cash"
        value={gbp(recoverableCash)}
        hint="Probability- and time-discounted"
        icon={<Banknote className="size-4" />}
        tone="warning"
        badge={`${overdueCount} overdue receivable${overdueCount !== 1 ? "s" : ""}`}
        to="/app/cash"
        search={{ focus: "overdue" }}
      />
      <Operator symbol="+" />
      <KpiCard
        label="Revenue opportunities"
        value={gbp(opportunityTotal)}
        hint="Repeat buyer upsell + lapsed customer reactivation"
        icon={<TrendingUp className="size-4" />}
        tone="positive"
        badge={`${loyaltyCount} repeat & lapsed customer${loyaltyCount !== 1 ? "s" : ""}`}
        to="/app/cash"
        search={{ focus: "loyalty" }}
      />
      <Operator symbol="=" />
      <KpiCard
        label="Projected cash"
        value={gbp(projectedCash)}
        hint="If recovery and opportunities land"
        icon={<Banknote className="size-4" />}
        highlight
      />
    </div>
  );
}

function Operator({ symbol }: { symbol: "+" | "=" }) {
  return (
    <div className="flex items-center justify-center py-1 sm:py-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-medium text-muted-foreground">
        {symbol === "+" ? <Plus className="size-4" /> : "="}
      </span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subValue,
  hint,
  icon,
  tone,
  highlight,
  badge,
  to,
  search,
}: {
  label: string;
  value: string;
  subValue?: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "positive" | "warning" | "critical";
  highlight?: boolean;
  badge?: string;
  to?: string;
  search?: Record<string, string>;
}) {
  const toneClass =
    tone === "critical"
      ? "text-critical"
      : tone === "warning"
        ? "text-warning"
        : tone === "positive"
          ? "text-positive"
          : "text-foreground";
  const inner = (
    <>
      <div className="flex items-center justify-between text-sm uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className="text-muted-foreground/70">{icon}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span className={cn("numeric text-2xl", toneClass)}>{value}</span>
        {subValue && (
          <span className="numeric text-sm text-muted-foreground">({subValue})</span>
        )}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{hint}</div>
      {badge && (
        <div className={cn("mt-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tone === "warning" ? "bg-warning/10 text-warning" : tone === "positive" ? "bg-positive/10 text-positive" : "bg-surface-2 text-muted-foreground")}>
          {badge}
        </div>
      )}
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        search={search}
        className={cn(
          "panel flex-1 min-w-0 p-5 transition-colors hover:border-primary/30",
          highlight && "border-2 border-accent bg-accent/[0.04]",
        )}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div
      className={cn(
        "panel flex-1 min-w-0 p-5 transition-all duration-200 hover:-translate-y-0.5",
        highlight && "border-2 border-accent bg-accent/[0.04]",
      )}
    >
      {inner}
    </div>
  );
}
