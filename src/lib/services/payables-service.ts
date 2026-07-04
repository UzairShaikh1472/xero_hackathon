import { openPayables } from "../../handlers/payables.js";
import type { ApiEnvelope } from "../domain/types.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";
import { snapshotToNormalized } from "./snapshot-to-normalized.js";

type OpenPayableItem = {
  id: string;
  contactId: string;
  contactName: string;
  amount: number;
  daysOverdue: number;
  urgency: "critical" | "high" | "medium" | "low";
  recommendedAction: string;
  expectedCashImpact: number;
};

type OpenPayablesSnapshot = {
  currency: string;
  totalOpen: number;
  items: OpenPayableItem[];
};

export async function buildOpenPayablesResponse(): Promise<ApiEnvelope<OpenPayablesSnapshot>> {
  const snapshot = await getPhaseOneSnapshotData();
  const normalized = snapshotToNormalized(snapshot);
  const items = openPayables(normalized)
    .map((item) => ({
      id: item.invoiceId,
      contactId: item.contactId,
      contactName: item.contactName,
      amount: Number(item.amount.toFixed(2)),
      daysOverdue: item.daysOverdue,
      urgency: item.urgency,
      recommendedAction: item.recommendedAction,
      expectedCashImpact: Number(item.expectedCashImpact.toFixed(2))
    }))
    .sort((left, right) => {
      if (right.daysOverdue !== left.daysOverdue) {
        return right.daysOverdue - left.daysOverdue;
      }

      return right.amount - left.amount;
    });

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      currency: snapshot.sync.currency,
      totalOpen: items.length,
      items
    }
  };
}
