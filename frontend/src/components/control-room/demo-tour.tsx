import { useEffect } from "react";
import { ArrowRight, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TourAnchorId = "kpi" | "cash" | "agents";

interface TourStep {
  anchor: TourAnchorId;
  title: string;
  body: string;
  action?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    anchor: "kpi",
    title: "The 30-second read",
    body:
      "Acme has £48k on hand today. £62k of overdue receivables is stuck money — Recoverable cash discounts it for collection risk and delay, and Projected cash shows what your balance becomes if that recovery, plus other revenue opportunities, actually lands.",
  },
  {
    anchor: "cash",
    title: "Cash & Revenue Lens — Overdue, Loyalty, Reactivation",
    body:
      "Overdue invoices, still-buying customers worth upselling, and gone-quiet customers worth winning back are tracked separately below. Northwind Logistics shows up in both Overdue and Loyalty potential — same customer, two unrelated facts about them.",
  },
  {
    anchor: "agents",
    title: "Agents draft the action",
    body:
      "Rules identified the risk. AI drafts the message — subject, body, tone, expected cash impact, confidence. Open Northwind's draft to review, then simulate execution to see the post-execution cash impact before it touches Xero.",
    action: "Open a draft →",
  },
];

export function TourAnchor({
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

export function DemoTour({
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
      <div className="panel p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary border-0">
              Step {step + 1} / {TOUR_STEPS.length}
            </Badge>
            <span className="text-sm font-semibold">{s.title}</span>
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
