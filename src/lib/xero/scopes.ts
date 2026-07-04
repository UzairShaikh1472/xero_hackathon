import { env } from "../config/env.js";

export function getXeroScopes() {
  return env.XERO_SCOPES.split(" ").filter(Boolean);
}
