/**
 * Smoke-test scoring engines against the demo fixture.
 * Run: npm run smoke
 *
 * No LLM — pure math only.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { NormalizedData } from "../src/types/financial.js";
import {
  receivablesReason,
  payablesReason,
  reengagementReason,
} from "../src/agents/reasons.js";
import { analyzeLiquidity, analyzeRevenue } from "../src/engines/index.js";
import { toPayablePressure } from "../src/handlers/payables.js";
import {
  paymentReliabilityScore,
  paymentVelocityDecay,
} from "../src/scoring/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../src/fixtures/demo-normalized.json");
const data = JSON.parse(readFileSync(fixturePath, "utf-8")) as NormalizedData;

const { snapshot, atRiskInvoices } = analyzeLiquidity(data);
const { lapsedCustomers, repeatBuyers, velocitySignals } = analyzeRevenue(data);

console.log("=== Company Snapshot ===");
console.log(`  Cash: £${snapshot.cash.toLocaleString()}`);
console.log(`  Receivables: £${snapshot.totalReceivables.toLocaleString()}`);
console.log(`  Payables: £${snapshot.totalPayables.toLocaleString()}`);
console.log(`  Working capital: £${snapshot.workingCapital.toLocaleString()}`);
console.log(`  DSO: ${snapshot.dso.toFixed(1)} days`);
console.log(`  DPO: ${snapshot.dpo.toFixed(1)} days`);
console.log(`  CCC: ${snapshot.ccc.toFixed(1)} days`);
console.log(
  `  30-day projected gap: £${snapshot.projectedGap30Days.toLocaleString()}`,
);

console.log("\n=== At-Risk Invoices (liquidity priority) ===");
for (const risk of atRiskInvoices) {
  console.log(
    `  ${risk.contactName} £${risk.amount} | overdue ${risk.daysOverdue}d | reliability ${risk.paymentReliabilityScore.toFixed(0)} | priority ${risk.liquidityPriorityScore.toFixed(2)} | ${risk.urgency} | ${risk.recommendedAction} | impact £${risk.expectedCashImpact.toFixed(0)}`,
  );
}

console.log("\n=== Lapsed Customers ===");
if (lapsedCustomers.length === 0) {
  console.log("  (none)");
} else {
  for (const c of lapsedCustomers) {
    console.log(
      `  ${c.contactName}: LTV £${c.historicalLTV} | ${c.daysSinceLastActivity}d inactive | score ${c.lapsedScore.toFixed(2)} | ${c.recommendedAction}`,
    );
  }
}

console.log("\n=== Repeat Buyers ===");
for (const b of repeatBuyers) {
  console.log(
    `  ${b.contactName}: ${b.transactionCount} txns | avg £${b.averageInvoiceSize.toFixed(0)} | score ${b.repeatScore.toFixed(0)} | ${b.upsellOpportunity}`,
  );
}

console.log("\n=== Payment Velocity ===");
for (const signal of velocitySignals) {
  const flag = signal.isSlowingDown ? " SLOWING DOWN" : "";
  console.log(
    `  ${signal.contactName}: decay ${signal.velocityDecay.toFixed(2)} (hist ${signal.historicalAvgPaymentDays.toFixed(1)}d → current ${signal.currentAvgPaymentDays.toFixed(1)}d)${flag}`,
  );
}

// --- Deterministic reasons (Step 6) ---
console.log("\n=== Deterministic Reasons ===");
const topRisk = atRiskInvoices[0];
const topLapsed = lapsedCustomers[0];
const openPayable = data.invoices.find(
  (inv) => inv.type === "ACCPAY" && inv.amountDue > 0,
);
if (topRisk) {
  console.log(`  receivables: ${receivablesReason(topRisk)}`);
}
if (openPayable) {
  console.log(
    `  payables: ${payablesReason(toPayablePressure(openPayable, data.asOfDate))}`,
  );
}
if (topLapsed) {
  console.log(`  reengagement: ${reengagementReason(topLapsed)}`);
}

// --- Edge cases (Step 6) ---
console.log("\n=== Edge Cases ===");
let edgeFailed = 0;
function edge(ok: boolean, label: string): void {
  if (!ok) {
    console.error(`  FAIL: ${label}`);
    edgeFailed += 1;
  } else {
    console.log(`  OK: ${label}`);
  }
}

// Zero payments → neutral reliability 50
edge(paymentReliabilityScore([]) === 50, "zero payments → reliability 50");

// Division by zero guards
edge(paymentVelocityDecay(10, 0) === Infinity, "velocity decay hist=0 → Infinity");
edge(Number.isFinite(paymentVelocityDecay(0, 0)), "velocity decay 0/0 → finite");

// Negative cash still produces a finite gap and is reflected on the snapshot
const negativeCash: NormalizedData = { ...data, cash: -5000 };
const negSnap = analyzeLiquidity(negativeCash).snapshot;
edge(negSnap.cash === -5000, "negative cash preserved on snapshot");
edge(Number.isFinite(negSnap.projectedGap30Days), "negative cash gap is finite");
edge(
  negSnap.workingCapital ===
    -5000 + negSnap.totalReceivables - negSnap.totalPayables,
  "negative cash working capital",
);
// Gap with negative cash is lower than the demo fixture gap by exactly 5000 + demo cash
edge(
  negSnap.projectedGap30Days === snapshot.projectedGap30Days - data.cash - 5000,
  "negative cash reduces projected gap by cash delta",
);

// Zero revenue / COGS → DSO/DPO 0 (no divide-by-zero)
const zeroRev: NormalizedData = {
  ...data,
  revenueLast90Days: 0,
  cogsLast90Days: 0,
};
const zeroSnap = analyzeLiquidity(zeroRev).snapshot;
edge(zeroSnap.dso === 0 && zeroSnap.dpo === 0, "zero revenue/COGS → DSO/DPO 0");

// No lapsed customers when all activity is recent
const noLapsedData: NormalizedData = {
  ...data,
  invoices: data.invoices.filter((inv) => inv.contactId !== "c-lapsed"),
};
const noLapsed = analyzeRevenue(noLapsedData).lapsedCustomers;
edge(noLapsed.length === 0, "no lapsed customers when none inactive");

// Empty payments list on liquidity still ranks invoices (default reliability)
const noPay: NormalizedData = { ...data, payments: [] };
const noPayRisks = analyzeLiquidity(noPay).atRiskInvoices;
edge(
  noPayRisks.length > 0 &&
    noPayRisks.every((r) => r.paymentReliabilityScore === 50),
  "no payment history → default reliability 50 on all risks",
);

if (edgeFailed > 0) {
  console.error(`\nSmoke failed: ${edgeFailed} edge case(s)`);
  process.exit(1);
}

console.log("\nSmoke complete — engines ran on fixture (no LLM).");
