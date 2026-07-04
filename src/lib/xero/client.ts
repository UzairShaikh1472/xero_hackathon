export type XeroClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function createXeroClient(config: XeroClientConfig) {
  return {
    provider: "xero",
    config
  };
}
