import { getNegotiationMessage } from "../../agents/negotiators.js";
import type { ApiEnvelope } from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";

const ESCALATION_THRESHOLD_DAYS = 14;
const CALENDLY_URL = "https://calendly.com/upflow-ar-recovery/15min";

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

export type VoiceCallScriptResult = {
  invoiceId: string;
  contactName: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  daysOverdue: number;
  speechText: string;
};

function resolveContactEmail(contactName: string, email?: string): string {
  return email ?? `${contactName.toLowerCase().replace(/\s+/g, ".")}@example.com`;
}

function logSimulatedEmail(label: string, to: string, subject: string, body: string) {
  console.log(`\n--- ${label} (simulated send) ---`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(body);
  console.log("---------------------------------------\n");
}

function buildContext(invoice: {
  contactName: string;
  invoiceNumber: string;
  amountDue: { amount: number; currency: string };
  daysOverdue: number;
}) {
  return {
    contactName: invoice.contactName,
    invoiceNumber: invoice.invoiceNumber,
    amountDue: invoice.amountDue.amount,
    currency: invoice.amountDue.currency,
    daysOverdue: invoice.daysOverdue,
    calendlyUrl: CALENDLY_URL,
  };
}

export async function buildEscalationActionResponse(body: {
  invoiceId: string;
}): Promise<ApiEnvelope<EscalationActionResult>> {
  const snapshot = await getPhaseOneSnapshotData();
  const invoice = snapshot.invoices.find((inv) => inv.id === body.invoiceId);

  if (!invoice) {
    throw new HttpError(404, "Invoice not found for escalation action");
  }

  const contact = snapshot.contacts.find((c) => c.id === invoice.contactId);
  const to = resolveContactEmail(invoice.contactName, contact?.email);
  const ctx = buildContext(invoice);
  const isCallEscalation = invoice.daysOverdue >= ESCALATION_THRESHOLD_DAYS;

  if (isCallEscalation) {
    const { subject, body: emailBody } = getNegotiationMessage(
      "call_scheduling_email",
      ctx,
    );

    logger.info("escalation.call_scheduling", {
      invoiceId: invoice.id,
      to,
      contactName: invoice.contactName,
      daysOverdue: invoice.daysOverdue,
    });

    logSimulatedEmail("Call Scheduling Email", to, subject ?? "", emailBody);

    return {
      ok: true,
      mode: snapshot.sync.source,
      generatedAt: new Date().toISOString(),
      data: {
        actionType: "call_scheduling",
        invoiceId: invoice.id,
        contactName: invoice.contactName,
        daysOverdue: invoice.daysOverdue,
        to,
        subject: subject ?? "",
        body: emailBody,
        calendlyUrl: CALENDLY_URL,
        sent: true,
        loggedAt: new Date().toISOString(),
      },
    };
  }

  const { subject, body: emailBody } = getNegotiationMessage(
    "polite_email_reminder",
    ctx,
  );

  logger.info("escalation.email_reminder", {
    invoiceId: invoice.id,
    to,
    contactName: invoice.contactName,
    daysOverdue: invoice.daysOverdue,
  });

  logSimulatedEmail("Email Reminder", to, subject ?? "", emailBody);

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      actionType: "email_reminder",
      invoiceId: invoice.id,
      contactName: invoice.contactName,
      daysOverdue: invoice.daysOverdue,
      to,
      subject: subject ?? "",
      body: emailBody,
      sent: true,
      loggedAt: new Date().toISOString(),
    },
  };
}

export async function buildVoiceCallScriptResponse(body: {
  invoiceId: string;
}): Promise<ApiEnvelope<VoiceCallScriptResult>> {
  const snapshot = await getPhaseOneSnapshotData();
  const invoice = snapshot.invoices.find((inv) => inv.id === body.invoiceId);

  if (!invoice) {
    throw new HttpError(404, "Invoice not found for voice call script");
  }

  const { body: speechText } = getNegotiationMessage(
    "voice_agent_script",
    buildContext(invoice),
  );

  logger.info("escalation.voice_call_script", {
    invoiceId: invoice.id,
    contactName: invoice.contactName,
    daysOverdue: invoice.daysOverdue,
  });

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      invoiceId: invoice.id,
      contactName: invoice.contactName,
      invoiceNumber: invoice.invoiceNumber,
      amountDue: invoice.amountDue.amount,
      currency: invoice.amountDue.currency,
      daysOverdue: invoice.daysOverdue,
      speechText,
    },
  };
}
