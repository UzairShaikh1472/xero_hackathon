import type { ApiEnvelope, ExecutionHistorySnapshot } from "../domain/types.js";
import { getExecutionHistory } from "../utils/idempotency.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";

export async function buildExecutionHistoryResponse(): Promise<
  ApiEnvelope<ExecutionHistorySnapshot>
> {
  const snapshot = await getPhaseOneSnapshotData();
  const items = getExecutionHistory();

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      totalExecutions: items.length,
      items
    }
  };
}
