import { draftPayablesNegotiation } from "../agents/index.js";
import type { NegotiationDraft, PayablePressure } from "../types/financial.js";
import { agentError } from "./agentError.js";
import { getNormalizedData } from "./data.js";
import { isPayablePressure, openPayables } from "./payables.js";
import { err, ok, type ApiError, type ApiResult } from "./types.js";

export async function postPayablesDraft(
  body: unknown,
): Promise<ApiResult<NegotiationDraft>> {
  const pressure = resolvePayablePressure(body);
  if (!pressure.ok) return pressure;

  try {
    const draft = await draftPayablesNegotiation(pressure.value);
    return ok(draft);
  } catch (error) {
    return agentError(error);
  }
}

type ResolvedPressure = { ok: true; value: PayablePressure } | ApiError;

function resolvePayablePressure(body: unknown): ResolvedPressure {
  if (!body || typeof body !== "object") {
    return err(400, "Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;

  if (isPayablePressure(body)) {
    return { ok: true, value: body };
  }

  const invoiceId = record.invoiceId;
  if (typeof invoiceId !== "string" || !invoiceId) {
    return err(
      400,
      "Body must include invoiceId or a full PayablePressure object",
    );
  }

  const found = openPayables(getNormalizedData()).find(
    (p) => p.invoiceId === invoiceId,
  );
  if (!found) {
    return err(404, `No open payable found for invoiceId "${invoiceId}"`);
  }
  return { ok: true, value: found };
}
