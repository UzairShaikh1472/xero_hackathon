import fs from "node:fs";
import path from "node:path";

import type { FollowUpRecord } from "../domain/types.js";

const dataDir = path.resolve(process.cwd(), ".data");
const followUpFilePath = path.join(dataDir, "follow-up-records.json");

function loadFollowUpRecords(): FollowUpRecord[] {
  try {
    if (!fs.existsSync(followUpFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(followUpFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FollowUpRecord[]) : [];
  } catch {
    return [];
  }
}

function persistFollowUpRecords(records: FollowUpRecord[]) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(followUpFilePath, JSON.stringify(records, null, 2));
}

const followUpRecords: FollowUpRecord[] = loadFollowUpRecords();

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
  persistFollowUpRecords(followUpRecords);
  return record;
}

export function getFollowUpRecords() {
  return [...followUpRecords];
}

export function clearFollowUpRecords() {
  followUpRecords.length = 0;
  persistFollowUpRecords(followUpRecords);
}
