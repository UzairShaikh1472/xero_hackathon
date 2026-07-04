import type { FollowUpRecord } from "../domain/types.js";

const followUpRecords: FollowUpRecord[] = [];

export function recordFollowUp(
  input: Omit<FollowUpRecord, "id" | "sentAt"> & { sentAt?: string },
): FollowUpRecord {
  const existing = followUpRecords.find(
    (r) => r.draftId === input.draftId && r.channel === input.channel,
  );
  if (existing) {
    return existing;
  }

  const record: FollowUpRecord = {
    ...input,
    id: `followup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sentAt: input.sentAt ?? new Date().toISOString(),
  };
  followUpRecords.unshift(record);
  return record;
}

export function getFollowUpRecords() {
  return [...followUpRecords];
}

export function clearFollowUpRecords() {
  followUpRecords.length = 0;
}
