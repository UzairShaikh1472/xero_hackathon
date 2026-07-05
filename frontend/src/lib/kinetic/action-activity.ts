import type {
  AuditEntry,
  CommunicationResult,
  FollowUpsData,
  NegotiationDraft,
} from "./types";

const ACTIONED_AUDIT_KINDS = new Set<NonNullable<AuditEntry["kind"]>>([
  "email_sent",
  "voice_invite_sent",
  "call_queued",
  "call_started",
  "call_turn",
  "call_completed",
  "call_report_sent",
]);

function isActionedAuditEntry(entry: AuditEntry) {
  if (entry.kind && ACTIONED_AUDIT_KINDS.has(entry.kind)) return true;
  if (entry.channel === "email" || entry.channel === "call" || entry.channel === "voice_invite") {
    return true;
  }
  return entry.step === "email" || entry.step === "agent_call" || entry.step === "human_call";
}

export function getActionedDraftIds({
  followUps,
  communications,
  audit,
}: {
  followUps?: FollowUpsData;
  communications?: CommunicationResult[];
  audit?: AuditEntry[];
}) {
  const ids = new Set<string>();

  for (const item of communications ?? []) {
    ids.add(item.draftId);
  }

  for (const item of followUps?.open ?? []) {
    ids.add(item.draftId);
  }

  for (const item of followUps?.resolved ?? []) {
    ids.add(item.draftId);
  }

  for (const item of audit ?? []) {
    if (!item.draftId || !isActionedAuditEntry(item)) continue;
    ids.add(item.draftId);
  }

  return ids;
}

export function filterActionableDrafts(
  drafts: NegotiationDraft[],
  sources: {
    followUps?: FollowUpsData;
    communications?: CommunicationResult[];
    audit?: AuditEntry[];
  },
) {
  const actioned = getActionedDraftIds(sources);
  return drafts.filter((draft) => !actioned.has(draft.id));
}

export function splitActivityLogs(audit: AuditEntry[]) {
  const emailLogs = audit
    .filter((entry) => entry.step === "email" || entry.channel === "email")
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const callLogs = audit
    .filter(
      (entry) =>
        entry.step === "agent_call" ||
        entry.step === "human_call" ||
        entry.channel === "call" ||
        entry.channel === "voice_invite",
    )
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return { emailLogs, callLogs };
}

export function mergeAuditWithCommunications(
  audit: AuditEntry[],
  communications: CommunicationResult[],
) {
  const merged = [...audit];
  const existing = new Set(
    audit
      .filter((entry) => entry.draftId && entry.channel)
      .map((entry) => `${entry.draftId}:${entry.channel}`),
  );

  for (const item of communications) {
    const key = `${item.draftId}:${item.channel}`;
    if (existing.has(key)) continue;

    merged.push({
      id: `live-${item.draftId}-${item.channel}`,
      at: item.sentAt ?? new Date().toISOString(),
      actor: "UpFlow",
      action:
        item.channel === "email"
          ? "Reminder email sent"
          : item.channel === "voice_invite"
            ? "Voice invite sent"
            : "Browser voice call started",
      target: item.recipientName,
      rationale: item.message,
      humanInLoop: false,
      kind:
        item.channel === "email"
          ? "email_sent"
          : item.channel === "voice_invite"
            ? "voice_invite_sent"
            : "call_started",
      step: item.channel === "email" ? "email" : "agent_call",
      channel: item.channel,
      draftId: item.draftId,
      status: "completed",
    });
  }

  return merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
