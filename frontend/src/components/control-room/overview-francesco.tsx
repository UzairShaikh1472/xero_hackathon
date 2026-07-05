import { Mail, Phone, PhoneCall } from "lucide-react";
import { Link } from "@tanstack/react-router";

import type {
  ControlRoomData,
  ExecutionResult,
  NegotiationDraft,
} from "@/lib/kinetic/types";
import { filterActionableDrafts } from "@/lib/kinetic/action-activity";
import { groupFollowUps } from "@/lib/kinetic/follow-up";
import { cn } from "@/lib/utils";

import { TourAnchor } from "./demo-tour";
import { KpiStrip } from "./kpi-strip";

type OverviewFrancescoProps = {
  activeAnchor: string | null;
  data: ControlRoomData;
  executedTotal: number;
  projectedShortfall: number;
  executions: ExecutionResult[];
  onOpenDraft: (draft: NegotiationDraft) => void;
};

export function OverviewFrancesco({
  activeAnchor,
  data,
}: OverviewFrancescoProps) {
  const atRiskInvoices = data.atRiskInvoices ?? [];
  const lapsedCustomers = data.lapsedCustomers ?? [];
  const repeatBuyers = data.repeatBuyers ?? [];

  const overdueCount = atRiskInvoices.filter((inv) => inv.daysOverdue > 0).length;

  const loyaltyCount = new Set([
    ...repeatBuyers.filter((c) => c.upsellPotential > 0).map((c) => c.name),
    ...lapsedCustomers.filter((c) => c.recoveryPotential > 0).map((c) => c.name),
  ]).size;

  const readyDrafts = filterActionableDrafts(data.drafts ?? [], {
    audit: data.audit,
  });
  const groups = groupFollowUps(readyDrafts);
  const emailCount = groups.email.length;
  const voiceCount = groups.agentCall.length;
  const humanCount = groups.humanCall.length;

  return (
    <div className="flex flex-col gap-6">
      <TourAnchor id="kpi" active={activeAnchor === "kpi"}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              <h1 className="font-serif text-xl leading-none tracking-tight text-foreground">
                Your cash position
              </h1>
            </div>
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {data.snapshot.mode === "live" ? "Live from Xero" : "Fallback mode"}
            </span>
          </div>

          <KpiStrip
            currentCash={data.snapshot.currentCash}
            currentCashSource={data.snapshot.currentCashSource}
            currentCashNote={data.snapshot.currentCashNote}
            lastMonthCashFlow={data.snapshot.lastMonthCashFlow}
            lastMonthCashFlowAvailable={data.snapshot.lastMonthCashFlowAvailable}
            recoverableCash={data.snapshot.recoverableCash}
            opportunityTotal={data.snapshot.revenueOpportunityTotal}
            overdueCount={overdueCount}
            loyaltyCount={loyaltyCount}
          />
        </div>
      </TourAnchor>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-2 rounded-full bg-accent" />
          <h2 className="font-serif text-xl leading-none tracking-tight text-foreground">
            Actions in summary
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ActionSummaryCard
            label="Email reminders"
            count={emailCount}
            icon={<Mail className="size-5" />}
            tone="warning"
            to="/app/actions"
          />
          <ActionSummaryCard
            label="AI voice calls"
            count={voiceCount}
            icon={<Phone className="size-5" />}
            tone="positive"
            to="/app/actions"
          />
          <ActionSummaryCard
            label="Human to-do"
            count={humanCount}
            icon={<PhoneCall className="size-5" />}
            tone="neutral"
            to="/app/actions"
          />
        </div>
      </div>
    </div>
  );
}

function ActionSummaryCard({
  label,
  count,
  icon,
  tone,
  to,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  tone: "warning" | "positive" | "neutral";
  to: string;
}) {
  const toneClasses = {
    warning: "text-warning bg-warning/10 border-warning/20",
    positive: "text-positive bg-positive/10 border-positive/20",
    neutral: "text-muted-foreground bg-surface-2 border-border",
  };

  const countClasses = {
    warning: "text-warning",
    positive: "text-positive",
    neutral: "text-foreground",
  };

  return (
    <Link
      to={to}
      className="panel flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30"
    >
      <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl border", toneClasses[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className={cn("numeric text-3xl font-semibold leading-none", countClasses[tone])}>
          {count}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </div>
    </Link>
  );
}
