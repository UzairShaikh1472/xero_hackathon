import { draftReengagementQuote } from "../agents/index.js";
import { analyzeRevenue } from "../engines/index.js";
import type { LapsedCustomer, NegotiationDraft } from "../types/financial.js";
import { agentError } from "./agentError.js";
import { getNormalizedData } from "./data.js";
import { err, ok, type ApiError, type ApiResult } from "./types.js";

export async function postReengagementQuote(
  body: unknown,
): Promise<ApiResult<NegotiationDraft>> {
  const customer = resolveLapsedCustomer(body);
  if (!customer.ok) return customer;

  try {
    const draft = await draftReengagementQuote(customer.value);
    return ok(draft);
  } catch (error) {
    return agentError(error);
  }
}

type ResolvedCustomer = { ok: true; value: LapsedCustomer } | ApiError;

function resolveLapsedCustomer(body: unknown): ResolvedCustomer {
  if (!body || typeof body !== "object") {
    return err(400, "Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;

  if (isLapsedCustomer(body)) {
    return { ok: true, value: body };
  }

  const contactId = record.contactId;
  if (typeof contactId !== "string" || !contactId) {
    return err(
      400,
      "Body must include contactId or a full LapsedCustomer object",
    );
  }

  const { lapsedCustomers } = analyzeRevenue(getNormalizedData());
  const found = lapsedCustomers.find((c) => c.contactId === contactId);
  if (!found) {
    return err(404, `No lapsed customer found for contactId "${contactId}"`);
  }
  return { ok: true, value: found };
}

function isLapsedCustomer(value: unknown): value is LapsedCustomer {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.contactId === "string" &&
    typeof v.contactName === "string" &&
    typeof v.lastInvoiceDate === "string" &&
    typeof v.daysSinceLastActivity === "number" &&
    typeof v.historicalLTV === "number" &&
    typeof v.lapsedScore === "number" &&
    typeof v.recommendedAction === "string"
  );
}
