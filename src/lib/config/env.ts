import { z } from "zod";

const booleanFromEnv = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.enum(["true", "false"]))
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  USE_XERO_FALLBACK: booleanFromEnv.default("true"),
  XERO_STATE_SALT: z.string().default("change-me"),
  XERO_CLIENT_ID: z.string().default(""),
  XERO_CLIENT_SECRET: z.string().default(""),
  XERO_REDIRECT_URI: z.string().url().default("http://localhost:3001/api/xero/callback"),
  XERO_SCOPES: z.string().default(
    "openid profile email offline_access accounting.transactions accounting.contacts accounting.settings accounting.reports.read"
  )
});

export const env = envSchema.parse(process.env);
