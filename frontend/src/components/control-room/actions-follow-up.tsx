import { Link } from "@tanstack/react-router";
import { Bot, Loader2, Mail, Phone, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { groupFollowUps } from "@/lib/kinetic/follow-up";
import { gbp } from "@/lib/kinetic/format";
import type { FollowUpChannel, NegotiationDraft } from "@/lib/kinetic/types";

import { LensHeader, UrgencyDot } from "./shared";

const CHANNELS: Array<{
  key: FollowUpChannel;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  emptyHint: string;
  actionLabel: string;
}> = [
  {
    key: "email",
    title: "Email reminder",
    subtitle: "Automatic first touch: invoices overdue under 14 days",
    icon: <Mail className="size-4" />,
    emptyHint: "No receivables drafts eligible for email yet. Email is for invoices overdue by fewer than 14 days.",
    actionLabel: "Send email",
  },
  {
    key: "agent_call",
    title: "AI voice call",
    subtitle: "Automatic escalation: invoices 14+ days overdue",
    icon: (
      <span className="flex items-center gap-0.5">
        <Bot className="size-3.5" />
        <Phone className="size-3.5" />
      </span>
    ),
    emptyHint: "No overdue invoices are ready for AI voice calls. This lane only shows payment collection calls at 14+ days overdue.",
    actionLabel: "Send voice invite",
  },
  {
    key: "human_call",
    title: "Call with human",
    subtitle: "Only after automated follow-up needs human help",
    icon: (
      <span className="flex items-center gap-0.5">
        <User className="size-3.5" />
        <Phone className="size-3.5" />
      </span>
    ),
    emptyHint: "No human escalation right now. This stays empty until the automated payment flow needs a person.",
    actionLabel: "Schedule call",
  },
];

export function ActionsFollowUp({
  drafts,
  emailConfigured,
  browserVoiceConfigured,
  highlightCustomer,
  onSendEmail,
  onSendVoiceInvite,
  onStartCall,
}: {
  drafts: NegotiationDraft[];
  emailConfigured: boolean;
  browserVoiceConfigured: boolean;
  highlightCustomer?: string;
  onSendEmail: (
    draft: NegotiationDraft,
    edits: { subject: string; body: string },
  ) => Promise<void>;
  onSendVoiceInvite: (
    draft: NegotiationDraft,
    edits?: { subject: string; body: string },
  ) => Promise<void>;
  onStartCall: (draft: NegotiationDraft) => Promise<void>;
}) {
  const groups = groupFollowUps(drafts);

  return (
    <section className="space-y-5">
      <LensHeader
        icon={<Phone className="size-4" />}
        title="Payment automation"
        subtitle="Under 14 days: email. 14+ days overdue: AI collections call. Human escalation only if automation cannot resolve it."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {CHANNELS.map((channel) => (
          <FollowUpColumn
            key={channel.key}
            channel={channel}
            drafts={groups[channel.key === "email" ? "email" : channel.key === "agent_call" ? "agentCall" : "humanCall"]}
            emailConfigured={emailConfigured}
            browserVoiceConfigured={browserVoiceConfigured}
            highlightCustomer={highlightCustomer}
            onSendEmail={onSendEmail}
            onSendVoiceInvite={onSendVoiceInvite}
            onStartCall={onStartCall}
          />
        ))}
      </div>
    </section>
  );
}

function FollowUpColumn({
  channel,
  drafts,
  emailConfigured,
  browserVoiceConfigured,
  highlightCustomer,
  onSendEmail,
  onSendVoiceInvite,
  onStartCall,
}: {
  channel: (typeof CHANNELS)[number];
  drafts: NegotiationDraft[];
  emailConfigured: boolean;
  browserVoiceConfigured: boolean;
  highlightCustomer?: string;
  onSendEmail: (
    draft: NegotiationDraft,
    edits: { subject: string; body: string },
  ) => Promise<void>;
  onSendVoiceInvite: (
    draft: NegotiationDraft,
    edits?: { subject: string; body: string },
  ) => Promise<void>;
  onStartCall: (draft: NegotiationDraft) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleExecute = async (draft: NegotiationDraft) => {
    setBusyId(draft.id);
    const pending = toast.loading(
      channel.key === "email" ? "Sending email..." : "Sending voice invite...",
    );
    try {
      if (channel.key === "email") {
        await onSendEmail(draft, { subject: draft.subject, body: draft.body });
      } else if (channel.key === "agent_call") {
        await onSendVoiceInvite(draft, { subject: draft.subject, body: draft.body });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed", { id: pending });
      return;
    } finally {
      toast.dismiss(pending);
      setBusyId(null);
    }
  };

  const handleCallNow = async (draft: NegotiationDraft) => {
    setBusyId(draft.id);
    const pending = toast.loading("Opening call...");
    try {
      await onStartCall(draft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start call", { id: pending });
    } finally {
      setBusyId(null);
      toast.dismiss(pending);
    }
  };

  const canExecute =
    channel.key === "email"
      ? emailConfigured
      : channel.key === "agent_call"
        ? emailConfigured && browserVoiceConfigured
        : false;

  const executeDisabledReason =
    channel.key === "email" && !emailConfigured
      ? "Configure SMTP in backend .env"
      : channel.key === "agent_call" && !emailConfigured
        ? "Configure SMTP in backend .env"
        : channel.key === "agent_call" && !browserVoiceConfigured
          ? "Configure GEMINI_API_KEY, AI_API_KEY, or Vapi in backend .env"
          : null;

  return (
    <div
      className="panel flex flex-col p-6"
      style={{ boxShadow: "var(--shadow-elevated)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-2xl bg-secondary"
          style={{
            boxShadow:
              channel.key === "agent_call"
                ? "0 0 0 1px rgba(98,240,255,0.16), 0 14px 28px -22px rgba(0,182,255,0.55)"
                : undefined,
          }}
        >
          {channel.icon}
        </div>
        <div>
          <div className="text-lg font-semibold">{channel.title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{channel.subtitle}</div>
        </div>
      </div>

      <Badge variant="outline" className="mt-5 w-fit border-hairline bg-white/45">
        {drafts.length} ready
      </Badge>

      {executeDisabledReason && channel.key !== "human_call" && (
        <p className="mt-2 text-xs text-muted-foreground">{executeDisabledReason}</p>
      )}

      <div className="mt-5 flex flex-1 flex-col gap-3">
        {drafts.length === 0 ? (
          <p className="rounded-2xl border border-dashed hairline bg-surface-2/45 p-5 text-sm text-muted-foreground">
            {channel.emptyHint}
          </p>
        ) : (
          drafts.map((draft) => (
            <div
              key={draft.id}
              className={cn(
                "rounded-2xl border hairline bg-surface-2/52 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/68",
                highlightCustomer === draft.targetName &&
                  "border-primary/40 bg-primary/5 ring-1 ring-primary/20",
              )}
              style={{
                boxShadow:
                  channel.key === "agent_call"
                    ? "0 10px 28px -24px rgba(0,182,255,0.55)"
                    : undefined,
              }}
            >
              <div className="flex items-center gap-2">
                <UrgencyDot u={draft.urgency} />
                <span className="truncate text-base font-medium">{draft.targetName}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {draft.daysOverdue != null && (
                  <span>{draft.daysOverdue}d overdue</span>
                )}
                {draft.latePaymentEstimate && (
                  <span>{`UK total ${gbp(draft.latePaymentEstimate.updatedBalance)}`}</span>
                )}
                <span className="numeric text-positive">
                  +{gbp(draft.expectedCashImpact)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {channel.key !== "human_call" && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canExecute || busyId === draft.id}
                    title={executeDisabledReason ?? undefined}
                    onClick={() => void handleExecute(draft)}
                  >
                    {busyId === draft.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    {channel.actionLabel}
                  </Button>
                )}
                {channel.key === "agent_call" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!browserVoiceConfigured || busyId === draft.id}
                    title={
                      !browserVoiceConfigured
                        ? "Configure GEMINI_API_KEY, AI_API_KEY, or Vapi in backend .env"
                        : undefined
                    }
                    onClick={() => void handleCallNow(draft)}
                  >
                    {busyId === draft.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Start call now
                  </Button>
                )}
                <Link
                  to="/app/cash"
                  search={{ customer: draft.targetName }}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md px-2 text-xs text-primary hover:underline",
                  )}
                >
                  View in Cash Lens
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

