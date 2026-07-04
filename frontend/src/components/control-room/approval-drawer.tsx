import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Phone } from "lucide-react";

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
  emailConfigured,
  browserVoiceConfigured,
  onClose,
  onSimulate,
  onSendEmail,
  onSendVoiceInvite,
  onStartCall,
}: {
  draft: NegotiationDraft;
  execution: ExecutionResult | null;
  communication: CommunicationResult | null;
  emailConfigured: boolean;
  browserVoiceConfigured: boolean;
  onClose: () => void;
  onSimulate: (d: NegotiationDraft) => void;
  onSendEmail: (d: NegotiationDraft, edits: { subject: string; body: string }) => Promise<void>;
  onSendVoiceInvite: (
    d: NegotiationDraft,
    edits: { subject: string; body: string },
  ) => Promise<void>;
  onStartCall: (d: NegotiationDraft) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const activeId = draft?.id;

  useEffect(() => {
    if (draft) {
      setBody(draft.body);
      setSubject(draft.subject);
    }
  }, [activeId, draft]);

  const daysOverdue = getDaysOverdue(draft);
  const daysSilent = getDaysSilent(draft);
  const canEmail =
    (draft.agent === "receivables" && daysOverdue < 14) ||
    (draft.agent === "reengagement" && !reactivationUsesVoice(daysSilent));
  const canVoice =
    (draft.agent === "receivables" && daysOverdue >= 14) ||
    (draft.agent === "reengagement" && reactivationUsesVoice(daysSilent));

  const handleSendEmail = async () => {
    setSending(true);
    try {
      await onSendEmail(draft, { subject, body });
    } finally {
      setSending(false);
    }
  };

  const handleSendVoiceInvite = async () => {
    setSending(true);
    try {
      await onSendVoiceInvite(draft, { subject, body });
    } finally {
      setSending(false);
    }
  };

  const handleStartCall = async () => {
    setSending(true);
    try {
      await onStartCall(draft);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="z-[100] w-full sm:max-w-lg bg-surface border-l hairline flex flex-col"
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
              · {draft.targetName}
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
                  <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                    Subject
                  </div>
                  <Textarea
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    rows={2}
                    className="bg-surface-2 border-hairline font-sans text-sm"
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                    Draft message
                  </div>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="bg-surface-2 border-hairline font-sans text-sm"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {canVoice && draft.agent === "reengagement"
                      ? `Inactive ${daysSilent}+ days — voice agent invite. Greeting and call link are added when sent.`
                      : canEmail && draft.agent === "reengagement"
                        ? `Inactive under ${REACTIVATION_VOICE_THRESHOLD_DAYS} days — win-back email. Greeting and sign-off are added automatically when sent.`
                        : "Greeting, invoice summary, and sign-off are added automatically when sent."}
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
                        : "Email sent"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{communication.message}</div>
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
                  disabled={sending}
                >
                  Simulate execution
                </Button>
              </div>

              <div className="flex w-full flex-wrap gap-2">
                {canEmail && (
                  <Button
                    onClick={() => void handleSendEmail()}
                    disabled={sending || !emailConfigured}
                    className="flex-1"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {draft.agent === "reengagement" ? "Approve & send win-back" : "Approve & send email"}
                  </Button>
                )}

                {canVoice && (
                  <>
                    <Button
                      onClick={() => void handleSendVoiceInvite()}
                      disabled={sending || !emailConfigured || !browserVoiceConfigured}
                      className="flex-1"
                    >
                      {sending ? <Loader2 className="size-4 animate-spin" /> : null}
                      {draft.agent === "reengagement"
                        ? "Send reactivation agent invite"
                        : "Send voice invite"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleStartCall()}
                      disabled={sending || !browserVoiceConfigured}
                      className="flex-1 border-hairline"
                    >
                      <Phone className="size-4" />
                      Start call now
                    </Button>
                  </>
                )}
              </div>

              {canEmail && !emailConfigured && (
                <p className="text-xs text-muted-foreground">
                  Configure SMTP_* and COMMUNICATIONS_TEST_EMAIL in backend .env to send real emails.
                </p>
              )}
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
