// Swap seam. Today: returns seed. Tomorrow: Person 1 points these at real endpoints.
import { seedData } from "./seed";
import type { ControlRoomData, ExecutionResult, NegotiationDraft } from "./types";

export async function fetchControlRoom(): Promise<ControlRoomData> {
  return structuredClone(seedData);
}

export async function simulateExecute(
  draft: NegotiationDraft,
  currentShortfall: number,
): Promise<ExecutionResult> {
  return {
    draftId: draft.id,
    status: "simulated",
    executedAt: new Date().toISOString(),
    cashImpact: draft.expectedCashImpact,
    newProjectedShortfall: currentShortfall + draft.expectedCashImpact,
    note: `Simulated ${draft.agent === "receivables" ? "collection" : "extension"} — no Xero write-back performed.`,
  };
}
