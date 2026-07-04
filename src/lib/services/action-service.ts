import {
  draftPayablesNegotiation,
  draftReceivablesNegotiation,
  draftReengagementQuote,
  reengagementReason
} from "../../agents/index.js";
import { analyzeLiquidity, analyzeRevenue, reactivationChannel } from "../../engines/index.js";
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
    subjectLine?: string;
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
    subjectLine: fields.subjectLine ?? agentDraft.proposedAction,
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

function buildReceivablesRiskForInvoice(
  snapshot: Awaited<ReturnType<typeof getPhaseOneSnapshotData>>,
  invoice: (typeof snapshot.invoices)[number],
  discountPercent: number
): AgentInvoiceRisk {
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

  return {
    ...scored,
    recommendedAction: `Offer ${discountPercent}% early settlement discount`,
    expectedCashImpact: Number(
      (invoice.amountDue.amount * (1 - discountPercent / 100)).toFixed(2)
    )
  };
}

function buildReceivablesTemplateDraft(
  snapshot: Awaited<ReturnType<typeof getPhaseOneSnapshotData>>,
  invoice: (typeof snapshot.invoices)[number],
  risk: AgentInvoiceRisk,
  discountPercent: number,
  tone: string
): NegotiationDraft {
  const currency = invoice.amountDue.currency;
  return {
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
    draftMessage: `We noticed ${invoice.invoiceNumber} is still outstanding. If payment can be completed this week, we can offer a ${discountPercent}% early settlement discount to help close it promptly.`,
    metadata: {
      tone,
      discountPercent,
      invoiceNumber: invoice.invoiceNumber,
      amountDue: invoice.amountDue.amount,
      daysOverdue: invoice.daysOverdue,
      organizationName: snapshot.sync.organizationName ?? null,
      contactEmail: snapshot.contacts.find((item) => item.id === invoice.contactId)?.email ?? null,
      contactPhone: snapshot.contacts.find((item) => item.id === invoice.contactId)?.phone ?? null,
      agentGenerated: false
    }
  };
}

export async function buildReceivablesDraftResponse(
  input: ReceivablesDraftRequest
): Promise<ApiEnvelope<NegotiationDraft>> {
  const snapshot = await getPhaseOneSnapshotData();
  const invoiceId = assertString(input.invoiceId, "invoiceId");
  const draftId = `draft_receivables_${invoiceId}`;
  const cached = getStoredDraft(draftId);
  if (cached && input.useAgent !== true) {
    return {
      ok: true,
      mode: snapshot.sync.source,
      generatedAt: new Date().toISOString(),
      data: cached
    };
  }

  const invoice = snapshot.invoices.find((item) => item.id === invoiceId);

  if (!invoice) {
    throw new HttpError(404, "Invoice not found for receivables draft");
  }

  const discountPercent = clampPercent(input.discountPercent, 2, 1, 10);
  const currency = invoice.amountDue.currency;
  const tone = input.tone ?? "friendly";
  const risk = buildReceivablesRiskForInvoice(snapshot, invoice, discountPercent);

  if (input.useAgent === false) {
    const draft = buildReceivablesTemplateDraft(snapshot, invoice, risk, discountPercent, tone);
    persistDraft(draft);
    return {
      ok: true,
      mode: snapshot.sync.source,
      generatedAt: new Date().toISOString(),
      data: draft
    };
  }

  const organizationName = snapshot.sync.organizationName ?? undefined;

  const draft = await withAgentDraft(
    async () => {
      const agentDraft = await draftReceivablesNegotiation(risk, {
        invoiceNumber: invoice.invoiceNumber,
        discountPercent,
        discountedAmount: risk.expectedCashImpact,
        organizationName,
      });
      return toApiDraft(agentDraft, {
        id: draftId,
        type: "receivables_discount",
        targetId: invoice.id,
        currency,
        subjectLine: `Quick settlement option for ${invoice.invoiceNumber}`,
        metadata: {
          tone,
          discountPercent,
          invoiceNumber: invoice.invoiceNumber,
          amountDue: invoice.amountDue.amount,
          daysOverdue: invoice.daysOverdue,
          organizationName: organizationName ?? null,
          contactEmail: snapshot.contacts.find((item) => item.id === invoice.contactId)?.email ?? null,
          contactPhone: snapshot.contacts.find((item) => item.id === invoice.contactId)?.phone ?? null
        }
      });
    },
    () => buildReceivablesTemplateDraft(snapshot, invoice, risk, discountPercent, tone)
  );

  persistDraft(draft);

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: draft
  };
}

export async function buildReceivablesDraftsListResponse(options?: {
  fast?: boolean;
}): Promise<ApiEnvelope<{ drafts: NegotiationDraft[] }>> {
  const snapshot = await getPhaseOneSnapshotData();
  const normalized = snapshotToNormalized(snapshot);
  const { atRiskInvoices } = analyzeLiquidity(normalized);
  const overdue = atRiskInvoices.filter((risk) => risk.daysOverdue > 0);

  const drafts: NegotiationDraft[] = [];

  for (const risk of overdue) {
    const invoice = snapshot.invoices.find((item) => item.id === risk.invoiceId);
    if (!invoice) {
      continue;
    }

    const draftId = `draft_receivables_${invoice.id}`;
    const cached = getStoredDraft(draftId);
    if (cached) {
      drafts.push(cached);
      continue;
    }

    if (options?.fast) {
      const template = buildReceivablesTemplateDraft(snapshot, invoice, risk, 2, "friendly");
      persistDraft(template);
      drafts.push(template);
      continue;
    }

    const envelope = await buildReceivablesDraftResponse({ invoiceId: invoice.id });
    drafts.push(envelope.data);
  }

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: { drafts }
  };
}

function buildReengagementRecommendedAction(
  channel: ReturnType<typeof reactivationChannel>,
  offerPercent: number,
  daysSinceLastActivity: number,
): string {
  if (channel === "voice_invite") {
    return `Send voice-agent invite email — inactive ${daysSinceLastActivity} days (long-lapsed threshold)`;
  }
  return `Send win-back email with ${offerPercent}% returning-customer incentive`;
}

function buildReengagementTemplateDraft(
  snapshot: Awaited<ReturnType<typeof getPhaseOneSnapshotData>>,
  contact: (typeof snapshot.contacts)[number],
  customer: LapsedCustomer,
  offerPercent: number,
  tone: string,
): NegotiationDraft {
  const currency = snapshot.sync.currency;
  const channel = reactivationChannel(customer.daysSinceLastActivity);
  const estimatedValue = Number(
    (contact.averageInvoice.amount * (1 - offerPercent / 100)).toFixed(2),
  );
  const recommendedAction = buildReengagementRecommendedAction(
    channel,
    offerPercent,
    customer.daysSinceLastActivity,
  );

  const subjectLine =
    channel === "voice_invite"
      ? `Let's reconnect, ${contact.name}`
      : `A tailored offer for ${contact.name}`;

  const draftMessage =
    channel === "voice_invite"
      ? `It's been ${customer.daysSinceLastActivity} days since we last worked together and we'd love to hear what you're planning next. Click below to speak with our reactivation agent — we can walk through a refreshed quote with a ${offerPercent}% returning-customer incentive if there's work to restart this month.`
      : `We would love to work together again. We can put together a refreshed quote with a ${offerPercent}% returning-customer incentive if there is a project you would like to restart this month.`;

  return {
    id: `draft_reengagement_${contact.id}`,
    type: "reengagement_quote",
    targetId: contact.id,
    targetName: contact.name,
    currency,
    priority: customer.daysSinceLastActivity >= 180 ? "high" : "medium",
    reason: reengagementReason(customer),
    expectedImpact: {
      amount: estimatedValue,
      currency,
    },
    subjectLine,
    draftMessage,
    metadata: {
      tone,
      offerPercent,
      averageInvoiceValue: contact.averageInvoice.amount,
      daysSinceLastActivity: customer.daysSinceLastActivity,
      historicalLTV: customer.historicalLTV,
      recommendedChannel: channel,
      organizationName: snapshot.sync.organizationName ?? null,
      contactEmail: contact.email ?? null,
      contactPhone: contact.phone ?? null,
      recommendedAction,
      agentGenerated: false,
    },
  };
}

export async function buildReengagementDraftsListResponse(options?: {
  fast?: boolean;
}): Promise<ApiEnvelope<{ drafts: NegotiationDraft[] }>> {
  const snapshot = await getPhaseOneSnapshotData();
  const normalized = snapshotToNormalized(snapshot);
  const { lapsedCustomers } = analyzeRevenue(normalized);
  const drafts: NegotiationDraft[] = [];

  for (const customer of lapsedCustomers) {
    const contact = snapshot.contacts.find((item) => item.id === customer.contactId);
    if (!contact) {
      continue;
    }

    const draftId = `draft_reengagement_${contact.id}`;
    const cached = getStoredDraft(draftId);
    if (cached) {
      drafts.push(cached);
      continue;
    }

    if (options?.fast) {
      const template = buildReengagementTemplateDraft(
        snapshot,
        contact,
        customer,
        10,
        "friendly",
      );
      persistDraft(template);
      drafts.push(template);
      continue;
    }

    const envelope = await buildReengagementQuoteResponse({ contactId: contact.id });
    drafts.push(envelope.data);
  }

  return {
    ok: true,
    mode: snapshot.sync.source,
    generatedAt: new Date().toISOString(),
    data: { drafts },
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
          requestedAmount: amount,
          contactEmail:
            matchingPayable
              ? snapshot.contacts.find((item) => item.id === matchingPayable.contactId)?.email ?? null
              : null,
          contactPhone:
            matchingPayable
              ? snapshot.contacts.find((item) => item.id === matchingPayable.contactId)?.phone ?? null
              : null
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
        requestedAmount: amount,
        contactEmail:
          matchingPayable
            ? snapshot.contacts.find((item) => item.id === matchingPayable.contactId)?.email ?? null
            : null,
        contactPhone:
          matchingPayable
            ? snapshot.contacts.find((item) => item.id === matchingPayable.contactId)?.phone ?? null
            : null
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

  const channel = reactivationChannel(customer.daysSinceLastActivity);
  const recommendedAction = buildReengagementRecommendedAction(
    channel,
    offerPercent,
    customer.daysSinceLastActivity,
  );
  const enrichedCustomer: LapsedCustomer = {
    ...customer,
    recommendedAction,
  };

  const draft = await withAgentDraft(
    async () => {
      const agentDraft = await draftReengagementQuote(enrichedCustomer);
      return toApiDraft(agentDraft, {
        id: `draft_reengagement_${contact.id}`,
        type: "reengagement_quote",
        targetId: contact.id,
        currency,
        subjectLine:
          channel === "voice_invite"
            ? `Let's reconnect, ${contact.name}`
            : `A tailored offer for ${contact.name}`,
        metadata: {
          tone,
          offerPercent,
          averageInvoiceValue: contact.averageInvoice.amount,
          daysSinceLastActivity: customer.daysSinceLastActivity,
          historicalLTV: customer.historicalLTV,
          recommendedChannel: channel,
          organizationName: snapshot.sync.organizationName ?? null,
          contactEmail: contact.email ?? null,
          contactPhone: contact.phone ?? null,
          recommendedAction,
        },
      });
    },
    () =>
      buildReengagementTemplateDraft(
        snapshot,
        contact,
        enrichedCustomer,
        offerPercent,
        tone,
      ),
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
