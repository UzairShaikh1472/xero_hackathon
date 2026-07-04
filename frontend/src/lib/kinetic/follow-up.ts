import type { FollowUpChannel, NegotiationDraft } from "./types";
import { reactivationUsesVoice } from "./reactivation";

function getDaysOverdue(draft: NegotiationDraft): number {
  if (draft.daysOverdue != null) return draft.daysOverdue;
  const match = draft.reason.match(/(\d+)\s+days?\s+overdue/i);
  return match ? Number(match[1]) : 0;
}

function getDaysSilent(draft: NegotiationDraft): number {
  if (draft.daysSilent != null) return draft.daysSilent;
  const inactive = draft.reason.match(/(\d+)\s+days?\s+inactive/i);
  if (inactive) return Number(inactive[1]);
  const silent = draft.reason.match(/(\d+)\s+days?\s+silent/i);
  if (silent) return Number(silent[1]);
  return 0;
}

export function groupFollowUps(drafts: NegotiationDraft[]) {
  const receivables = drafts.filter((d) => d.agent === "receivables");
  const reengagement = drafts.filter((d) => d.agent === "reengagement");

  return {
    email: [
      ...receivables.filter((d) => getDaysOverdue(d) < 14),
      ...reengagement.filter((d) => !reactivationUsesVoice(getDaysSilent(d))),
    ],
    agentCall: [
      ...receivables.filter((d) => getDaysOverdue(d) >= 14),
      ...reengagement.filter((d) => reactivationUsesVoice(getDaysSilent(d))),
    ],
    humanCall: receivables.filter(
      (d) => d.urgency === "critical" || d.urgency === "high",
    ),
  };
}

export function countFollowUps(drafts: NegotiationDraft[]): number {
  const groups = groupFollowUps(drafts);
  const ids = new Set([
    ...groups.email.map((d) => d.id),
    ...groups.agentCall.map((d) => d.id),
    ...groups.humanCall.map((d) => d.id),
  ]);
  return ids.size;
}

export function channelLabel(channel: FollowUpChannel): string {
  switch (channel) {
    case "email":
      return "Email";
    case "agent_call":
      return "Call with agent";
    case "human_call":
      return "Call with human";
  }
}
