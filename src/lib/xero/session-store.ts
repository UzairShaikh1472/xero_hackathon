import fs from "node:fs";
import path from "node:path";

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
  lastSyncAt: string | null;
};

const sessionFilePath = path.resolve(process.cwd(), ".data", "xero-session.json");

function loadSession(): XeroSession {
  try {
    if (!fs.existsSync(sessionFilePath)) {
      return {
        tokenSet: null,
        tenant: null,
        lastSyncAt: null
      };
    }

    const payload = fs.readFileSync(sessionFilePath, "utf8");
    return JSON.parse(payload) as XeroSession;
  } catch {
    return {
      tokenSet: null,
      tenant: null,
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
  session.lastSyncAt = null;
  persistSession();
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
