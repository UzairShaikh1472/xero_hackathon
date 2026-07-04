import type {
  ApiEnvelope,
  ContactSummary,
  InvoiceSummary,
  RevenueOpportunitiesSnapshot,
  RevenueOpportunity
} from "../domain/types.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";

function sumInvoicesForContact(contactId: string, invoices: InvoiceSummary[]) {
  return invoices
    .filter((invoice) => invoice.contactId === contactId)
    .reduce((sum, invoice) => sum + invoice.amountDue.amount, 0);
}

function buildRepeatBuyerOpportunity(
  contact: ContactSummary,
  currency: string
): RevenueOpportunity | null {
  if (contact.totalInvoices < 2) {
    return null;
  }

  const estimatedValue = Number((contact.averageInvoice.amount * 0.9).toFixed(2));

  return {
    id: `repeat_buyer_${contact.id}`,
    type: "repeat_buyer",
    contactId: contact.id,
    contactName: contact.name,
    estimatedValue: {
      amount: estimatedValue,
      currency
    },
    reason: `${contact.name} has repeat invoice activity and an average invoice value of ${currency} ${contact.averageInvoice.amount}.`,
    priority: contact.averageInvoice.amount >= 5000 ? "high" : "medium",
    recommendedAction: "Generate a re-engagement quote or upsell proposal."
  };
}

function buildLapsedCustomerOpportunity(
  contact: ContactSummary,
  invoices: InvoiceSummary[],
  currency: string
): RevenueOpportunity | null {
  const contactInvoices = invoices.filter((invoice) => invoice.contactId === contact.id);
  const lastInvoiceDate = contact.lastInvoiceDate ? new Date(contact.lastInvoiceDate) : null;

  if (!lastInvoiceDate || Number.isNaN(lastInvoiceDate.getTime())) {
    return null;
  }

  const daysSinceLastInvoice = Math.round((Date.now() - lastInvoiceDate.getTime()) / 86400000);
  if (daysSinceLastInvoice < 14) {
    return null;
  }

  const estimatedValue = Number((sumInvoicesForContact(contact.id, invoices) * 0.35).toFixed(2));

  return {
    id: `lapsed_customer_${contact.id}`,
    type: "lapsed_customer",
    contactId: contact.id,
    contactName: contact.name,
    estimatedValue: {
      amount: estimatedValue,
      currency
    },
    reason: `${contact.name} has gone ${daysSinceLastInvoice} days without new invoice activity.`,
    priority: daysSinceLastInvoice >= 30 ? "high" : "medium",
    recommendedAction: "Draft a win-back message with a time-boxed offer."
  };
}

export async function buildRevenueOpportunitiesResponse(): Promise<
  ApiEnvelope<RevenueOpportunitiesSnapshot>
> {
  const snapshot = await getPhaseOneSnapshotData();
  const currency = snapshot.sync.currency;

  const opportunities = snapshot.contacts
    .flatMap((contact) => [
      buildRepeatBuyerOpportunity(contact, currency),
      buildLapsedCustomerOpportunity(contact, snapshot.invoices, currency)
    ])
    .filter((item): item is RevenueOpportunity => Boolean(item))
    .sort((left, right) => right.estimatedValue.amount - left.estimatedValue.amount);

  const estimatedRevenueUnlock = opportunities.reduce(
    (sum, item) => sum + item.estimatedValue.amount,
    0
  );

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      organizationName: snapshot.sync.organizationName ?? "Unknown Organization",
      currency,
      totalOpportunities: opportunities.length,
      estimatedRevenueUnlock: {
        amount: Number(estimatedRevenueUnlock.toFixed(2)),
        currency
      },
      items: opportunities
    }
  };
}
