import { analyzeRevenue } from "../engines/index.js";
import type { RevenueOpportunities } from "../engines/revenue.js";
import { getNormalizedData } from "./data.js";
import { ok, type ApiResult } from "./types.js";

export function getRevenueOpportunities(): ApiResult<RevenueOpportunities> {
  return ok(analyzeRevenue(getNormalizedData()));
}
