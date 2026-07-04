import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Clock, Zap } from "lucide-react";

import { TourAnchor, TOUR_STEPS } from "@/components/control-room/demo-tour";
import { KpiStrip } from "@/components/control-room/kpi-strip";
import { useControlRoom } from "@/components/control-room/control-room-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { countFollowUps } from "@/lib/kinetic/follow-up";
import { gbp, timeAgo } from "@/lib/kinetic/format";

export const Route = createFileRoute("/app/")({
  component: OverviewPage,
});

function OverviewPage() {
  const { data, executedTotal, tourStep } = useControlRoom();
  const activeAnchor = tourStep !== null ? TOUR_STEPS[tourStep].anchor : null;
  const followUpCount = countFollowUps(data.drafts);
  const overdueCount = data.atRiskInvoices.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Control room</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your cash picture and what needs attention right now.
        </p>
      </div>

      <TourAnchor id="kpi" active={activeAnchor === "kpi"}>
        <KpiStrip
          currentCash={data.snapshot.currentCash + executedTotal}
          recoverableCash={data.snapshot.recoverableCash}
          opportunityTotal={data.snapshot.revenueOpportunityTotal}
          executedTotal={executedTotal}
        />
      </TourAnchor>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AttentionCard
          icon={<AlertTriangle className="size-4 text-warning" />}
          title="Overdue receivables"
          count={overdueCount}
          hint="Invoices past due: ranked by recoverable cash"
          to="/app/cash"
        />
        <AttentionCard
          icon={<Zap className="size-4 text-primary" />}
          title="Follow-up actions"
          count={followUpCount}
          hint="Email, AI call, or human escalation ready to send"
          to="/app/actions"
        />
      </div>

      {data.audit.length > 0 && (
        <section className="panel p-6">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="size-4" />
            Recent activity
          </div>
          <ul className="mt-4 space-y-3">
            {data.audit.slice(0, 5).map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border hairline bg-surface-2/40 px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-muted-foreground"> · {entry.target}</span>
                  <p className="mt-1 text-muted-foreground">{entry.rationale}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-hairline">
                    {entry.actor}
                  </Badge>
                  <span suppressHydrationWarning>{timeAgo(entry.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AttentionCard({
  icon,
  title,
  count,
  amount,
  hint,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  amount?: number;
  hint: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group panel flex flex-col p-5 transition-colors hover:border-primary/30"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        <span className="numeric text-2xl font-semibold">{count}</span>
      </div>
      {amount != null && (
        <div className="numeric mt-2 text-lg text-warning">{gbp(amount)}</div>
      )}
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{hint}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm text-primary">
        View
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
