import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Volume2, VolumeX, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchDemoNarration } from "@/lib/kinetic/api";
import { cn } from "@/lib/utils";

export type TourAnchorId = "kpi" | "cash" | "actions";

const TOUR_ROUTES: Record<TourAnchorId, string> = {
  kpi: "/app",
  cash: "/app/cash",
  actions: "/app/actions",
};

interface TourStep {
  anchor: TourAnchorId;
  title: string;
  body: string;
  narration: string;
  action?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    anchor: "kpi",
    title: "The 30-second read",
    body:
      "Acme has GBP 48k on hand today. GBP 62k of overdue receivables is stuck money. Recoverable cash discounts it for collection risk and delay, and Projected cash shows what your balance becomes if that recovery, plus other revenue opportunities, actually lands.",
    narration:
      "This top strip is the fastest way to understand the business right now. Current cash is the live Xero bank balance when available, or a clearly marked estimated cash position when bank-balance access is unavailable. Overdue receivables is money customers should already have paid. Recoverable cash is the more realistic number, because it adjusts those invoices for collection risk and timing. Revenue opportunities adds likely upside from repeat buyers and reactivation, so you can see where more cash may come from next.",
  },
  {
    anchor: "cash",
    title: "Cash and Revenue Lens",
    body:
      "Overdue invoices, still-buying customers worth upselling, and gone-quiet customers worth winning back are tracked separately below. Northwind Logistics shows up in both Overdue and Loyalty potential: same customer, two unrelated facts about them.",
    narration:
      "This page splits customer signals into three lanes. Overdue shows invoices that need collections attention. Loyalty potential shows active customers who may be worth upselling. Reactivation shows customers who have gone quiet and may be worth winning back. The same company can appear in more than one lane, because payment risk and revenue opportunity are different signals.",
  },
  {
    anchor: "actions",
    title: "Follow up and track progress",
    body:
      "Pick a channel for each overdue invoice: email for recent, AI voice for 14 plus days, or human escalation for critical accounts. The timeline below records every send, call, simulation, and payment collected.",
    narration:
      "This is the execution layer. For invoices overdue by less than fourteen days, the system starts with email. Once an invoice is overdue by fourteen days or more, the AI collections call becomes the next automated step. The timeline above records what has been sent, what has been called, and what has been resolved, so the team can track progress clearly.",
    action: "Send a follow-up ->",
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
  const navigate = useNavigate();
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (step === null) return;
    const anchor = TOUR_STEPS[step].anchor;
    navigate({ to: TOUR_ROUTES[anchor] });
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`tour-${anchor}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [step, navigate]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      audioRef.current?.pause();
      audioRef.current = null;
      setSpeaking(false);
    };
  }, []);

  useEffect(() => {
    if (step === null || !voiceEnabled) {
      requestIdRef.current += 1;
      audioRef.current?.pause();
      audioRef.current = null;
      setSpeaking(false);
      return;
    }

    const activeRequestId = requestIdRef.current + 1;
    requestIdRef.current = activeRequestId;
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(true);

    const timer = window.setTimeout(() => {
      void fetchDemoNarration(TOUR_STEPS[step].narration)
        .then((result) => {
          if (requestIdRef.current !== activeRequestId) return;
          if (!result.audioUrl) {
            setSpeaking(false);
            return;
          }

          const audio = new Audio(result.audioUrl);
          audioRef.current = audio;
          audio.onended = () => {
            if (requestIdRef.current === activeRequestId) {
              setSpeaking(false);
            }
          };
          audio.onerror = () => {
            if (requestIdRef.current === activeRequestId) {
              setSpeaking(false);
            }
          };
          void audio.play().catch(() => {
            if (requestIdRef.current === activeRequestId) {
              setSpeaking(false);
            }
          });
        })
        .catch(() => {
          if (requestIdRef.current === activeRequestId) {
            setSpeaking(false);
          }
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [step, voiceEnabled]);

  if (step === null) return null;
  const s = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  const replayNarration = async () => {
    if (!voiceEnabled) return;

    const activeRequestId = requestIdRef.current + 1;
    requestIdRef.current = activeRequestId;
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(true);

    try {
      const result = await fetchDemoNarration(s.narration);
      if (requestIdRef.current !== activeRequestId || !result.audioUrl) {
        setSpeaking(false);
        return;
      }

      const audio = new Audio(result.audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        if (requestIdRef.current === activeRequestId) {
          setSpeaking(false);
        }
      };
      audio.onerror = () => {
        if (requestIdRef.current === activeRequestId) {
          setSpeaking(false);
        }
      };
      await audio.play().catch(() => undefined);
    } finally {
      if (!audioRef.current && requestIdRef.current === activeRequestId) {
        setSpeaking(false);
      }
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-w-sm">
      <div className="panel p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-primary/15 text-primary">
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
        {s.action && <div className="mt-2 text-xs text-primary">{s.action}</div>}
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (voiceEnabled) {
                requestIdRef.current += 1;
                audioRef.current?.pause();
                audioRef.current = null;
                setSpeaking(false);
              }
              setVoiceEnabled((value) => !value);
            }}
          >
            {voiceEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            {voiceEnabled ? "Voice on" : "Voice off"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void replayNarration()}
            disabled={!voiceEnabled}
          >
            <Volume2 className="size-3.5" />
            {speaking ? "Playing..." : "Replay"}
          </Button>
        </div>
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
