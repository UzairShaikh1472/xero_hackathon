import type { FollowUpsData, ResolvedAction } from "./types";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export const seedFollowUps: FollowUpsData = {
  open: [],
  resolved: [
    {
      id: "resolved-demo-1",
      draftId: "draft-demo-paid-1",
      invoiceId: "inv-1020",
      contactName: "Brightstar Office Supplies",
      invoiceNumber: "INV-1020",
      channel: "email",
      sentAt: daysAgo(5),
      resolvedAt: daysAgo(1),
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
      sentAt: daysAgo(8),
      resolvedAt: daysAgo(2),
      amountCollected: 4150,
      currency: "GBP",
      source: "xero",
    },
  ] satisfies ResolvedAction[],
};
