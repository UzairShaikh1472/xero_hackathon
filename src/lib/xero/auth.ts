import { env } from "../config/env.js";
import { getXeroScopes } from "./scopes.js";
import { createOAuthState } from "./state.js";

export function buildAuthUrl() {
  const state = createOAuthState();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.XERO_CLIENT_ID,
    redirect_uri: env.XERO_REDIRECT_URI,
    scope: getXeroScopes().join(" "),
    state
  });

  return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
}
