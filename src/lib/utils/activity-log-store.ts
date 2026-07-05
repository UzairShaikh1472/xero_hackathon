import fs from "node:fs";
import path from "node:path";

import type { ActivityLogEntry } from "../domain/types.js";

const dataDir = path.resolve(process.cwd(), ".data");
const activityLogFilePath = path.join(dataDir, "activity-log-records.json");

function loadActivityLogs(): ActivityLogEntry[] {
  try {
    if (!fs.existsSync(activityLogFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(activityLogFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActivityLogEntry[]) : [];
  } catch {
    return [];
  }
}

function persistActivityLogs(records: ActivityLogEntry[]) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(activityLogFilePath, JSON.stringify(records, null, 2));
}

const activityLogs: ActivityLogEntry[] = loadActivityLogs();

export function appendActivityLog(
  input: Omit<ActivityLogEntry, "id" | "at"> & { at?: string },
): ActivityLogEntry {
  const record: ActivityLogEntry = {
    ...input,
    id: `activity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: input.at ?? new Date().toISOString(),
  };
  activityLogs.unshift(record);
  persistActivityLogs(activityLogs);
  return record;
}

export function getActivityLogs() {
  return [...activityLogs];
}

export function clearActivityLogs() {
  activityLogs.length = 0;
  persistActivityLogs(activityLogs);
}

