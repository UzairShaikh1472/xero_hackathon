import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";
import type { XeroTenant, XeroTokenSet } from "./session-store.js";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

function getBasicAuthHeader() {
  return Buffer.from(`${env.XERO_CLIENT_ID}:${env.XERO_CLIENT_SECRET}`).toString("base64");
}

export async function exchangeCodeForToken(code: string): Promise<XeroTokenSet> {
  return exchangeToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.XERO_REDIRECT_URI
    })
  );
}

export async function refreshAccessToken(refreshToken: string): Promise<XeroTokenSet> {
  return exchangeToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  );
}

async function exchangeToken(params: URLSearchParams): Promise<XeroTokenSet> {
  const response = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${getBasicAuthHeader()}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) {
    throw new HttpError(response.status, "Failed to exchange Xero token");
  }

  const payload = (await response.json()) as TokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
    tokenType: payload.token_type,
    scope: payload.scope
  };
}

export async function fetchConnections(accessToken: string): Promise<XeroTenant[]> {
  const response = await fetch("https://api.xero.com/connections", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new HttpError(response.status, "Failed to fetch Xero tenant connections");
  }

  const payload = (await response.json()) as Array<{
    tenantId: string;
    tenantName: string;
    tenantType: string;
  }>;

  return payload.map((item) => ({
    tenantId: item.tenantId,
    tenantName: item.tenantName,
    tenantType: item.tenantType
  }));
}

export async function fetchAccountingResource<T>(
  path: string,
  accessToken: string,
  tenantId: string
): Promise<T> {
  const response = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new HttpError(response.status, `Failed to fetch Xero resource ${path} [${response.status}]: ${body.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}
