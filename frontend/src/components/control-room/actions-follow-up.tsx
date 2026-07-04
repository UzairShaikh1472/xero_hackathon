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
    title: "Email",
    subtitle: "Gentle reminder: invoices overdue under 14 days",
    icon: <Mail className="size-4" />,
    emptyHint: "No receivables drafts eligible for email yet. Email is for invoices overdue by fewer than 14 days.",
    actionLabel: "Send email",
  },
  {
    key: "agent_call",
    title: "Call with agent",
    subtitle: "AI voice follow-up: 14+ days overdue",
    icon: (
      <span className="flex items-center gap-0.5">
        <Bot className="size-3.5" />
        <Phone className="size-3.5" />
      </span>
    ),
    emptyHint: "No drafts ready for AI voice calls. Voice invites apply to invoices 14+ days overdue.",
    actionLabel: "Send voice invite",
  },
  {
    key: "human_call",
    title: "Call with human",
    subtitle: "Escalated: high or critical urgency, needs you",
    icon: (
      <span className="flex items-center gap-0.5">
        <User className="size-3.5" />
        <Phone className="size-3.5" />
      </span>
    ),
    emptyHint: "No escalations right now. Human calls are suggested for critical or high-urgency accounts.",
    actionLabel: "Schedule call",
  },
];

export function ActionsFollowUp({
  drafts,
  emailConfigured,
  browserVoiceConfigured,
  onOpen,
  onSendEmail,
  onSendVoiceInvite,
  onStartCall,
}: {
  drafts: NegotiationDraft[];
  emailConfigured: boolean;
  browserVoiceConfigured: boolean;
  onOpen: (draft: NegotiationDraft) => void;
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
    <section className="space-y-4">
      <LensHeader
        icon={<Phone className="size-4" />}
        title="Follow up"
        subtitle="Pick a channel for each receivables draft: preview before sending"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {CHANNELS.map((channel) => (
          <FollowUpColumn
            key={channel.key}
            channel={channel}
            drafts={groups[channel.key === "email" ? "email" : channel.key === "agent_call" ? "agentCall" : "humanCall"]}
            emailConfigured={emailConfigured}
            browserVoiceConfigured={browserVoiceConfigured}
            onOpen={onOpen}
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
  onOpen,
  onSendEmail,
  onSendVoiceInvite,
  onStartCall,
}: {
  channel: (typeof CHANNELS)[number];
  drafts: NegotiationDraft[];
  emailConfigured: boolean;
  browserVoiceConfigured: boolean;
  onOpen: (draft: NegotiationDraft) => void;
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
      channel.key === "email" ? "Sending email…" : "Sending voice invite…",
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
    const pending = toast.loading("Opening call…");
    try {
      await onStartCall(draft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start call", { id: pending });
    } finally {
      setBusyId(null);
      toast.dismiss(pending);
    }
  };

  const handlePreview = (draft: NegotiationDraft) => {
    onOpen(draft);
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
          ? "Configure GEMINI_API_KEY in backend .env"
          : null;

  return (
    <div className="panel flex flex-col p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-secondary">
          {channel.icon}
        </div>
        <div>
          <div className="font-semibold">{channel.title}</div>
          <div className="text-sm text-muted-foreground">{channel.subtitle}</div>
        </div>
      </div>

      <Badge variant="outline" className="mt-4 w-fit border-hairline">
        {drafts.length} ready
      </Badge>

      {executeDisabledReason && channel.key !== "human_call" && (
        <p className="mt-2 text-xs text-muted-foreground">{executeDisabledReason}</p>
      )}

      <div className="mt-4 flex flex-1 flex-col gap-2">
        {drafts.length === 0 ? (
          <p className="rounded-xl border border-dashed hairline bg-surface-2/40 p-4 text-sm text-muted-foreground">
            {channel.emptyHint}
          </p>
        ) : (
          drafts.map((draft) => (
            <div
              key={draft.id}
              className="rounded-xl border hairline bg-surface-2/40 p-3"
            >
              <div className="flex items-center gap-2">
                <UrgencyDot u={draft.urgency} />
                <span className="font-medium truncate">{draft.targetName}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {draft.daysOverdue != null && (
                  <span>{draft.daysOverdue}d overdue</span>
                )}
                <span className="numeric text-positive">
                  +{gbp(draft.expectedCashImpact)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handlePreview(draft)}
                >
                  Preview
                </Button>
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
                      !browserVoiceConfigured ? "Configure GEMINI_API_KEY in backend .env" : undefined
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
