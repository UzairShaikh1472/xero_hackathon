import { env } from "./env.js";
import type { XeroTenant, XeroTokenSet } from "../xero/session-store.js";

export function isXeroConfigured() {
  return Boolean(env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET && env.XERO_REDIRECT_URI);
}

export function getActualBackendMode(
  tokenSet: XeroTokenSet | null,
  tenant: XeroTenant | null,
): "live" | "fallback" {
  return tokenSet && tenant ? "live" : "fallback";
}
