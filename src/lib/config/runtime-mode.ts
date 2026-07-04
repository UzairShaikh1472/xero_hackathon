import { env } from "./env.js";

export function getBackendMode() {
  return env.USE_XERO_FALLBACK ? "fallback" : "live";
}
