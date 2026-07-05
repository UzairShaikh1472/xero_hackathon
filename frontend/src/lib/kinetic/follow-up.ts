import type { FollowUpChannel, NegotiationDraft } from "./types";

function getDaysOverdue(draft: NegotiationDraft): number {
  if (draft.daysOverdue != null) return draft.daysOverdue;
  const match = draft.reason.match(/(\d+)\s+days?\s+overdue/i);
  return match ? Number(match[1]) : 0;
}

export function groupFollowUps(drafts: NegotiationDraft[]) {
  const receivables = drafts.filter((d) => d.agent === "receivables");
  const humanCall: NegotiationDraft[] = [];

  return {
    email: receivables.filter((d) => getDaysOverdue(d) < 14),
    agentCall: receivables.filter((d) => getDaysOverdue(d) >= 14),
    humanCall,
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
