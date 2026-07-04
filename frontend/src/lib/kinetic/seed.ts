import type { ControlRoomData, InvoiceRisk } from "./types";

// Mirrors src/engines/recovery.ts on the backend — kept in sync by hand since
// this fixture has no access to the backend module.
function estimateRecovery(amount: number, daysOverdue: number) {
  const days = Math.max(0, daysOverdue);
  const baseProbability =
    days <= 30 ? 0.95 : days <= 60 ? 0.85 : days <= 90 ? 0.7 : days <= 120 ? 0.5 : 0.25;
  const expectedDaysToCollect = days <= 30 ? 14 : days <= 60 ? 21 : days <= 90 ? 30 : 45;
  const recoveryProbability = Math.min(0.98, baseProbability * 0.9); // no payment history in demo data
  const timeDiscount = (0.125 / 365) * expectedDaysToCollect;
  const expectedRecovery = Number((amount * recoveryProbability * (1 - timeDiscount)).toFixed(2));
  return { recoveryProbability, expectedDaysToCollect, expectedRecovery };
}

function withRecovery(
  invoice: Omit<InvoiceRisk, "recoveryProbability" | "expectedDaysToCollect" | "expectedRecovery">,
): InvoiceRisk {
  return { ...invoice, ...estimateRecovery(invoice.amount, invoice.daysOverdue) };
}

const today = new Date();
const iso = (d: Date) => d.toISOString();
const daysFromNow = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

// 30-day inflow/outflow projection with a visible dip around day 14-18.
const daily = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const inflow = 4200 + Math.round(Math.sin(i / 3) * 1800) + (i > 20 ? 3200 : 0);
  const outflow =
    3800 +
    Math.round(Math.cos(i / 4) * 1400) +
    (i >= 12 && i <= 18 ? 4200 : 0); // payroll + supplier bunching
  const prev = i === 0 ? 48200 : 0;
  return { day, inflow, outflow, balance: prev };
});
let running = 48200;
daily.forEach((d) => {
  running += d.inflow - d.outflow;
  d.balance = running;
});

const projectedInflow = daily.reduce((s, d) => s + d.inflow, 0);
const projectedOutflow = daily.reduce((s, d) => s + d.outflow, 0);
const projectedShortfall = projectedInflow - projectedOutflow;

const atRiskInvoices: InvoiceRisk[] = [
  {
    id: "inv-1041",
    customer: "Northwind Logistics",
    amount: 12400,
    daysOverdue: 14,
    dueDate: daysFromNow(-14),
    riskScore: 88,
    reason: "Historically pays in 5 days. 14 days overdue: likely queue error.",
  },
  {
    id: "inv-1039",
    customer: "Halcyon Foods Ltd",
    amount: 8750,
    daysOverdue: 9,
    dueDate: daysFromNow(-9),
    riskScore: 74,
    reason: "Large amount, first late payment in 12 months.",
  },
  {
    id: "inv-1052",
    customer: "Kestrel Interiors",
    amount: 5320,
    daysOverdue: 22,
    dueDate: daysFromNow(-22),
    riskScore: 91,
    reason: "Third overdue invoice this quarter: escalate.",
  },
  {
    id: "inv-1058",
    customer: "Meridian Print Co.",
    amount: 3100,
    daysOverdue: 3,
    dueDate: daysFromNow(-3),
    riskScore: 52,
    reason: "Small variance from typical 30d cycle.",
  },
].map(withRecovery);

const recoverableCash = atRiskInvoices
  .filter((inv) => inv.daysOverdue > 0)
  .reduce((sum, inv) => sum + inv.expectedRecovery, 0);

export const seedData: ControlRoomData = {
  snapshot: {
    orgName: "Acme Trading Co.",
    connectedVia: "Xero",
    lastSyncAt: iso(today),
    mode: "fallback",
    currency: "GBP",
    currentCash: 48200,
    overdueReceivables: 62480,
    recoverableCash,
    revenueOpportunityTotal: 12800 + 9400 + 7200,
  },
  liquidity: {
    dso: 47,
    dpo: 31,
    ccc: 16,
    horizonDays: 30,
    projectedInflow,
    projectedOutflow,
    projectedShortfall,
    daily,
  },
  atRiskInvoices,
  supplierOpportunities: [
    {
      id: "sup-221",
      supplier: "Ironbridge Metals",
      amount: 18400,
      daysUntilDue: 4,
      extensionDays: 14,
      cashRetained: 18400,
      reason: "Strong supplier relationship, extension historically approved.",
    },
    {
      id: "sup-238",
      supplier: "Coastline Freight",
      amount: 6200,
      daysUntilDue: 2,
      extensionDays: 7,
      cashRetained: 6200,
      reason: "Non-critical, monthly cadence.",
    },
  ],
  lapsedCustomers: [
    {
      id: "cust-88",
      name: "Blackwood & Sons",
      ltv: 84200,
      daysSilent: 92,
      recoveryPotential: 12800,
      lastInvoice: daysFromNow(-92),
    },
    {
      id: "cust-104",
      name: "Verdant Cafés Group",
      ltv: 51600,
      daysSilent: 67,
      recoveryPotential: 9400,
      lastInvoice: daysFromNow(-67),
    },
    {
      id: "cust-56",
      name: "Sable Interiors",
      ltv: 38900,
      daysSilent: 74,
      recoveryPotential: 7200,
      lastInvoice: daysFromNow(-74),
    },
  ],
  repeatBuyers: [
    {
      id: "cust-12",
      name: "Northwind Logistics",
      transactions12m: 18,
      avgInvoice: 6400,
      upsellPotential: 5800,
    },
    {
      id: "cust-19",
      name: "Halcyon Foods Ltd",
      transactions12m: 11,
      avgInvoice: 4900,
      upsellPotential: 3600,
    },
    {
      id: "cust-31",
      name: "Meridian Print Co.",
      transactions12m: 9,
      avgInvoice: 2800,
      upsellPotential: 2500,
    },
  ],
  drafts: [
    {
      id: "draft-r0",
      actionType: "receivables_discount",
      agent: "receivables",
      targetName: "Northwind Logistics",
      targetId: "inv-1041",
      invoiceId: "inv-1041",
      currency: "GBP",
      daysOverdue: 12,
      contactEmail: "sarah@northwind.example",
      urgency: "high",
      reason:
        "£12,400 overdue by 12 days. Historically pays within 5 days: likely internal queue delay.",
      proposedAction: "Send a warm email reminder with a 2% early-settlement discount if paid within 48h.",
      expectedCashImpact: 12152,
      hoursToImpact: 48,
      confidence: 0.86,
      subject: "Quick nudge on invoice #1041: small discount if it helps",
      body:
        "Hi Sarah,\n\nHope you're well. Just a quick note that invoice #1041 (£12,400) is showing as 12 days overdue on our side, very unlike Northwind. If it helps close it out this week, we're happy to apply a 2% early-settlement discount for payment received in the next 48 hours.\n\nHappy to resend the PDF or route to a different contact if useful.\n\nBest,\nFinance @ Acme",
    },
    {
      id: "draft-r1",
      actionType: "receivables_discount",
      agent: "reengagement",
      targetName: "Northwind Logistics",
      targetId: "inv-1041",
      invoiceId: "inv-1041",
      currency: "GBP",
      daysOverdue: 14,
      urgency: "high",
      reason:
        "£12,400 overdue by 14 days. Historically pays within 5 days: likely internal queue delay.",
      proposedAction: "Send a warm reminder with a 2% early-settlement discount if paid within 48h.",
      expectedCashImpact: 12152,
      hoursToImpact: 48,
      confidence: 0.86,
      subject: "Quick nudge on invoice #1041: small discount if it helps",
      body:
        "Hi Sarah,\n\nHope you're well. Just a quick note that invoice #1041 (£12,400) is showing as 14 days overdue on our side, very unlike Northwind. If it helps close it out this week, we're happy to apply a 2% early-settlement discount for payment received in the next 48 hours.\n\nHappy to resend the PDF or route to a different contact if useful.\n\nBest,\nFinance @ Acme",
    },
    {
      id: "draft-r2",
      actionType: "receivables_discount",
      agent: "receivables",
      targetName: "Kestrel Interiors",
      targetId: "inv-1052",
      invoiceId: "inv-1052",
      currency: "GBP",
      daysOverdue: 22,
      contactPhone: "+44 7700 900123",
      urgency: "critical",
      reason: "Third overdue invoice this quarter. £5,320 outstanding for 22 days.",
      proposedAction: "Formal escalation with a proposed 3-instalment payment plan.",
      expectedCashImpact: 5320,
      hoursToImpact: 168,
      confidence: 0.71,
      subject: "Payment plan proposal: invoice #1052",
      body:
        "Hi James,\n\nInvoice #1052 (£5,320) is now 22 days overdue and is your third late payment this quarter. To keep the account in good standing we'd like to propose a three-instalment plan over the next 30 days.\n\nCould you confirm by Friday whether this works, or share a preferred alternative?\n\nRegards,\nFinance @ Acme",
    },
    {
      id: "draft-p1",
      actionType: "payables_extension",
      agent: "payables",
      targetName: "Ironbridge Metals",
      targetId: "sup-221",
      currency: "GBP",
      urgency: "medium",
      reason: "£18,400 due in 4 days coincides with projected liquidity dip on day 14-18.",
      proposedAction: "Request a 14-day extension to smooth cash outflow through payroll week.",
      expectedCashImpact: 18400,
      hoursToImpact: 24,
      confidence: 0.78,
      subject: "Small ask: 14-day extension on PO-8842",
      body:
        "Hi Marcus,\n\nCould we push the settlement of PO-8842 (£18,400) by 14 days? It would help us smooth a short window around payroll, with no impact on the ongoing programme, and happy to confirm the new date in writing.\n\nAppreciate you considering.\n\nBest,\nFinance @ Acme",
    },
    {
      id: "draft-r3",
      actionType: "reengagement_quote",
      agent: "reengagement",
      targetName: "Blackwood & Sons",
      targetId: "cust-88",
      currency: "GBP",
      urgency: "medium",
      reason: "Lapsed 92 days. £84.2k LTV. Estimated £12.8k recoverable.",
      proposedAction: "Re-engagement offer: 5% credit on next order placed this month.",
      expectedCashImpact: 12800,
      hoursToImpact: 336,
      confidence: 0.62,
      subject: "It's been a while: a small thank-you if you're back this month",
      body:
        "Hi Eleanor,\n\nIt's been a few months since your last order and we wanted to check in. If Blackwood & Sons places an order before month-end, we'll apply a 5% credit against the invoice as a thank-you for the long-standing partnership.\n\nHappy to jump on a quick call if useful.\n\nBest,\nAccounts @ Acme",
    },
  ],
  audit: [
    {
      id: "aud-1",
      at: daysFromNow(0),
      actor: "Receivables Agent",
      action: "Drafted reminder",
      target: "Northwind Logistics · inv-1041",
      rationale: "14 days overdue vs 5-day historical average.",
      humanInLoop: true,
    },
    {
      id: "aud-2",
      at: daysFromNow(0),
      actor: "Payables Agent",
      action: "Drafted extension request",
      target: "Ironbridge Metals · PO-8842",
      rationale: "Aligns outflow with projected day-14 liquidity dip.",
      humanInLoop: true,
    },
  ],
};
