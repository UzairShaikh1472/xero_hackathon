import { z } from "zod";

const booleanFromEnv = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.enum(["true", "false"]))
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  FRONTEND_APP_URL: z.string().url().default("http://localhost:8080"),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3001"),
  USE_XERO_FALLBACK: booleanFromEnv.default("true"),
  XERO_STATE_SALT: z.string().default("change-me"),
  XERO_CLIENT_ID: z.string().default(""),
  XERO_CLIENT_SECRET: z.string().default(""),
  XERO_REDIRECT_URI: z.string().url().default("http://localhost:3001/api/xero/callback"),
  XERO_SCOPES: z.string().default(
    "openid profile email offline_access accounting.transactions accounting.contacts accounting.settings accounting.reports.read"
  ),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: booleanFromEnv.default("false"),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default(""),
  TWILIO_ACCOUNT_SID: z.string().default(""),
  TWILIO_AUTH_TOKEN: z.string().default(""),
  TWILIO_FROM_NUMBER: z.string().default(""),
  COMMUNICATIONS_TEST_EMAIL: z.string().default(""),
  COMMUNICATIONS_TEST_PHONE: z.string().default(""),
  CALL_REPORT_EMAIL: z.string().default(""),
  VAPI_PUBLIC_KEY: z.string().default(""),
  VAPI_ASSISTANT_ID: z.string().default(""),
  ELEVENLABS_API_KEY: z.string().default(""),
  ELEVENLABS_VOICE_ID: z.string().default(""),
  ELEVENLABS_DEMO_VOICE_ID: z.string().default(""),
  ELEVENLABS_MODEL: z.string().default("eleven_flash_v2_5"),
  ELEVENLABS_MODEL_ID: z.string().default("eleven_flash_v2_5")
});

export const env = envSchema.parse(process.env);
