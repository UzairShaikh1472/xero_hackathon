import { Bot, Mail, Phone, ScrollText, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { gbp, timeAgo } from "@/lib/kinetic/format";
import { splitActivityLogs } from "@/lib/kinetic/action-activity";
import type { AuditEntry } from "@/lib/kinetic/types";
import { cn } from "@/lib/utils";

import { LensHeader } from "./shared";

function logIcon(entry: AuditEntry) {
  if (entry.channel === "email" || entry.step === "email") {
    return <Mail className="size-3.5" />;
  }
  if (entry.step === "human_call") {
    return (
      <span className="flex items-center gap-0.5">
        <User className="size-3.5" />
        <Phone className="size-3.5" />
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5">
      <Bot className="size-3.5" />
      <Phone className="size-3.5" />
    </span>
  );
}

function logLabel(entry: AuditEntry) {
  switch (entry.kind) {
    case "email_sent":
      return "Email";
    case "voice_invite_sent":
      return "Voice invite";
    case "call_queued":
      return "Queued";
    case "call_started":
      return "Call started";
    case "call_turn":
      return entry.actor === "Client" ? "Client reply" : "Agent reply";
    case "call_completed":
      return "Call ended";
    case "call_report_sent":
      return "Report sent";
    default:
      return "Saved";
  }
}

export function ActionsActivityLogs({ audit }: { audit: AuditEntry[] }) {
  const { emailLogs, callLogs } = splitActivityLogs(audit);

  return (
    <section className="space-y-5">
      <LensHeader
        icon={<ScrollText className="size-4" />}
        title="Saved activity logs"
        subtitle="Everything already sent, started, or captured stays here."
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ActivityLogPanel
          title="Email log"
          subtitle="Reminder and follow-up email history"
          count={emailLogs.length}
          emptyHint="No saved email activity yet."
          items={emailLogs}
        />
        <ActivityLogPanel
          title="Call log"
          subtitle="Voice invites, live calls, and conversation events"
          count={callLogs.length}
          emptyHint="No saved call activity yet."
          items={callLogs}
        />
      </div>
    </section>
  );
}

function ActivityLogPanel({
  title,
  subtitle,
  count,
  emptyHint,
  items,
}: {
  title: string;
  subtitle: string;
  count: number;
  emptyHint: string;
  items: AuditEntry[];
}) {
  return (
    <div className="panel flex flex-col p-6" style={{ boxShadow: "var(--shadow-elevated)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
        </div>
        <Badge variant="outline" className="border-hairline bg-white/45">
          {count} saved
        </Badge>
      </div>

      <ScrollArea className="mt-5 h-[360px] pr-3">
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="rounded-2xl border border-dashed hairline bg-surface-2/45 p-5 text-sm text-muted-foreground">
              {emptyHint}
            </p>
          ) : (
            items.map((item) => <ActivityLogCard key={item.id} item={item} />)
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ActivityLogCard({ item }: { item: AuditEntry }) {
  return (
    <article className="rounded-2xl border hairline bg-surface-2/48 p-4 transition-colors duration-200 hover:bg-white/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full border hairline bg-surface text-info shadow-sm">
              {logIcon(item)}
            </span>
            <span className="font-medium">{item.action}</span>
            <Badge variant="outline" className="h-5 border-hairline bg-white/55 text-[11px]">
              {logLabel(item)}
            </Badge>
          </div>
          <div className="mt-1 pl-9 text-sm text-muted-foreground">
            {item.target}
          </div>
          {item.rationale && (
            <p className="mt-1 pl-9 text-sm text-muted-foreground line-clamp-3">
              {item.rationale}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <div suppressHydrationWarning>{timeAgo(item.at)}</div>
          {item.amount != null && item.amount > 0 && (
            <div
              className={cn(
                "numeric mt-1 text-sm font-medium",
                item.step === "email" ? "text-foreground" : "text-positive",
              )}
            >
              {item.step === "email" ? "" : "+"}
              {gbp(item.amount)}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
