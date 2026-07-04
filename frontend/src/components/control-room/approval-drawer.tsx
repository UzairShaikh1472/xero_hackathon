import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

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
import type { ExecutionResult, NegotiationDraft } from "@/lib/kinetic/types";

import { UrgencyDot } from "./shared";

export function ApprovalDrawer({
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
              <SheetTitle className="flex items-center gap-2">
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
