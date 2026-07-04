import { analyzeLiquidity } from "../engines/index.js";
import type { InvoiceRisk } from "../types/financial.js";
import { getNormalizedData } from "./data.js";
import { ok, type ApiResult } from "./types.js";

export function getAtRiskInvoices(): ApiResult<InvoiceRisk[]> {
  const { atRiskInvoices } = analyzeLiquidity(getNormalizedData());
  return ok(atRiskInvoices);
}
