import type { ActivityLogSnapshot, ApiEnvelope } from "../domain/types.js";
import { getActivityLogs } from "../utils/activity-log-store.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";

export async function buildActivityLogResponse(): Promise<ApiEnvelope<ActivityLogSnapshot>> {
  const snapshot = await getPhaseOneSnapshotData();
  const items = getActivityLogs();

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      totalEvents: items.length,
      items,
    },
  };
}
