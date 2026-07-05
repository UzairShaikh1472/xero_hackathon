import type { ApiEnvelope, HealthStatus } from "../domain/types.js";
import {
  isBrowserVoiceConfigured,
  isEmailConfigured,
  isVoiceConfigured
} from "../config/communications-config.js";
import { env } from "../config/env.js";
import { getActualBackendMode, isXeroConfigured } from "../config/xero-config.js";
import { isElevenLabsConfigured } from "./elevenlabs-tts-service.js";
import { getAvailableTenants, getLastSyncAt, getTenant, getTokenSet } from "../xero/session-store.js";

export async function buildHealthResponse(): Promise<ApiEnvelope<HealthStatus>> {
  const xeroConfigured = isXeroConfigured();
  const tokenSet = getTokenSet();
  const tenant = getTenant();
  const availableTenants = getAvailableTenants();
  const pendingOrgSelection = Boolean(tokenSet && !tenant && availableTenants.length > 0);

  return {
    ok: true,
    mode: getActualBackendMode(tokenSet, tenant),
    generatedAt: new Date().toISOString(),
    data: {
      service: "xero-kinetic-backend",
      xeroConfigured,
      xeroConnected: Boolean(tokenSet && tenant),
      pendingOrgSelection,
      authReady: xeroConfigured,
      fallbackEnabled: env.USE_XERO_FALLBACK,
      lastSyncAt: getLastSyncAt(),
      organizationName: tenant?.tenantName ?? null,
      emailConfigured: isEmailConfigured(),
      voiceConfigured: isVoiceConfigured(),
      browserVoiceConfigured: isBrowserVoiceConfigured(),
      elevenLabsConfigured: isElevenLabsConfigured()
    }
  };
}
