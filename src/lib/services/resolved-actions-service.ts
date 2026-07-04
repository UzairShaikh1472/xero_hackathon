import type { ApiEnvelope, FollowUpsSnapshot, ResolvedAction } from "../domain/types.js";
import { getBackendMode } from "../config/runtime-mode.js";
import { getFollowUpRecords } from "../utils/follow-up-store.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";

const FALLBACK_RESOLVED: ResolvedAction[] = [
  {
    id: "resolved-demo-1",
    draftId: "draft-demo-paid-1",
    invoiceId: "inv-1020",
    contactName: "Brightstar Office Supplies",
    invoiceNumber: "INV-1020",
    channel: "email",
    sentAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    resolvedAt: new Date(Date.now() - 86400000).toISOString(),
    amountCollected: 6200,
    currency: "GBP",
    source: "xero",
  },
  {
    id: "resolved-demo-2",
    draftId: "draft-demo-paid-2",
    invoiceId: "inv-1015",
    contactName: "Cedar Lane Catering",
    invoiceNumber: "INV-1015",
    channel: "call",
    sentAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    resolvedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    amountCollected: 4150,
    currency: "GBP",
    source: "xero",
  },
];

function isInvoiceResolved(invoiceId: string, invoices: Awaited<ReturnType<typeof getPhaseOneSnapshotData>>["invoices"]) {
  const invoice = invoices.find((item) => item.id === invoiceId);
  if (!invoice) {
    return true;
  }
  return !invoice.isOutstanding;
}

export async function buildFollowUpsResponse(): Promise<ApiEnvelope<FollowUpsSnapshot>> {
  const snapshot = await getPhaseOneSnapshotData();
  const mode = snapshot.sync.source ?? getBackendMode();
  const now = new Date().toISOString();

  if (mode === "fallback") {
    return {
      ok: true,
      mode: "fallback",
      generatedAt: now,
      data: {
        open: [],
        resolved: FALLBACK_RESOLVED,
      },
    };
  }

  const records = getFollowUpRecords();
  const open: FollowUpsSnapshot["open"] = [];
  const resolved: ResolvedAction[] = [];

  for (const record of records) {
    if (isInvoiceResolved(record.invoiceId, snapshot.invoices)) {
      const invoice = snapshot.invoices.find((item) => item.id === record.invoiceId);
      resolved.push({
        id: `resolved_${record.id}`,
        draftId: record.draftId,
        invoiceId: record.invoiceId,
        contactName: record.contactName,
        invoiceNumber: record.invoiceNumber,
        channel: record.channel,
        sentAt: record.sentAt,
        resolvedAt: now,
        amountCollected: invoice
          ? Number((invoice.total.amount - invoice.amountDue.amount).toFixed(2)) ||
            record.expectedCashImpact
          : record.expectedCashImpact,
        currency: record.currency,
        source: "xero",
      });
    } else {
      open.push(record);
    }
  }

  return {
    ok: true,
    mode: "live",
    generatedAt: now,
    data: { open, resolved },
  };
}
