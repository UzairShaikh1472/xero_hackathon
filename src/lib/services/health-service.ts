import type { ApiEnvelope, HealthStatus } from "../domain/types.js";
import {
  isBrowserVoiceConfigured,
  isEmailConfigured,
  isVoiceConfigured
} from "../config/communications-config.js";
import { env } from "../config/env.js";
import { getActualBackendMode, isXeroConfigured } from "../config/xero-config.js";
import { getLastSyncAt, getTenant, getTokenSet } from "../xero/session-store.js";

export async function buildHealthResponse(): Promise<ApiEnvelope<HealthStatus>> {
  const xeroConfigured = isXeroConfigured();
  const tokenSet = getTokenSet();
  const tenant = getTenant();

  return {
    ok: true,
    mode: getActualBackendMode(tokenSet, tenant),
    generatedAt: new Date().toISOString(),
    data: {
      service: "xero-kinetic-backend",
      xeroConfigured,
      xeroConnected: Boolean(tokenSet && tenant),
      authReady: xeroConfigured,
      fallbackEnabled: env.USE_XERO_FALLBACK,
      lastSyncAt: getLastSyncAt(),
      emailConfigured: isEmailConfigured(),
      voiceConfigured: isVoiceConfigured(),
      browserVoiceConfigured: isBrowserVoiceConfigured()
    }
  };
}
