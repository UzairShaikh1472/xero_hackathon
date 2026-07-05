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

export async function getLastMonthCashFlow(accessToken: string, tenantId: string): Promise<number> {
  const now = new Date();
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const fmt = (d: Date) => `DateTime(${d.getFullYear()},${d.getMonth() + 1},${d.getDate()})`;
  const where = `Date>=${fmt(firstOfLastMonth)}&&Date<=${fmt(lastOfLastMonth)}`;

  type BankTxnResponse = { BankTransactions?: { Type: string; Total: number; IsReconciled?: boolean }[] };
  const payload = await fetchAccountingResource<BankTxnResponse>(
    `BankTransactions?where=${encodeURIComponent(where)}`,
    accessToken,
    tenantId
  );

  const txns = payload.BankTransactions ?? [];
  const inflows = txns.filter(t => t.Type === "RECEIVE").reduce((s, t) => s + (t.Total ?? 0), 0);
  const outflows = txns.filter(t => t.Type === "SPEND").reduce((s, t) => s + (t.Total ?? 0), 0);
  return inflows - outflows;
}

export async function getBankAccounts(accessToken: string, tenantId: string): Promise<number> {
  type ReportResponse = {
    Reports?: {
      Rows?: {
        RowType: string;
        Rows?: {
          RowType: string;
          Cells?: { Value: string }[];
        }[];
      }[];
    }[];
  };
  const payload = await fetchAccountingResource<ReportResponse>(
    "Reports/BankSummary",
    accessToken,
    tenantId
  );

  let total = 0;
  for (const report of payload.Reports ?? []) {
    for (const section of report.Rows ?? []) {
      for (const row of section.Rows ?? []) {
        if (row.RowType === "Row" && row.Cells && row.Cells.length >= 4) {
          // Cells: [AccountName, OpeningBalance, CashReceived, CashSpent, ClosingBalance]
          const closing = parseFloat(row.Cells[4]?.Value ?? "0");
          if (!isNaN(closing)) total += closing;
        }
      }
    }
  }
  console.log("[getBankAccounts] BankSummary closing balance total:", total);
  return total;
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
