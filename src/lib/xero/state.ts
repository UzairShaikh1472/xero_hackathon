import crypto from "node:crypto";

import { env } from "../config/env.js";

export function createOAuthState() {
  const nonce = crypto.randomBytes(16).toString("hex");
  const signature = crypto
    .createHash("sha256")
    .update(`${nonce}:${env.XERO_STATE_SALT}`)
    .digest("hex");

  return `${nonce}.${signature}`;
}

export function isValidOAuthState(state: string) {
  const [nonce, signature] = state.split(".");

  if (!nonce || !signature) {
    return false;
  }

  const expected = crypto
    .createHash("sha256")
    .update(`${nonce}:${env.XERO_STATE_SALT}`)
    .digest("hex");

  return signature === expected;
}
