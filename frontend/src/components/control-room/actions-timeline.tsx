import {
  Bot,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  PlayCircle,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { gbp, timeAgo } from "@/lib/kinetic/format";
import type {
  EscalationStep,
  TimelineEvent,
  TimelineEventKind,
} from "@/lib/kinetic/action-timeline";

import { LensHeader } from "./shared";

const KIND_META: Record<
  TimelineEventKind,
  { icon: React.ReactNode; label: string; tone?: "positive" | "info" | "warning" }
> = {
  email_sent: {
    icon: <Mail className="size-3.5" />,
    label: "Email",
    tone: "info",
  },
  voice_invite: {
    icon: (
      <span className="flex items-center gap-0.5">
        <Bot className="size-3.5" />
        <Phone className="size-3.5" />
      </span>
    ),
    label: "Voice invite",
    tone: "info",
  },
  call_started: {
    icon: (
      <span className="flex items-center gap-0.5">
        <Bot className="size-3.5" />
        <Phone className="size-3.5" />
      </span>
    ),
    label: "Agent call",
    tone: "info",
  },
  human_escalation: {
    icon: (
      <span className="flex items-center gap-0.5">
        <User className="size-3.5" />
        <Phone className="size-3.5" />
      </span>
    ),
    label: "Human call",
    tone: "warning",
  },
  simulated: {
    icon: <PlayCircle className="size-3.5" />,
    label: "Simulated",
    tone: "warning",
  },
  follow_up_open: {
    icon: <Clock className="size-3.5" />,
    label: "Awaiting payment",
    tone: "warning",
  },
  resolved: {
    icon: <CheckCircle2 className="size-3.5" />,
    label: "Collected",
    tone: "positive",
  },
  audit: {
    icon: <Mail className="size-3.5" />,
    label: "Draft ready",
    tone: "info",
  },
};

const STEP_ICONS: Record<EscalationStep["key"], React.ReactNode> = {
  email: <Mail className="size-4" />,
  agent_call: (
    <span className="flex items-center gap-0.5">
      <Bot className="size-4" />
      <Phone className="size-4" />
    </span>
  ),
  human_call: (
    <span className="flex items-center gap-0.5">
      <User className="size-4" />
      <Phone className="size-4" />
    </span>
  ),
  resolved: <CheckCircle2 className="size-4 text-positive" />,
};

export function ActionsTimeline({ steps }: { steps: EscalationStep[] }) {
  const totalEvents = steps.reduce((n, s) => n + s.events.length, 0);

  return (
    <section
      className="panel space-y-5 p-6"
      style={{ boxShadow: "var(--shadow-elevated)" }}
    >
      <LensHeader
        icon={<Clock className="size-4" />}
        title="Escalation timeline"
        subtitle="Email first, then AI call if unpaid, then human escalation"
        right={
          <Badge variant="outline" className="border-hairline bg-white/45">
            {totalEvents} events
          </Badge>
        }
      />

      <ol className="relative space-y-2">
        {steps.map((step, index) => (
          <EscalationStepRow
            key={step.key}
            step={step}
            isLast={index === steps.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

function EscalationStepRow({
  step,
  isLast,
}: {
  step: EscalationStep;
  isLast: boolean;
}) {
  const hasActivity = step.events.length > 0;
  const hasPending = step.events.some((e) => e.status === "pending");

  return (
    <li className="relative flex gap-4 rounded-[26px] border border-hairline bg-surface/46 p-5">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full border-2 bg-surface-2 shadow-sm",
            hasActivity && step.key === "resolved" && "border-positive/50 text-positive",
            hasActivity && step.key !== "resolved" && "border-primary/50 text-primary",
            !hasActivity && "border-hairline text-muted-foreground",
          )}
        >
          {STEP_ICONS[step.key]}
        </div>
        {!isLast && <div className="mt-2 w-0.5 flex-1 bg-gradient-to-b from-sky-300/60 to-transparent" />}
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Step {step.step}
            </span>
            <span className="font-semibold">{step.title}</span>
            {hasPending && (
              <Badge variant="outline" className="h-5 border-warning/40 bg-warning/10 text-warning">
                Action needed
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{step.subtitle}</p>
        </div>

        {step.events.length === 0 ? (
          <p className="rounded-2xl border border-dashed hairline bg-surface-2/36 px-4 py-4 text-sm text-muted-foreground">
            {step.key === "email" && "No emails sent yet."}
            {step.key === "agent_call" && "Escalates here when email follow-up has not resulted in payment."}
            {step.key === "human_call" && "Escalates here when AI follow-up still has not resulted in payment."}
            {step.key === "resolved" && "Collected payments will appear here once confirmed in Xero."}
          </p>
        ) : (
          <ul className="space-y-2">
            {step.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function EventCard({ event }: { event: TimelineEvent }) {
  const meta = KIND_META[event.kind];

  return (
    <li className="rounded-2xl border hairline bg-surface-2/48 px-4 py-4 transition-colors duration-200 hover:bg-white/70">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full border hairline bg-surface shadow-sm",
                meta.tone === "positive" && "text-positive",
                meta.tone === "info" && "text-info",
                meta.tone === "warning" && "text-warning",
              )}
            >
              {meta.icon}
            </span>
            <span className="font-medium">{event.title}</span>
            {event.contactName && (
              <span className="text-sm text-muted-foreground truncate">
                {event.contactName}
              </span>
            )}
          </div>
          {event.detail && (
            <p className="mt-1 pl-8 text-sm text-muted-foreground line-clamp-2">
              {event.detail}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
          {event.status !== "pending" && (
            <span suppressHydrationWarning>{timeAgo(event.at)}</span>
          )}
          {event.status === "pending" && (
            <Badge variant="outline" className="border-warning/40 text-warning h-5">
              Awaiting payment
            </Badge>
          )}
          {event.amount != null && event.amount > 0 && (
            <span
              className={cn(
                "numeric text-sm font-medium",
                event.kind === "resolved" ? "text-positive" : "text-foreground",
              )}
            >
              {event.kind === "resolved" ? "+" : ""}
              {gbp(event.amount)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
