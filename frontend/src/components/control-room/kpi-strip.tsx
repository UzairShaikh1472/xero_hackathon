import {
  Banknote,
  Landmark,
  Plus,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { gbp } from "@/lib/kinetic/format";

export function KpiStrip({
  currentCash,
  recoverableCash,
  opportunityTotal,
}: {
  currentCash: number;
  recoverableCash: number;
  opportunityTotal: number;
  executedTotal: number;
}) {
  const projectedCash = currentCash + recoverableCash + opportunityTotal;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <KpiCard
        label="Current cash"
        value={gbp(currentCash)}
        hint="Across connected Xero bank feeds"
        icon={<Landmark className="size-4" />}
      />
      <Operator symbol="+" />
      <KpiCard
        label="Recoverable cash"
        value={gbp(recoverableCash)}
        hint="Probability- and time-discounted"
        icon={<Banknote className="size-4" />}
        tone="warning"
      />
      <Operator symbol="+" />
      <KpiCard
        label="Revenue opportunities"
        value={gbp(opportunityTotal)}
        hint="Lapsed-customer reactivation only"
        icon={<TrendingUp className="size-4" />}
        tone="positive"
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
  hint,
  icon,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "positive" | "warning" | "critical";
  highlight?: boolean;
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
      className={cn(
        "panel flex-1 min-w-0 p-5",
        highlight && "border-2 border-accent bg-accent/[0.04]",
      )}
    >
      <div className="flex items-center justify-between text-sm uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className="text-muted-foreground/70">{icon}</span>
      </div>
      <div className={cn("numeric mt-3 text-2xl", toneClass)}>{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{hint}</div>
    </div>
  );
}
