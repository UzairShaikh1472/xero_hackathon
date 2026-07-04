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
import { analyzeLiquidity, analyzeRevenue } from "../src/engines/index.js";

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

console.log("\nSmoke complete — engines ran on fixture (no LLM).");
