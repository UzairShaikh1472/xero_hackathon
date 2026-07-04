import type {
  ApiEnvelope,
  ExecutionHistoryEntry,
  ExecutionResult,
  NegotiationDraft,
  PayablesDraftRequest,
  ReceivablesDraftRequest,
  ReengagementQuoteRequest,
  SimulationExecuteRequest
} from "../domain/types.js";
import { HttpError } from "../utils/http-error.js";
import {
  appendExecutionHistory,
  getStoredDraft,
  getStoredExecution,
  storeDraft,
  storeExecution
} from "../utils/idempotency.js";
import { logger } from "../utils/logger.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";

function clampPercent(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function assertString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Missing or invalid ${fieldName}`);
  }

  return value.trim();
}

function assertNumber(value: unknown, fieldName: string) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new HttpError(400, `Missing or invalid ${fieldName}`);
  }

  return value;
}

function persistDraft(draft: NegotiationDraft) {
  storeDraft(draft);
  logger.info("agent.draft.created", {
    draftId: draft.id,
    type: draft.type,
    targetId: draft.targetId,
    targetName: draft.targetName,
    expectedImpact: draft.expectedImpact.amount
  });
}

export async function buildReceivablesDraftResponse(
  input: ReceivablesDraftRequest
): Promise<ApiEnvelope<NegotiationDraft>> {
  const snapshot = await getPhaseOneSnapshotData();
  const invoiceId = assertString(input.invoiceId, "invoiceId");
  const invoice = snapshot.invoices.find((item) => item.id === invoiceId);

  if (!invoice) {
    throw new HttpError(404, "Invoice not found for receivables draft");
  }

  const discountPercent = clampPercent(input.discountPercent, 2, 1, 10);
  const expectedCashUnlocked = Number(
    (invoice.amountDue.amount * (1 - discountPercent / 100)).toFixed(2)
  );

  const draft: NegotiationDraft = {
    id: `draft_receivables_${invoice.id}`,
    type: "receivables_discount",
    targetId: invoice.id,
    targetName: invoice.contactName,
    currency: invoice.amountDue.currency,
    priority: invoice.daysOverdue >= 7 ? "high" : "medium",
    reason: `${invoice.invoiceNumber} is overdue by ${invoice.daysOverdue} days with ${invoice.amountDue.currency} ${invoice.amountDue.amount} outstanding.`,
    expectedImpact: {
      amount: expectedCashUnlocked,
      currency: invoice.amountDue.currency
    },
    subjectLine: `Quick settlement option for ${invoice.invoiceNumber}`,
    draftMessage: `Hi ${invoice.contactName}, we noticed ${invoice.invoiceNumber} is still outstanding. If payment can be completed this week, we can offer a ${discountPercent}% early settlement discount to help close it promptly.`,
    metadata: {
      tone: input.tone ?? "friendly",
      discountPercent,
      invoiceNumber: invoice.invoiceNumber,
      daysOverdue: invoice.daysOverdue
    }
  };

  persistDraft(draft);

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: draft
  };
}

export async function buildPayablesDraftResponse(
  input: PayablesDraftRequest
): Promise<ApiEnvelope<NegotiationDraft>> {
  const snapshot = await getPhaseOneSnapshotData();
  const supplierName = assertString(input.supplierName, "supplierName");
  const amount = assertNumber(input.amount, "amount");
  const currency = input.currency?.trim() || snapshot.sync.currency;
  const extensionDays = Math.round(clampPercent(input.extensionDays, 14, 7, 45));

  const draft: NegotiationDraft = {
    id: `draft_payables_${supplierName.toLowerCase().replace(/\s+/g, "_")}`,
    type: "payables_extension",
    targetId: supplierName.toLowerCase().replace(/\s+/g, "_"),
    targetName: supplierName,
    currency,
    priority: amount >= 5000 ? "high" : "medium",
    reason: `A payable of ${currency} ${amount} would benefit from a ${extensionDays}-day extension to ease near-term cash pressure.`,
    expectedImpact: {
      amount,
      currency
    },
    subjectLine: `Request to extend payment timing`,
    draftMessage: `Hi ${supplierName}, we are managing a short-term cash timing issue and would appreciate a ${extensionDays}-day extension on the current balance of ${currency} ${amount}. We value the relationship and want to keep payment plans clear and reliable.`,
    metadata: {
      tone: input.tone ?? "friendly",
      extensionDays,
      requestedAmount: amount
    }
  };

  persistDraft(draft);

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: draft
  };
}

export async function buildReengagementQuoteResponse(
  input: ReengagementQuoteRequest
): Promise<ApiEnvelope<NegotiationDraft>> {
  const snapshot = await getPhaseOneSnapshotData();
  const contactId = assertString(input.contactId, "contactId");
  const contact = snapshot.contacts.find((item) => item.id === contactId);

  if (!contact) {
    throw new HttpError(404, "Contact not found for re-engagement quote");
  }

  const offerPercent = clampPercent(input.offerPercent, 10, 5, 25);
  const estimatedValue = Number((contact.averageInvoice.amount * (1 - offerPercent / 100)).toFixed(2));

  const draft: NegotiationDraft = {
    id: `draft_reengagement_${contact.id}`,
    type: "reengagement_quote",
    targetId: contact.id,
    targetName: contact.name,
    currency: snapshot.sync.currency,
    priority: contact.averageInvoice.amount >= 5000 ? "high" : "medium",
    reason: `${contact.name} has prior invoice history and is a good candidate for a re-engagement offer.`,
    expectedImpact: {
      amount: estimatedValue,
      currency: snapshot.sync.currency
    },
    subjectLine: `A tailored offer for ${contact.name}`,
    draftMessage: `Hi ${contact.name}, we would love to work together again. We can put together a refreshed quote with a ${offerPercent}% returning-customer incentive if there is a project you would like to restart this month.`,
    metadata: {
      tone: input.tone ?? "friendly",
      offerPercent,
      averageInvoiceValue: contact.averageInvoice.amount
    }
  };

  persistDraft(draft);

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: draft
  };
}

export async function buildSimulationExecuteResponse(
  input: SimulationExecuteRequest
): Promise<ApiEnvelope<ExecutionResult>> {
  const snapshot = await getPhaseOneSnapshotData();
  const actionType = input.actionType;
  const actionId = assertString(input.actionId, "actionId");
  const idempotencyKey = assertString(input.idempotencyKey, "idempotencyKey");

  const cached = getStoredExecution<ExecutionResult>(idempotencyKey);
  if (cached) {
    logger.info("simulate.execute.idempotent_hit", {
      idempotencyKey,
      actionId,
      actionType
    });
    return {
      ok: true,
      mode: snapshot.sync.source,
      generatedAt: new Date().toISOString(),
      data: cached
    };
  }

  const draft = getStoredDraft(actionId);
  if (!draft) {
    throw new HttpError(404, "Referenced draft not found for simulation");
  }

  if (draft.type !== actionType) {
    throw new HttpError(400, "Draft type does not match simulation actionType");
  }

  const cashUnlockedAmount = Number(draft.expectedImpact.amount.toFixed(2));

  const result: ExecutionResult = {
    executionId: `exec_${Date.now()}`,
    actionType,
    actionId,
    status: input.approved ? "simulated" : "rejected",
    idempotencyKey,
    expectedCashUnlocked: {
      amount: cashUnlockedAmount,
      currency: snapshot.sync.currency
    },
    cashUnlocked: {
      amount: input.approved ? cashUnlockedAmount : 0,
      currency: snapshot.sync.currency
    },
    auditLog: {
      createdAt: new Date().toISOString(),
      message: input.approved
        ? `Simulated ${actionType} for ${actionId}.`
        : `Execution rejected for ${actionType} ${actionId}.`
    }
  };

  storeExecution(idempotencyKey, result);
  const historyEntry: ExecutionHistoryEntry = {
    ...result,
    targetName: draft.targetName,
    recordedAt: new Date().toISOString()
  };
  appendExecutionHistory(historyEntry);
  logger.info("simulate.execute.recorded", {
    executionId: result.executionId,
    actionId,
    actionType,
    approved: input.approved,
    cashUnlocked: result.cashUnlocked.amount,
    idempotencyKey
  });

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: result
  };
}
