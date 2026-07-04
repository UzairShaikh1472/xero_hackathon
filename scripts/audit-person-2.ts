/**
 * Person 2 readiness audit — scoring, engines, and receivables AI agent.
 *
 * Run: npx tsx scripts/audit-person-2.ts
 *
 * Name mapping (guide → codebase):
 *   getLiquidityAnalysis     → analyzeLiquidity
 *   getRevenueOpportunities  → analyzeRevenue
 *   draftReceivablesAction   → draftReceivablesNegotiation
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { draftReceivablesNegotiation } from "../src/agents/index.js";
import { analyzeLiquidity, analyzeRevenue } from "../src/engines/index.js";
import {
  isSlowingDown,
  liquidityPriorityScore,
  paymentVelocityDecay,
} from "../src/scoring/index.js";
import type {
  InvoiceRisk,
  NegotiationDraft,
  NormalizedData,
} from "../src/types/financial.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../src/fixtures/demo-normalized.json");
const data = JSON.parse(readFileSync(fixturePath, "utf-8")) as NormalizedData;

const EPSILON = 1e-9;

type SectionKey =
  | "scoring"
  | "liquidity"
  | "revenue"
  | "agent";

const results: Record<SectionKey, boolean> = {
  scoring: false,
  liquidity: false,
  revenue: false,
  agent: false,
};

// ---------------------------------------------------------------------------
// 1. Scoring Engine
// ---------------------------------------------------------------------------
console.log("=== 1. Scoring Engine ===");

const TEST_AMOUNT = 10_000;
const TEST_DAYS_OVERDUE = 15;
const TEST_RELIABILITY = 80;
const EXPECTED_PRIORITY = 30; // (10000 * 15 * 0.2) / 1000

const priorityScore = liquidityPriorityScore(
  TEST_AMOUNT,
  TEST_DAYS_OVERDUE,
  TEST_RELIABILITY,
);
// Velocity decay uses current/historical avg payment days, not invoice fields.
// Synthetic pair tied to the "15 days" case: current 15d / historical 10d = 1.5
const velocityDecay = paymentVelocityDecay(15, 10);
const slowing = isSlowingDown(velocityDecay);

console.log(
  `  Test case: invoice £${TEST_AMOUNT.toLocaleString()}, ${TEST_DAYS_OVERDUE} days overdue, ${TEST_RELIABILITY}% reliability`,
);
console.log(`  Priority Score: ${priorityScore}`);
console.log(`  Velocity Decay (current 15d / historical 10d): ${velocityDecay}`);
console.log(`  isSlowingDown (> 1.5): ${slowing}`);

const priorityOk =
  Number.isFinite(priorityScore) &&
  Math.abs(priorityScore - EXPECTED_PRIORITY) < EPSILON;
const velocityOk =
  Number.isFinite(velocityDecay) && Math.abs(velocityDecay - 1.5) < EPSILON;

results.scoring = priorityOk && velocityOk;
console.log(
  `  → Scoring Logic: ${results.scoring ? "PASS" : "FAIL"}` +
    (!priorityOk ? " (priority mismatch)" : "") +
    (!velocityOk ? " (velocity mismatch)" : ""),
);

// ---------------------------------------------------------------------------
// 2. Liquidity Engine
// ---------------------------------------------------------------------------
console.log("\n=== 2. Liquidity Engine ===");

const { snapshot, atRiskInvoices } = analyzeLiquidity(data);

console.log("  CompanySnapshot:");
console.log(`    Cash: £${snapshot.cash.toLocaleString()}`);
console.log(`    DSO: ${snapshot.dso.toFixed(1)} days`);
console.log(`    DPO: ${snapshot.dpo.toFixed(1)} days`);
console.log(`    CCC: ${snapshot.ccc.toFixed(1)} days`);
console.log(
  `    30-day Gap: £${snapshot.projectedGap30Days.toLocaleString()}`,
);

console.log("\n  At-Risk Invoices (ranked by liquidity priority):");
for (const risk of atRiskInvoices) {
  console.log(
    `    ${risk.contactName} £${risk.amount} | overdue ${risk.daysOverdue}d | reliability ${risk.paymentReliabilityScore.toFixed(0)} | priority ${risk.liquidityPriorityScore.toFixed(2)} | ${risk.urgency} | ${risk.recommendedAction}`,
  );
}

const snapshotFinite =
  Number.isFinite(snapshot.dso) &&
  Number.isFinite(snapshot.dpo) &&
  Number.isFinite(snapshot.ccc) &&
  Number.isFinite(snapshot.projectedGap30Days);

const hasRisks = atRiskInvoices.length > 0;

const sortedDescending = atRiskInvoices.every(
  (risk, i) =>
    i === 0 ||
    atRiskInvoices[i - 1]!.liquidityPriorityScore >= risk.liquidityPriorityScore,
);

const scoresMatchFormula = atRiskInvoices.every((risk) => {
  const expected = liquidityPriorityScore(
    risk.amount,
    risk.daysOverdue,
    risk.paymentReliabilityScore,
  );
  return Math.abs(risk.liquidityPriorityScore - expected) < EPSILON;
});

results.liquidity =
  snapshotFinite && hasRisks && sortedDescending && scoresMatchFormula;

const liquidityFailures: string[] = [];
if (!snapshotFinite) liquidityFailures.push("non-finite snapshot metrics");
if (!hasRisks) liquidityFailures.push("no at-risk invoices");
if (!sortedDescending) liquidityFailures.push("not sorted by priority desc");
if (!scoresMatchFormula) liquidityFailures.push("priority formula mismatch");

console.log(
  `  → Liquidity Engine: ${results.liquidity ? "PASS" : "FAIL"}` +
    (liquidityFailures.length > 0
      ? ` (${liquidityFailures.join("; ")})`
      : ""),
);

// ---------------------------------------------------------------------------
// 3. AI Agent Layer (Receivables)
// ---------------------------------------------------------------------------
console.log("\n=== 3. AI Agent Layer (Receivables) ===");

const topRisk = atRiskInvoices[0];

if (!topRisk) {
  console.log("  No #1 at-risk invoice — skipping agent call.");
  results.agent = false;
} else {
  console.log(
    `  #1 ranked invoice: ${topRisk.contactName} £${topRisk.amount} overdue ${topRisk.daysOverdue}d (priority ${topRisk.liquidityPriorityScore.toFixed(2)})`,
  );

  try {
    const draft = await draftReceivablesNegotiation(topRisk);
    const jsonText = JSON.stringify(draft, null, 2);
    console.log("\n  Full JSON response:");
    console.log(jsonText);

    const agentChecks = auditReceivablesDraft(draft, topRisk);
    results.agent = agentChecks.every((c) => c.ok);

    for (const check of agentChecks) {
      console.log(`  ${check.ok ? "OK" : "FAIL"}: ${check.label}`);
    }
    console.log(`  → AI Agent Layer: ${results.agent ? "PASS" : "FAIL"}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  Agent call failed: ${message}`);
    results.agent = false;
    console.log("  → AI Agent Layer: FAIL");
  }
}

// ---------------------------------------------------------------------------
// 4. Revenue Engine
// ---------------------------------------------------------------------------
console.log("\n=== 4. Revenue Engine ===");

const { lapsedCustomers, repeatBuyers } = analyzeRevenue(data);

const topLapsed = lapsedCustomers[0];
const topRepeat = repeatBuyers[0];

if (topLapsed) {
  console.log("  Top Lapsed Customer:");
  console.log(
    `    ${topLapsed.contactName}: LTV £${topLapsed.historicalLTV.toLocaleString()} | ${topLapsed.daysSinceLastActivity}d inactive | score ${topLapsed.lapsedScore.toFixed(2)} | action: ${topLapsed.recommendedAction}`,
  );
} else {
  console.log("  Top Lapsed Customer: (none)");
}

if (topRepeat) {
  console.log("  Top Repeat Buyer:");
  console.log(
    `    ${topRepeat.contactName}: ${topRepeat.transactionCount} txns | avg £${topRepeat.averageInvoiceSize.toFixed(0)} | score ${topRepeat.repeatScore.toFixed(0)} | action: ${topRepeat.upsellOpportunity}`,
  );
} else {
  console.log("  Top Repeat Buyer: (none)");
}

const lapsedActionOk =
  !!topLapsed &&
  typeof topLapsed.recommendedAction === "string" &&
  topLapsed.recommendedAction.trim().length > 0;

const repeatActionOk =
  !!topRepeat &&
  typeof topRepeat.upsellOpportunity === "string" &&
  topRepeat.upsellOpportunity.trim().length > 0;

results.revenue = lapsedActionOk && repeatActionOk;

const revenueFailures: string[] = [];
if (!topLapsed) revenueFailures.push("no lapsed customers");
else if (!lapsedActionOk) revenueFailures.push("missing recommendedAction");
if (!topRepeat) revenueFailures.push("no repeat buyers");
else if (!repeatActionOk) revenueFailures.push("missing upsellOpportunity");

console.log(
  `  → Revenue Engine: ${results.revenue ? "PASS" : "FAIL"}` +
    (revenueFailures.length > 0 ? ` (${revenueFailures.join("; ")})` : ""),
);

// ---------------------------------------------------------------------------
// 5. Person 2 Readiness Report
// ---------------------------------------------------------------------------
console.log("\n=== Person 2 Readiness Report ===");
printCheck("Scoring Logic", results.scoring);
printCheck("Liquidity Engine", results.liquidity);
printCheck("Revenue Engine", results.revenue);
printCheck("AI Agent Layer", results.agent);

const allPass = Object.values(results).every(Boolean);
if (!allPass) {
  console.error("\nAudit incomplete — one or more sections failed.");
  process.exit(1);
}

console.log("\nAll Person 2 sections passed.");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printCheck(label: string, pass: boolean): void {
  const mark = pass ? "x" : " ";
  const status = pass ? "PASS" : "FAIL";
  console.log(`[${mark}] ${label}: ${status}`);
}

function auditReceivablesDraft(
  draft: NegotiationDraft,
  risk: InvoiceRisk,
): { ok: boolean; label: string }[] {
  const checks: { ok: boolean; label: string }[] = [];

  // 1. Valid JSON with NegotiationDraft keys
  let parsed: unknown;
  let validJson = false;
  try {
    parsed = JSON.parse(JSON.stringify(draft));
    validJson =
      typeof parsed === "object" &&
      parsed !== null &&
      hasNegotiationDraftKeys(parsed as Record<string, unknown>);
  } catch {
    validJson = false;
  }
  checks.push({ ok: validJson, label: "Valid JSON with NegotiationDraft keys" });

  // 2. References invoice amount and days overdue (reason is deterministic; also scan draftMessage)
  const payloadText = `${draft.reason}\n${draft.draftMessage}`;
  const amountOk = textReferencesAmount(payloadText, risk.amount);
  const daysOk = textReferencesDaysOverdue(payloadText, risk.daysOverdue);
  checks.push({
    ok: amountOk && daysOk,
    label: `References invoice amount (£${risk.amount}) and days overdue (${risk.daysOverdue})`,
  });

  // 3. Professional draftMessage
  const msg = draft.draftMessage ?? "";
  const professional =
    typeof msg === "string" &&
    msg.trim().length >= 20 &&
    !/TODO|lorem|placeholder|FIXME/i.test(msg);
  checks.push({
    ok: professional,
    label: "Professional draftMessage (non-empty prose)",
  });

  return checks;
}

function hasNegotiationDraftKeys(obj: Record<string, unknown>): boolean {
  const required = [
    "targetType",
    "contactName",
    "reason",
    "urgency",
    "proposedAction",
    "expectedCashImpact",
    "draftMessage",
    "confidenceLevel",
  ] as const;
  return required.every((key) => key in obj);
}

function textReferencesAmount(text: string, amount: number): boolean {
  const normalized = text.replace(/[£$,]/g, "");
  const amountStr = String(amount);
  const amountWithCommas = amount.toLocaleString("en-GB");
  return (
    normalized.includes(amountStr) ||
    text.includes(amountWithCommas) ||
    text.includes(String(amount))
  );
}

function textReferencesDaysOverdue(text: string, daysOverdue: number): boolean {
  // Match the number as a token (e.g. "12 days", "overdue 12")
  const re = new RegExp(`\\b${daysOverdue}\\b`);
  return re.test(text);
}
