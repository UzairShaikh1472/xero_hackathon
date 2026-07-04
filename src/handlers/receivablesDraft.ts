import { draftReceivablesNegotiation } from "../agents/index.js";
import { analyzeLiquidity } from "../engines/index.js";
import type { InvoiceRisk, NegotiationDraft } from "../types/financial.js";
import { agentError } from "./agentError.js";
import { getNormalizedData } from "./data.js";
import { err, ok, type ApiError, type ApiResult } from "./types.js";

export async function postReceivablesDraft(
  body: unknown,
): Promise<ApiResult<NegotiationDraft>> {
  const risk = resolveInvoiceRisk(body);
  if (!risk.ok) return risk;

  try {
    const draft = await draftReceivablesNegotiation(risk.value);
    return ok(draft);
  } catch (error) {
    return agentError(error);
  }
}

type ResolvedRisk = { ok: true; value: InvoiceRisk } | ApiError;

function resolveInvoiceRisk(body: unknown): ResolvedRisk {
  if (!body || typeof body !== "object") {
    return err(400, "Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;

  if (isInvoiceRisk(body)) {
    return { ok: true, value: body };
  }

  const invoiceId = record.invoiceId;
  if (typeof invoiceId !== "string" || !invoiceId) {
    return err(
      400,
      "Body must include invoiceId or a full InvoiceRisk object",
    );
  }

  const { atRiskInvoices } = analyzeLiquidity(getNormalizedData());
  const found = atRiskInvoices.find((r) => r.invoiceId === invoiceId);
  if (!found) {
    return err(404, `No at-risk invoice found for invoiceId "${invoiceId}"`);
  }
  return { ok: true, value: found };
}

function isInvoiceRisk(value: unknown): value is InvoiceRisk {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.contactId === "string" &&
    typeof v.contactName === "string" &&
    typeof v.invoiceId === "string" &&
    typeof v.amount === "number" &&
    typeof v.daysOverdue === "number" &&
    typeof v.paymentReliabilityScore === "number" &&
    typeof v.urgency === "string" &&
    typeof v.recommendedAction === "string" &&
    typeof v.expectedCashImpact === "number" &&
    typeof v.liquidityPriorityScore === "number"
  );
}
