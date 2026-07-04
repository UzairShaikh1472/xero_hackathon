import { fetchAccountingResource } from "./api.js";

type InvoiceListResponse = {
  Invoices?: Record<string, unknown>[];
};

type ContactListResponse = {
  Contacts?: Record<string, unknown>[];
};

export async function getInvoices(accessToken: string, tenantId: string) {
  const payload = await fetchAccountingResource<InvoiceListResponse>(
    "Invoices",
    accessToken,
    tenantId
  );

  return payload.Invoices ?? [];
}

export async function getContacts(accessToken: string, tenantId: string) {
  const payload = await fetchAccountingResource<ContactListResponse>(
    "Contacts",
    accessToken,
    tenantId
  );

  return payload.Contacts ?? [];
}

export async function getPayments() {
  return [];
}

export async function getBills() {
  return [];
}

export async function getAgedReceivables() {
  return [];
}

export async function getAgedPayables() {
  return [];
}
