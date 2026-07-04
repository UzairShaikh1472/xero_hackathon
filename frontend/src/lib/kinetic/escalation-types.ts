export type EscalationActionResult = {
  actionType: "email_reminder" | "call_scheduling";
  invoiceId: string;
  contactName: string;
  daysOverdue: number;
  to: string;
  subject: string;
  body: string;
  calendlyUrl?: string;
  sent: boolean;
  loggedAt: string;
};

export type VoiceCallScript = {
  invoiceId: string;
  contactName: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  daysOverdue: number;
  speechText: string;
};

export type VoiceTtsResult = {
  fallback: boolean;
  audioBase64?: string;
  mimeType?: string;
  message?: string;
};

export type RowActionStatus =
  | "idle"
  | "loading"
  | "email_sent"
  | "call_scheduled"
  | "error";
