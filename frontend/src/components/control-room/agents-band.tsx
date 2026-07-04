import { Bot, CheckCircle2, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { gbp, pct } from "@/lib/kinetic/format";
import type { ExecutionResult, NegotiationDraft } from "@/lib/kinetic/types";

import { UrgencyDot } from "./shared";

export function AgentsBand({
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
          <div className="text-lg font-semibold">Agents at work</div>
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
