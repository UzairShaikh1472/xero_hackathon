import { analyzeLiquidity } from "../../engines/liquidity.js";
import { addDays, toDateString } from "../../lib/dates.js";
import type {
  ApiEnvelope,
  LiquidityDailyPoint,
  LiquiditySnapshot
} from "../domain/types.js";
import type { NormalizedData, NormalizedInvoice } from "../../types/financial.js";
import { getPhaseOneSnapshotData } from "./phase-one-sync-service.js";
import { snapshotToNormalized } from "./snapshot-to-normalized.js";

function sumByDueDate(invoices: NormalizedInvoice[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const invoice of invoices) {
    const due = invoice.dueDate.slice(0, 10);
    map.set(due, (map.get(due) ?? 0) + invoice.amountDue);
  }
  return map;
}

function buildDailyProjection(
  data: NormalizedData,
  cash: number
): Pick<LiquiditySnapshot, "daily" | "projectedInflow" | "projectedOutflow"> {
  const openReceivables = data.invoices.filter(
    (invoice) => invoice.type === "ACCREC" && invoice.amountDue > 0
  );
  const openPayables = data.invoices.filter(
    (invoice) => invoice.type === "ACCPAY" && invoice.amountDue > 0
  );

  const inflowByDate = sumByDueDate(openReceivables);
  const outflowByDate = sumByDueDate(openPayables);

  const daily: LiquidityDailyPoint[] = [];
  let balance = cash;
  let projectedInflow = 0;
  let projectedOutflow = 0;

  for (let day = 1; day <= 30; day += 1) {
    const dateStr = toDateString(addDays(data.asOfDate, day));
    const inflow = inflowByDate.get(dateStr) ?? 0;
    const outflow = outflowByDate.get(dateStr) ?? 0;
    balance += inflow - outflow;
    projectedInflow += inflow;
    projectedOutflow += outflow;
    daily.push({ day, inflow, outflow, balance });
  }

  return {
    daily,
    projectedInflow: Number(projectedInflow.toFixed(2)),
    projectedOutflow: Number(projectedOutflow.toFixed(2))
  };
}

export async function buildLiquidityResponse(): Promise<ApiEnvelope<LiquiditySnapshot>> {
  const phaseOne = await getPhaseOneSnapshotData();
  const normalized = snapshotToNormalized(phaseOne);
  const { snapshot, atRiskInvoices } = analyzeLiquidity(normalized);
  const projection = buildDailyProjection(normalized, snapshot.cash);

  return {
    ok: true,
    mode: phaseOne.sync.source,
    generatedAt: new Date().toISOString(),
    data: {
      currency: phaseOne.sync.currency,
      snapshot,
      atRiskInvoices,
      daily: projection.daily,
      projectedInflow: projection.projectedInflow,
      projectedOutflow: projection.projectedOutflow,
      lastMonthCashFlow: phaseOne.sync.lastMonthCashFlow ?? 0,
      lastMonthCashFlowAvailable: phaseOne.sync.lastMonthCashFlowAvailable ?? false,
      currentCashSource: phaseOne.sync.bankCashSource ?? "derived",
      currentCashNote: phaseOne.sync.bankCashNote,
    }
  };
}
