import fs from "node:fs";
import path from "node:path";

import { getDataFilePath } from "../utils/data-dir.js";

export type XeroTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  tokenType: string;
  scope: string;
};

export type XeroTenant = {
  tenantId: string;
  tenantName: string;
  tenantType: string;
};

type XeroSession = {
  tokenSet: XeroTokenSet | null;
  tenant: XeroTenant | null;
  availableTenants: XeroTenant[];
  lastSyncAt: string | null;
};

const sessionFilePath = getDataFilePath("xero-session.json");

function loadSession(): XeroSession {
  try {
    if (!fs.existsSync(sessionFilePath)) {
      return {
        tokenSet: null,
        tenant: null,
        availableTenants: [],
        lastSyncAt: null
      };
    }

    const payload = fs.readFileSync(sessionFilePath, "utf8");
    const parsed = JSON.parse(payload) as Partial<XeroSession>;
    return {
      tokenSet: parsed.tokenSet ?? null,
      tenant: parsed.tenant ?? null,
      availableTenants: parsed.availableTenants ?? [],
      lastSyncAt: parsed.lastSyncAt ?? null
    };
  } catch {
    return {
      tokenSet: null,
      tenant: null,
      availableTenants: [],
      lastSyncAt: null
    };
  }
}

function persistSession() {
  fs.mkdirSync(path.dirname(sessionFilePath), { recursive: true });
  fs.writeFileSync(sessionFilePath, JSON.stringify(session, null, 2));
}

const session: XeroSession = loadSession();

export function setTokenSet(tokenSet: XeroTokenSet) {
  session.tokenSet = tokenSet;
  persistSession();
}

export function getTokenSet() {
  return session.tokenSet;
}

export function clearTokenSet() {
  session.tokenSet = null;
  session.tenant = null;
  session.availableTenants = [];
  session.lastSyncAt = null;
  persistSession();
}

export function setAvailableTenants(tenants: XeroTenant[]) {
  session.availableTenants = tenants;
  persistSession();
}

export function getAvailableTenants() {
  return session.availableTenants;
}

export function setTenant(tenant: XeroTenant | null) {
  session.tenant = tenant;
  persistSession();
}

export function getTenant() {
  return session.tenant;
}

export function setLastSyncAt(lastSyncAt: string) {
  session.lastSyncAt = lastSyncAt;
  persistSession();
}

export function getLastSyncAt() {
  return session.lastSyncAt;
}
