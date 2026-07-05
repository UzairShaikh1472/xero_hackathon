import { Link } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink } from "lucide-react";

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
import { gbp, pct } from "@/lib/kinetic/format";
import type {
  CommunicationResult,
  ExecutionResult,
  NegotiationDraft,
} from "@/lib/kinetic/types";

import { UrgencyDot } from "./shared";
import {
  REACTIVATION_VOICE_THRESHOLD_DAYS,
  reactivationUsesVoice,
} from "@/lib/kinetic/reactivation";

function getDaysOverdue(draft: NegotiationDraft) {
  if (draft.daysOverdue != null) return draft.daysOverdue;
  const match = draft.reason.match(/(\d+)\s+days?\s+overdue/i);
  return match ? Number(match[1]) : 0;
}

function getDaysSilent(draft: NegotiationDraft) {
  if (draft.daysSilent != null) return draft.daysSilent;
  const inactive = draft.reason.match(/(\d+)\s+days?\s+inactive/i);
  if (inactive) return Number(inactive[1]);
  const silent = draft.reason.match(/(\d+)\s+days?\s+silent/i);
  if (silent) return Number(silent[1]);
  return 0;
}

export function ApprovalDrawer({
  draft,
  execution,
  communication,
  onClose,
  onSimulate,
}: {
  draft: NegotiationDraft;
  execution: ExecutionResult | null;
  communication: CommunicationResult | null;
  onClose: () => void;
  onSimulate: (d: NegotiationDraft) => void;
}) {
  const daysOverdue = getDaysOverdue(draft);
  const daysSilent = getDaysSilent(draft);
  const canEmail =
    (draft.agent === "receivables" && daysOverdue < 14) ||
    (draft.agent === "reengagement" && !reactivationUsesVoice(daysSilent));
  const canVoice =
    (draft.agent === "receivables" && daysOverdue >= 14) ||
    (draft.agent === "reengagement" && reactivationUsesVoice(daysSilent));
  const latePaymentEstimate =
    draft.agent === "receivables" ? draft.latePaymentEstimate : undefined;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="z-[100] flex w-full flex-col border-l hairline bg-surface sm:max-w-lg"
      >
        <>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UrgencyDot u={draft.urgency} />
              {draft.agent === "receivables"
                ? "Collect"
                : draft.agent === "reengagement"
                  ? "Reactivate"
                  : "Extend"}{" "}
              | {draft.targetName}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground">
              {draft.proposedAction}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="-mx-6 flex-1 px-6">
            <div className="space-y-5 py-4">
              <div className="grid grid-cols-3 gap-2">
                <StatBlock
                  label="Expected cash"
                  value={gbp(draft.expectedCashImpact, { signed: true })}
                  tone="positive"
                />
                <StatBlock label="Impact ETA" value={`~${draft.hoursToImpact}h`} />
                <StatBlock label="Confidence" value={pct(draft.confidence)} />
              </div>

              {latePaymentEstimate && (
                <div className="rounded-2xl border hairline bg-surface-2/55 p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    UK late-payment estimate
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <StatBlock
                      label="Original amount"
                      value={gbp(latePaymentEstimate.principalAmount)}
                    />
                    <StatBlock
                      label="Legal total"
                      value={gbp(latePaymentEstimate.updatedBalance)}
                      tone="positive"
                    />
                    <StatBlock
                      label="Interest"
                      value={gbp(latePaymentEstimate.statutoryInterest)}
                    />
                    <StatBlock
                      label="Recovery fee"
                      value={gbp(latePaymentEstimate.fixedCompensation)}
                    />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {`Estimate uses the UK statutory late-payment rate of ${latePaymentEstimate.statutoryAnnualRatePercent.toFixed(2)}% (${latePaymentEstimate.statutoryBaseRatePercent.toFixed(2)}% Bank Rate + 8.00%) for the current reference window.`}
                  </p>
                </div>
              )}

              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Rationale
                </div>
                <p className="mt-1 text-sm">{draft.reason}</p>
              </div>

              <Separator className="bg-hairline" />

              <div>
                <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                  Subject
                </div>
                <Textarea
                  value={draft.subject}
                  readOnly
                  rows={2}
                  className="border-hairline bg-surface-2 font-sans text-sm"
                />
              </div>

              <div>
                <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                  Draft message
                </div>
                <Textarea
                  value={draft.body}
                  readOnly
                  rows={10}
                  className="border-hairline bg-surface-2 font-sans text-sm"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {canVoice && draft.agent === "reengagement"
                    ? `Inactive ${daysSilent}+ days - this moves to the Actions page as a voice-agent step.`
                    : canEmail && draft.agent === "reengagement"
                      ? `Inactive under ${REACTIVATION_VOICE_THRESHOLD_DAYS} days - send this from the Actions page as a win-back email.`
                      : "Use the Actions page to send the final email or call step."}
                </p>
              </div>

              {execution && (
                <div className="rounded-md border border-positive/40 bg-positive/10 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-positive">
                    <CheckCircle2 className="size-4" />
                    Simulated
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{execution.note}</div>
                </div>
              )}

              {communication && (
                <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-primary">
                    <CheckCircle2 className="size-4" />
                    {communication.channel === "voice_invite"
                      ? "Voice invite sent"
                      : communication.channel === "call"
                        ? "Call started"
                        : "Email sent"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {communication.message}
                  </div>
                  {communication.callUrl && (
                    <a
                      href={communication.callUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-primary underline"
                    >
                      Open call link
                    </a>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          <SheetFooter className="flex-col gap-3 border-t hairline pt-4 sm:flex-col sm:justify-start">
            <div className="flex w-full flex-wrap justify-between gap-2">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => onSimulate(draft)}
                className="border-hairline"
              >
                Simulate execution
              </Button>
            </div>

            <Button asChild className="w-full">
              <Link
                to="/app/actions"
                search={{ customer: draft.targetName }}
                onClick={onClose}
              >
                Open in Actions
                <ExternalLink className="size-4" />
              </Link>
            </Button>
          </SheetFooter>
        </>
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
