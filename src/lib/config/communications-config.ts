import { env } from "./env.js";

export function isEmailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
}

export function isVoiceConfigured() {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
}

export function isBrowserVoiceConfigured() {
  return Boolean(
    (env.VAPI_PUBLIC_KEY && env.VAPI_ASSISTANT_ID) ||
      process.env.GEMINI_API_KEY ||
      process.env.AI_API_KEY
  );
}

export function resolveOutboundEmail(contactEmail: string) {
  const testEmail = env.COMMUNICATIONS_TEST_EMAIL.trim();
  return testEmail || contactEmail;
}
