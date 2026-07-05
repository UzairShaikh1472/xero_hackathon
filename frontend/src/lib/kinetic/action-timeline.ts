import { groupFollowUps } from "./follow-up";
import type {
  AuditEntry,
  CommunicationResult,
  ExecutionResult,
  FollowUpsData,
  NegotiationDraft,
} from "./types";

export type TimelineEventKind =
  | "email_sent"
  | "voice_invite"
  | "call_started"
  | "human_escalation"
  | "simulated"
  | "follow_up_open"
  | "resolved"
  | "audit";

export type EscalationStepKey = "email" | "agent_call" | "human_call" | "resolved";

export interface TimelineEvent {
  id: string;
  at: string;
  kind: TimelineEventKind;
  step: EscalationStepKey;
  title: string;
  detail?: string;
  contactName?: string;
  amount?: number;
  status?: "pending" | "completed" | "simulated";
}

export interface EscalationStep {
  key: EscalationStepKey;
  step: number;
  title: string;
  subtitle: string;
  events: TimelineEvent[];
}

export const ESCALATION_STEPS: Array<{
  key: EscalationStepKey;
  step: number;
  title: string;
  subtitle: string;
}> = [
  {
    key: "email",
    step: 1,
    title: "Email reminder",
    subtitle: "First step: send a gentle payment reminder",
  },
  {
    key: "agent_call",
    step: 2,
    title: "Call with agent",
    subtitle: "No payment yet: AI voice follow-up at 14+ days overdue",
  },
  {
    key: "human_call",
    step: 3,
    title: "Call with human",
    subtitle: "Still unpaid: escalate high-urgency accounts to you",
  },
  {
    key: "resolved",
    step: 4,
    title: "Payment collected",
    subtitle: "Invoice confirmed paid in Xero",
  },
];

function commKind(channel: CommunicationResult["channel"]): TimelineEventKind {
  if (channel === "email") return "email_sent";
  if (channel === "voice_invite") return "voice_invite";
  return "call_started";
}

function commTitle(channel: CommunicationResult["channel"]): string {
  if (channel === "email") return "Email sent";
  if (channel === "voice_invite") return "Voice invite sent";
  return "Call started";
}

function commStep(channel: CommunicationResult["channel"]): EscalationStepKey {
  if (channel === "email") return "email";
  return "agent_call";
}

function followUpChannelKey(channel: "email" | "call") {
  return channel === "email" ? "email" : "agent_call";
}

function sortByTimeDesc(events: TimelineEvent[]) {
  return [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function buildEscalationTimeline({
  followUps,
  communications,
  executions,
  audit,
  drafts,
}: {
  followUps: FollowUpsData | undefined;
  communications: CommunicationResult[];
  executions: ExecutionResult[];
  audit: AuditEntry[];
  drafts: NegotiationDraft[];
}): EscalationStep[] {
  const draftById = new Map(drafts.map((d) => [d.id, d]));
  const resolvedDraftIds = new Set((followUps?.resolved ?? []).map((r) => r.draftId));
  const sentKeys = new Set<string>();
  const buckets: Record<EscalationStepKey, TimelineEvent[]> = {
    email: [],
    agent_call: [],
    human_call: [],
    resolved: [],
  };

  for (const comm of communications) {
    const at = comm.sentAt ?? new Date().toISOString();
    const channelKey = comm.channel === "email" ? "email" : "call";
    sentKeys.add(`${comm.draftId}:${channelKey}`);

    buckets[commStep(comm.channel)].push({
      id: `comm_${comm.draftId}_${comm.channel}_${at}`,
      at,
      kind: commKind(comm.channel),
      step: commStep(comm.channel),
      title: commTitle(comm.channel),
      detail: comm.message,
      contactName: comm.recipientName,
      status: "completed",
    });
  }

  for (const record of followUps?.open ?? []) {
    const step = followUpChannelKey(record.channel);
    const key = `${record.draftId}:${record.channel}`;
    if (sentKeys.has(key)) continue;

    buckets[step].push({
      id: `open_${record.id}`,
      at: record.sentAt,
      kind: "follow_up_open",
      step,
      title: step === "email" ? "Email sent, awaiting payment" : "Call sent, awaiting payment",
      detail: record.invoiceNumber,
      contactName: record.contactName,
      amount: record.expectedCashImpact,
      status: "pending",
    });
  }

  for (const item of followUps?.resolved ?? []) {
    const originStep = item.channel === "email" ? "email" : "agent_call";

    buckets[originStep].push({
      id: `origin_${item.id}`,
      at: item.sentAt,
      kind: item.channel === "email" ? "email_sent" : "call_started",
      step: originStep,
      title: item.channel === "email" ? "Email sent" : "Call with agent",
      detail: `${item.invoiceNumber} follow-up`,
      contactName: item.contactName,
      status: "completed",
    });

    buckets.resolved.push({
      id: `resolved_${item.id}`,
      at: item.resolvedAt,
      kind: "resolved",
      step: "resolved",
      title: "Payment collected",
      detail: `${item.invoiceNumber} confirmed via Xero`,
      contactName: item.contactName,
      amount: item.amountCollected,
      status: "completed",
    });
  }

  const { humanCall } = groupFollowUps(drafts);
  for (const draft of humanCall) {
    if (resolvedDraftIds.has(draft.id)) continue;
    const alreadyListed = buckets.human_call.some(
      (e) => e.contactName === draft.targetName && e.kind === "human_escalation",
    );
    if (alreadyListed) continue;

    buckets.human_call.push({
      id: `human_${draft.id}`,
      at: new Date().toISOString(),
      kind: "human_escalation",
      step: "human_call",
      title: "Needs human escalation",
      detail: draft.reason,
      contactName: draft.targetName,
      amount: draft.expectedCashImpact,
      status: "pending",
    });
  }

  for (const exec of executions) {
    const draft = draftById.get(exec.draftId);
    if (!draft || draft.agent !== "receivables") continue;

    const daysOverdue = draft.daysOverdue ?? 0;
    const step: EscalationStepKey =
      daysOverdue >= 14 ? "agent_call" : "email";

    buckets[step].push({
      id: `exec_${exec.draftId}_${exec.executedAt}`,
      at: exec.executedAt,
      kind: "simulated",
      step,
      title: "Execution simulated",
      detail: exec.note,
      contactName: draft.targetName,
      amount: exec.cashImpact,
      status: "simulated",
    });
  }

  for (const entry of audit) {
    if (!entry.action.toLowerCase().includes("draft")) continue;

    buckets.email.push({
      id: `audit_${entry.id}`,
      at: entry.at,
      kind: "audit",
      step: "email",
      title: entry.action,
      detail: entry.rationale,
      contactName: entry.target,
      status: "completed",
    });
  }

  return ESCALATION_STEPS.map((def) => ({
    ...def,
    events: sortByTimeDesc(buckets[def.key]),
  }));
}

/** @deprecated Use buildEscalationTimeline */
export function buildActionTimeline(args: Parameters<typeof buildEscalationTimeline>[0]): TimelineEvent[] {
  return buildEscalationTimeline(args).flatMap((step) => step.events);
}
