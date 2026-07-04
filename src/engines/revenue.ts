import { daysBetween } from "../lib/dates.js";
import {
  lapsedCustomerScore,
  paymentVelocityForContact,
  repeatBuyerScore,
} from "../scoring/index.js";
import type {
  LapsedCustomer,
  NormalizedData,
  NormalizedInvoice,
  PaymentVelocitySignal,
  RepeatBuyer,
} from "../types/financial.js";

/** Days without activity before a customer is considered lapsed. */
export const LAPSED_THRESHOLD_DAYS = 90;

export interface RevenueOpportunities {
  lapsedCustomers: LapsedCustomer[];
  repeatBuyers: RepeatBuyer[];
  /** All contacts with enough payment history; UI can filter isSlowingDown. */
  velocitySignals: PaymentVelocitySignal[];
}

interface CustomerActivity {
  contactId: string;
  contactName: string;
  invoices: NormalizedInvoice[];
  lastInvoiceDate: string;
  daysSinceLastActivity: number;
  historicalLTV: number;
  transactionCount: number;
  averageInvoiceSize: number;
}

export function analyzeRevenue(data: NormalizedData): RevenueOpportunities {
  const asOf = data.asOfDate;
  const activities = buildCustomerActivities(data, asOf);

  const lapsedCustomers = activities
    .filter((a) => a.daysSinceLastActivity >= LAPSED_THRESHOLD_DAYS)
    .map(
      (a): LapsedCustomer => ({
        contactId: a.contactId,
        contactName: a.contactName,
        lastInvoiceDate: a.lastInvoiceDate,
        daysSinceLastActivity: a.daysSinceLastActivity,
        historicalLTV: a.historicalLTV,
        lapsedScore: lapsedCustomerScore(
          a.historicalLTV,
          a.daysSinceLastActivity,
        ),
        recommendedAction: "Send re-engagement quote",
      }),
    )
    .sort((a, b) => b.lapsedScore - a.lapsedScore);

  const repeatBuyers = activities
    .filter(
      (a) =>
        a.transactionCount >= 2 &&
        a.daysSinceLastActivity < LAPSED_THRESHOLD_DAYS,
    )
    .map(
      (a): RepeatBuyer => ({
        contactId: a.contactId,
        contactName: a.contactName,
        transactionCount: a.transactionCount,
        averageInvoiceSize: a.averageInvoiceSize,
        repeatScore: repeatBuyerScore(
          a.transactionCount,
          a.averageInvoiceSize,
          a.daysSinceLastActivity,
        ),
        upsellOpportunity: upsellOpportunity(a),
      }),
    )
    .sort((a, b) => b.repeatScore - a.repeatScore);

  const paymentsByContact = new Map<string, typeof data.payments>();
  for (const payment of data.payments) {
    const list = paymentsByContact.get(payment.contactId) ?? [];
    list.push(payment);
    paymentsByContact.set(payment.contactId, list);
  }

  const velocitySignals: PaymentVelocitySignal[] = [];
  for (const [contactId, payments] of paymentsByContact) {
    const name =
      data.contacts.find((c) => c.contactId === contactId)?.contactName ??
      contactId;
    const signal = paymentVelocityForContact(contactId, name, payments);
    if (signal) velocitySignals.push(signal);
  }
  velocitySignals.sort((a, b) => b.velocityDecay - a.velocityDecay);

  return { lapsedCustomers, repeatBuyers, velocitySignals };
}

function buildCustomerActivities(
  data: NormalizedData,
  asOf: string,
): CustomerActivity[] {
  const customerInvoices = data.invoices.filter((inv) => inv.type === "ACCREC");
  const byContact = new Map<string, NormalizedInvoice[]>();

  for (const inv of customerInvoices) {
    const list = byContact.get(inv.contactId) ?? [];
    list.push(inv);
    byContact.set(inv.contactId, list);
  }

  const activities: CustomerActivity[] = [];

  for (const [contactId, invoices] of byContact) {
    const lastInvoiceDate = invoices
      .map((i) => i.date)
      .sort()
      .at(-1)!;
    const historicalLTV = invoices.reduce((sum, i) => sum + i.amount, 0);
    const transactionCount = invoices.length;

    activities.push({
      contactId,
      contactName:
        data.contacts.find((c) => c.contactId === contactId)?.contactName ??
        invoices[0]!.contactName,
      invoices,
      lastInvoiceDate,
      daysSinceLastActivity: daysBetween(lastInvoiceDate, asOf),
      historicalLTV,
      transactionCount,
      averageInvoiceSize: historicalLTV / transactionCount,
    });
  }

  return activities;
}

function upsellOpportunity(activity: CustomerActivity): string {
  if (activity.averageInvoiceSize >= 4000) {
    return "Offer volume package on next order";
  }
  if (activity.transactionCount >= 4) {
    return "Propose subscription / retainer plan";
  }
  return "Offer loyalty discount on next invoice";
}
