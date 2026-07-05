import { env } from "../config/env.js";
import { getBackendMode } from "../config/runtime-mode.js";
import { loadFallbackData } from "../demo/fallback-loader.js";
import { normalizeContact, normalizeInvoice } from "../domain/normalizers.js";
import type { ApiEnvelope, PhaseOneSnapshot } from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";
import { exchangeCodeForToken, fetchConnections, refreshAccessToken } from "../xero/api.js";
import { getBankAccounts, getLastMonthCashFlow, getContacts, getInvoices } from "../xero/fetchers.js";
import {
  getLastSyncAt,
  getTenant,
  getTokenSet,
  setLastSyncAt,
  setTenant,
  setTokenSet
} from "../xero/session-store.js";

const CACHE_TTL_MS = 60_000;

let cachedSnapshot: PhaseOneSnapshot | null = null;
let cachedAt = 0;
let inflightSync: Promise<PhaseOneSnapshot> | null = null;

export function clearSnapshotCache() {
  cachedSnapshot = null;
  cachedAt = 0;
  inflightSync = null;
}

function buildEnvelope(snapshot: PhaseOneSnapshot): ApiEnvelope<PhaseOneSnapshot> {
  return {
    ok: true,
    mode: snapshot.sync.source ?? getBackendMode(),
    generatedAt: new Date().toISOString(),
    data: snapshot
  };
}

async function getUsableAccessToken() {
  const tokenSet = getTokenSet();
  if (!tokenSet) {
    return null;
  }

  const expiresAt = new Date(tokenSet.expiresAt);
  const refreshThresholdMs = 5 * 60 * 1000;
  const shouldRefresh =
    !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() - Date.now() <= refreshThresholdMs;

  if (!shouldRefresh) {
    return tokenSet.accessToken;
  }

  if (!tokenSet.refreshToken) {
    logger.warn("xero.token.refresh_missing_refresh_token");
    return tokenSet.accessToken;
  }

  const refreshedTokenSet = await refreshAccessToken(tokenSet.refreshToken);
  setTokenSet(refreshedTokenSet);
  logger.info("xero.token.refreshed", {
    expiresAt: refreshedTokenSet.expiresAt
  });
  return refreshedTokenSet.accessToken;
}

function getCurrencyFromInvoices(invoices: { total: { currency: string } }[], fallback = "GBP") {
  return invoices[0]?.total.currency ?? fallback;
}

function enrichContacts(snapshot: PhaseOneSnapshot): PhaseOneSnapshot {
  const invoicesByContact = new Map<string, typeof snapshot.invoices>();

  for (const invoice of snapshot.invoices) {
    const current = invoicesByContact.get(invoice.contactId) ?? [];
    current.push(invoice);
    invoicesByContact.set(invoice.contactId, current);
  }

  return {
    ...snapshot,
    contacts: snapshot.contacts.map((contact) => {
      const invoices = (invoicesByContact.get(contact.id) ?? []).filter(
        (invoice) => invoice.direction === "receivable"
      );
      const totalOutstanding = invoices
        .filter((invoice) => invoice.isOutstanding)
        .reduce((sum, invoice) => sum + invoice.amountDue.amount, 0);
      const totalPaid = invoices.reduce(
        (sum, invoice) => sum + Math.max(0, invoice.total.amount - invoice.amountDue.amount),
        0
      );
      const totalBilled = invoices.reduce((sum, invoice) => sum + invoice.total.amount, 0);
      const lastInvoiceDate = invoices
        .map((invoice) => invoice.issueDate)
        .filter(Boolean)
        .sort()
        .at(-1);
      const settledInvoices = invoices.filter((invoice) => !invoice.isOutstanding);
      const onTimeInvoices = settledInvoices.filter((invoice) => !invoice.isOverdue).length;
      const paymentReliability =
        settledInvoices.length > 0
          ? Math.round((onTimeInvoices / settledInvoices.length) * 100)
          : undefined;

      return {
        ...contact,
        totalInvoices: invoices.length,
        totalPaid: {
          amount: Number(totalPaid.toFixed(2)),
          currency: snapshot.sync.currency
        },
        averageInvoice: {
          amount: invoices.length > 0 ? Number((totalBilled / invoices.length).toFixed(2)) : 0,
          currency: snapshot.sync.currency
        },
        lastInvoiceDate,
        paymentReliability
      };
    })
  };
}

export async function handleOAuthCallback(code: string) {
  const tokenSet = await exchangeCodeForToken(code);
  setTokenSet(tokenSet);

  const tenants = await fetchConnections(tokenSet.accessToken);
  const tenant = tenants[0] ?? null;
  setTenant(tenant);

  logger.info("xero.auth.connected", {
    tenantId: tenant?.tenantId ?? null,
    tenantName: tenant?.tenantName ?? null
  });

  return {
    connected: Boolean(tenant),
    tenant
  };
}

export async function getPhaseOneSnapshot() {
  return buildEnvelope(await getPhaseOneSnapshotData());
}

export async function getPhaseOneSnapshotData(): Promise<PhaseOneSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now - cachedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  if (inflightSync) {
    return inflightSync;
  }

  inflightSync = fetchSnapshotFromXeroOrFallback()
    .then((snapshot) => {
      cachedSnapshot = snapshot;
      cachedAt = Date.now();
      return snapshot;
    })
    .finally(() => {
      inflightSync = null;
    });

  return inflightSync;
}

async function fetchSnapshotFromXeroOrFallback(): Promise<PhaseOneSnapshot> {
  const tokenSet = getTokenSet();
  const tenant = getTenant();

  if (tokenSet && tenant) {
    try {
      return await syncLiveSnapshot(tenant);
    } catch (error) {
      logger.warn("xero.sync.failed", {
        message: error instanceof Error ? error.message : "Unknown sync error",
        statusCode: error instanceof HttpError ? error.statusCode : undefined
      });

      if (cachedSnapshot) {
        logger.warn("xero.sync.using_stale_cache", {
          cachedAgeMs: Date.now() - cachedAt
        });
        return cachedSnapshot;
      }

      if (!env.USE_XERO_FALLBACK) {
        throw error;
      }

      return buildFallbackSnapshot();
    }
  }

  if (env.USE_XERO_FALLBACK) {
    return buildFallbackSnapshot();
  }

  return buildFallbackSnapshot();
}

async function syncLiveSnapshot(
  tenant: NonNullable<ReturnType<typeof getTenant>>
): Promise<PhaseOneSnapshot> {
  const accessToken = await getUsableAccessToken();
  if (!accessToken) {
    throw new Error("No usable Xero access token");
  }

  const [rawInvoices, rawContacts, bankCash, lastMonthCashFlow] = await Promise.all([
    getInvoices(accessToken, tenant.tenantId),
    getContacts(accessToken, tenant.tenantId),
    getBankAccounts(accessToken, tenant.tenantId).catch((e) => { console.error("[bankCash error]", e?.message ?? e); return 0; }),
    getLastMonthCashFlow(accessToken, tenant.tenantId).catch((e) => { console.error("[lastMonthCashFlow error]", e?.message ?? e); return 0; }),
  ]);

  const lastSyncAt = new Date().toISOString();
  setLastSyncAt(lastSyncAt);

  const normalizedInvoices = rawInvoices.map(normalizeInvoice);
  const snapshot: PhaseOneSnapshot = {
    invoices: normalizedInvoices,
    contacts: rawContacts.map(normalizeContact),
    sync: {
      source: "live",
      invoicesCount: rawInvoices.length,
      contactsCount: rawContacts.length,
      lastSyncAt,
      tenantId: tenant.tenantId,
      organizationName: tenant.tenantName,
      currency: getCurrencyFromInvoices(normalizedInvoices),
      bankCash,
      lastMonthCashFlow,
    }
  };

  return enrichContacts(snapshot);
}

function buildFallbackSnapshot(): PhaseOneSnapshot {
  const fallback = loadFallbackData();
  const lastSyncAt = getLastSyncAt();
  const tenant = getTenant();
  const normalizedInvoices = fallback.invoices.map(normalizeInvoice);
  const snapshot: PhaseOneSnapshot = {
    invoices: normalizedInvoices,
    contacts: fallback.contacts.map(normalizeContact),
    sync: {
      source: "fallback",
      invoicesCount: fallback.invoices.length,
      contactsCount: fallback.contacts.length,
      lastSyncAt,
      tenantId: tenant?.tenantId ?? null,
      organizationName: fallback.company.name,
      currency: fallback.company.currency
    }
  };

  return enrichContacts(snapshot);
}
