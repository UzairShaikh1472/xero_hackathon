import { analyzeLiquidity } from "../engines/index.js";
import type { LiquidityAnalysis } from "../engines/liquidity.js";
import { getNormalizedData } from "./data.js";
import { ok, type ApiResult } from "./types.js";

export function getLiquidity(): ApiResult<LiquidityAnalysis> {
  return ok(analyzeLiquidity(getNormalizedData()));
}
