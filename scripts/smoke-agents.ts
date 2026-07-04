/**
 * Smoke-test agent draft functions against the demo fixture.
 * Run: npm run smoke:agents
 *
 * Requires GEMINI_API_KEY (see .env.example).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  draftPayablesNegotiation,
  draftReceivablesNegotiation,
  draftReengagementQuote,
  payablesReason,
  receivablesReason,
  reengagementReason,
} from "../src/agents/index.js";
import { analyzeLiquidity, analyzeRevenue } from "../src/engines/index.js";
import { daysBetween } from "../src/lib/dates.js";
import type {
  NegotiationDraft,
  NormalizedData,
  NormalizedInvoice,
  PayablePressure,
  Urgency,
} from "../src/types/financial.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../src/fixtures/demo-normalized.json");
const data = JSON.parse(readFileSync(fixturePath, "utf-8")) as NormalizedData;

const { atRiskInvoices } = analyzeLiquidity(data);
const { lapsedCustomers } = analyzeRevenue(data);

const topRisk = atRiskInvoices[0];
const topLapsed = lapsedCustomers[0];
const openPayable = data.invoices.find(
  (inv) => inv.type === "ACCPAY" && inv.amountDue > 0,
);

if (!topRisk) {
  throw new Error("Fixture produced no at-risk invoices");
}
if (!topLapsed) {
  throw new Error("Fixture produced no lapsed customers");
}
if (!openPayable) {
  throw new Error("Fixture produced no open payables");
}

const payablePressure = toPayablePressure(openPayable, data.asOfDate);

console.log("Calling Gemini for three negotiation drafts (sequential)...\n");

// Sequential to stay within Gemini free-tier rate limits.
const receivables = await draftReceivablesNegotiation(topRisk);
const payables = await draftPayablesNegotiation(payablePressure);
const reengagement = await draftReengagementQuote(topLapsed);

const results = [
  printDraft("Receivables", receivables, {
    contactName: topRisk.contactName,
    proposedAction: topRisk.recommendedAction,
    expectedCashImpact: topRisk.expectedCashImpact,
    urgency: topRisk.urgency,
    reason: receivablesReason(topRisk),
  }),
  printDraft("Payables", payables, {
    contactName: payablePressure.contactName,
    proposedAction: payablePressure.recommendedAction,
    expectedCashImpact: payablePressure.expectedCashImpact,
    urgency: payablePressure.urgency,
    reason: payablesReason(payablePressure),
  }),
  printDraft("Re-engagement", reengagement, {
    contactName: topLapsed.contactName,
    proposedAction: topLapsed.recommendedAction,
    expectedCashImpact: topLapsed.historicalLTV,
    reason: reengagementReason(topLapsed),
  }),
];

const allGuardOk = results.every(Boolean);

if (!allGuardOk) {
  console.error("\nSmoke failed — guardrails violated on one or more drafts.");
  process.exit(1);
}

console.log("\nSmoke complete — agent drafts returned (guardrails applied).");

function toPayablePressure(
  inv: NormalizedInvoice,
  asOf: string,
): PayablePressure {
  const daysOverdue = Math.max(0, daysBetween(inv.dueDate, asOf));
  return {
    contactId: inv.contactId,
    contactName: inv.contactName,
    invoiceId: inv.invoiceId,
    amount: inv.amountDue,
    daysOverdue,
    urgency: payableUrgency(daysOverdue, daysBetween(asOf, inv.dueDate)),
    recommendedAction: "Request 14-day payment extension",
    expectedCashImpact: inv.amountDue,
  };
}

function payableUrgency(daysOverdue: number, daysUntilDue: number): Urgency {
  if (daysOverdue >= 14) return "critical";
  if (daysOverdue > 0) return "high";
  if (daysUntilDue <= 7) return "medium";
  return "low";
}

function printDraft(
  label: string,
  draft: NegotiationDraft,
  expected: {
    contactName: string;
    proposedAction: string;
    expectedCashImpact: number;
    urgency?: Urgency;
    reason: string;
  },
): boolean {
  const guardOk =
    draft.contactName === expected.contactName &&
    draft.proposedAction === expected.proposedAction &&
    draft.expectedCashImpact === expected.expectedCashImpact &&
    draft.reason === expected.reason &&
    (expected.urgency === undefined || draft.urgency === expected.urgency);

  console.log(`=== ${label} (${draft.targetType}) ===`);
  console.log(`  contact: ${draft.contactName}`);
  console.log(`  urgency: ${draft.urgency}`);
  console.log(`  action: ${draft.proposedAction}`);
  console.log(`  impact: £${draft.expectedCashImpact.toFixed(0)}`);
  console.log(`  confidence: ${draft.confidenceLevel.toFixed(2)}`);
  console.log(`  reason: ${draft.reason}`);
  console.log(`  message: ${draft.draftMessage}`);
  console.log(`  guardrails: ${guardOk ? "OK" : "FAILED — scored fields mutated"}`);
  console.log();
  return guardOk;
}
