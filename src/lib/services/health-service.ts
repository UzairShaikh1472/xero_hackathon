import type { ApiEnvelope, HealthStatus } from "../domain/types.js";
import { env } from "../config/env.js";
import { getBackendMode } from "../config/runtime-mode.js";
import { getLastSyncAt, getTenant, getTokenSet } from "../xero/session-store.js";

export async function buildHealthResponse(): Promise<ApiEnvelope<HealthStatus>> {
  const xeroConfigured = Boolean(
    env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET && env.XERO_REDIRECT_URI
  );
  const tokenSet = getTokenSet();
  const tenant = getTenant();

  return {
    ok: true,
    mode: getBackendMode(),
    generatedAt: new Date().toISOString(),
    data: {
      service: "xero-kinetic-backend",
      xeroConfigured,
      xeroConnected: Boolean(tokenSet && tenant),
      authReady: xeroConfigured,
      fallbackEnabled: env.USE_XERO_FALLBACK,
      lastSyncAt: getLastSyncAt()
    }
  };
}
