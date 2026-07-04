import {
  draftPayablesNegotiation,
  draftReceivablesNegotiation,
  draftReengagementQuote
} from "../../agents/index.js";
import { analyzeLiquidity, analyzeRevenue } from "../../engines/index.js";
import { lapsedCustomerScore } from "../../scoring/index.js";
import type {
  InvoiceRisk as AgentInvoiceRisk,
  LapsedCustomer,
  NegotiationDraft as AgentDraft,
  PayablePressure,
  Urgency
} from "../../types/financial.js";
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
import { snapshotToNormalized } from "./snapshot-to-normalized.js";

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

function urgencyToPriority(urgency: Urgency): NegotiationDraft["priority"] {
  if (urgency === "critical" || urgency === "high") return "high";
  if (urgency === "medium") return "medium";
  return "low";
}

function toApiDraft(
  agentDraft: AgentDraft,
  fields: {
    id: string;
    type: NegotiationDraft["type"];
    targetId: string;
    currency: string;
    metadata: NegotiationDraft["metadata"];
  }
): NegotiationDraft {
  return {
    id: fields.id,
    type: fields.type,
    targetId: fields.targetId,
    targetName: agentDraft.contactName,
    currency: fields.currency,
    priority: urgencyToPriority(agentDraft.urgency),
    reason: agentDraft.reason,
    expectedImpact: {
      amount: Number(agentDraft.expectedCashImpact.toFixed(2)),
      currency: fields.currency
    },
    subjectLine: agentDraft.proposedAction,
    draftMessage: agentDraft.draftMessage,
    metadata: {
      ...fields.metadata,
      proposedAction: agentDraft.proposedAction,
      confidenceLevel: agentDraft.confidenceLevel,
      agentGenerated: true
    }
  };
}

async function withAgentDraft(
  generate: () => Promise<NegotiationDraft>,
  fallback: () => NegotiationDraft
): Promise<NegotiationDraft> {
  try {
    return await generate();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent failed";
    logger.warn("agent.draft.fallback", { message });
    const draft = fallback();
    draft.metadata = {
      ...draft.metadata,
      agentGenerated: false,
      agentError: message
    };
    return draft;
  }
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
  const currency = invoice.amountDue.currency;
  const tone = input.tone ?? "friendly";
  const normalized = snapshotToNormalized(snapshot);
  const { atRiskInvoices } = analyzeLiquidity(normalized);
  const scored =
    atRiskInvoices.find((risk) => risk.invoiceId === invoice.id) ??
    ({
      contactId: invoice.contactId,
      contactName: invoice.contactName,
      invoiceId: invoice.id,
      amount: invoice.amountDue.amount,
      daysOverdue: invoice.daysOverdue,
      paymentReliabilityScore: 50,
      urgency: invoice.daysOverdue >= 14 ? "high" : invoice.daysOverdue >= 7 ? "medium" : "low",
      recommendedAction: `Offer ${discountPercent}% early settlement discount`,
      expectedCashImpact: Number(
        (invoice.amountDue.amount * (1 - discountPercent / 100)).toFixed(2)
      ),
      liquidityPriorityScore: 0
    } satisfies AgentInvoiceRisk);

  const risk: AgentInvoiceRisk = {
    ...scored,
    recommendedAction: `Offer ${discountPercent}% early settlement discount`,
    expectedCashImpact: Number(
      (invoice.amountDue.amount * (1 - discountPercent / 100)).toFixed(2)
    )
  };

  const draft = await withAgentDraft(
    async () => {
      const agentDraft = await draftReceivablesNegotiation(risk);
      return toApiDraft(agentDraft, {
        id: `draft_receivables_${invoice.id}`,
        type: "receivables_discount",
        targetId: invoice.id,
        currency,
        metadata: {
          tone,
          discountPercent,
          invoiceNumber: invoice.invoiceNumber,
          daysOverdue: invoice.daysOverdue
        }
      });
    },
    () => ({
      id: `draft_receivables_${invoice.id}`,
      type: "receivables_discount",
      targetId: invoice.id,
      targetName: invoice.contactName,
      currency,
      priority: invoice.daysOverdue >= 7 ? "high" : "medium",
      reason: `${invoice.invoiceNumber} is overdue by ${invoice.daysOverdue} days with ${currency} ${invoice.amountDue.amount} outstanding.`,
      expectedImpact: {
        amount: risk.expectedCashImpact,
        currency
      },
      subjectLine: `Quick settlement option for ${invoice.invoiceNumber}`,
      draftMessage: `Hi ${invoice.contactName}, we noticed ${invoice.invoiceNumber} is still outstanding. If payment can be completed this week, we can offer a ${discountPercent}% early settlement discount to help close it promptly.`,
      metadata: {
        tone,
        discountPercent,
        invoiceNumber: invoice.invoiceNumber,
        daysOverdue: invoice.daysOverdue
      }
    })
  );

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
  const tone = input.tone ?? "friendly";
  const targetId = supplierName.toLowerCase().replace(/\s+/g, "_");

  const matchingPayable = snapshot.invoices.find(
    (invoice) =>
      invoice.direction === "payable" &&
      invoice.isOutstanding &&
      invoice.contactName.toLowerCase() === supplierName.toLowerCase()
  );

  const pressure: PayablePressure = matchingPayable
    ? {
        contactId: matchingPayable.contactId,
        contactName: matchingPayable.contactName,
        invoiceId: matchingPayable.id,
        amount,
        daysOverdue: matchingPayable.daysOverdue,
        urgency:
          matchingPayable.daysOverdue >= 14
            ? "critical"
            : matchingPayable.daysOverdue > 0
              ? "high"
              : amount >= 5000
                ? "high"
                : "medium",
        recommendedAction: `Request ${extensionDays}-day payment extension`,
        expectedCashImpact: amount
      }
    : {
        contactId: targetId,
        contactName: supplierName,
        invoiceId: `payable_${targetId}`,
        amount,
        daysOverdue: 0,
        urgency: amount >= 5000 ? "high" : "medium",
        recommendedAction: `Request ${extensionDays}-day payment extension`,
        expectedCashImpact: amount
      };

  const draft = await withAgentDraft(
    async () => {
      const agentDraft = await draftPayablesNegotiation(pressure);
      return toApiDraft(agentDraft, {
        id: `draft_payables_${targetId}`,
        type: "payables_extension",
        targetId,
        currency,
        metadata: {
          tone,
          extensionDays,
          requestedAmount: amount
        }
      });
    },
    () => ({
      id: `draft_payables_${targetId}`,
      type: "payables_extension",
      targetId,
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
        tone,
        extensionDays,
        requestedAmount: amount
      }
    })
  );

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
  const currency = snapshot.sync.currency;
  const tone = input.tone ?? "friendly";
  const estimatedValue = Number(
    (contact.averageInvoice.amount * (1 - offerPercent / 100)).toFixed(2)
  );

  const normalized = snapshotToNormalized(snapshot);
  const { lapsedCustomers } = analyzeRevenue(normalized);
  const scored = lapsedCustomers.find((item) => item.contactId === contact.id);

  const asOf = new Date();
  const lastInvoiceDate = contact.lastInvoiceDate ?? asOf.toISOString().slice(0, 10);
  const lastDate = new Date(lastInvoiceDate);
  const daysSinceLastActivity = Number.isNaN(lastDate.getTime())
    ? 90
    : Math.max(0, Math.round((asOf.getTime() - lastDate.getTime()) / 86400000));
  const historicalLTV =
    contact.totalPaid.amount > 0
      ? contact.totalPaid.amount
      : contact.averageInvoice.amount * Math.max(1, contact.totalInvoices);

  const customer: LapsedCustomer = scored ?? {
    contactId: contact.id,
    contactName: contact.name,
    lastInvoiceDate,
    daysSinceLastActivity,
    historicalLTV,
    lapsedScore: lapsedCustomerScore(historicalLTV, daysSinceLastActivity),
    recommendedAction: `Send re-engagement quote with ${offerPercent}% returning-customer incentive`
  };

  const draft = await withAgentDraft(
    async () => {
      const agentDraft = await draftReengagementQuote({
        ...customer,
        recommendedAction: `Send re-engagement quote with ${offerPercent}% returning-customer incentive`
      });
      return toApiDraft(agentDraft, {
        id: `draft_reengagement_${contact.id}`,
        type: "reengagement_quote",
        targetId: contact.id,
        currency,
        metadata: {
          tone,
          offerPercent,
          averageInvoiceValue: contact.averageInvoice.amount
        }
      });
    },
    () => ({
      id: `draft_reengagement_${contact.id}`,
      type: "reengagement_quote",
      targetId: contact.id,
      targetName: contact.name,
      currency,
      priority: contact.averageInvoice.amount >= 5000 ? "high" : "medium",
      reason: `${contact.name} has prior invoice history and is a good candidate for a re-engagement offer.`,
      expectedImpact: {
        amount: estimatedValue,
        currency
      },
      subjectLine: `A tailored offer for ${contact.name}`,
      draftMessage: `Hi ${contact.name}, we would love to work together again. We can put together a refreshed quote with a ${offerPercent}% returning-customer incentive if there is a project you would like to restart this month.`,
      metadata: {
        tone,
        offerPercent,
        averageInvoiceValue: contact.averageInvoice.amount
      }
    })
  );

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
