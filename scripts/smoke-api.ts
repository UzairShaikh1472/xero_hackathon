/**
 * Smoke-test API handlers (no HTTP server required).
 * Run: npm run smoke:api
 *
 * GET handlers are pure. POST agent handlers call Gemini (needs GEMINI_API_KEY).
 */
import {
  payablesReason,
  receivablesReason,
  reengagementReason,
} from "../src/agents/index.js";
import {
  getAtRiskInvoices,
  getLiquidity,
  getRevenueOpportunities,
  openPayables,
  postPayablesDraft,
  postReceivablesDraft,
  postReengagementQuote,
} from "../src/handlers/index.js";
import { getNormalizedData } from "../src/handlers/data.js";
import type { NegotiationDraft } from "../src/types/financial.js";

let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed += 1;
  } else {
    console.log(`OK:   ${message}`);
  }
}

// --- GET handlers ---
const liquidity = getLiquidity();
assert(liquidity.ok && liquidity.status === 200, "GET liquidity status 200");
if (liquidity.ok) {
  assert(typeof liquidity.body.snapshot.cash === "number", "liquidity.snapshot.cash");
  assert(
    Array.isArray(liquidity.body.atRiskInvoices),
    "liquidity.atRiskInvoices is array",
  );
  assert(liquidity.body.atRiskInvoices.length > 0, "liquidity has at-risk invoices");
}

const revenue = getRevenueOpportunities();
assert(revenue.ok && revenue.status === 200, "GET revenue-opportunities status 200");
if (revenue.ok) {
  assert(Array.isArray(revenue.body.lapsedCustomers), "revenue.lapsedCustomers");
  assert(Array.isArray(revenue.body.repeatBuyers), "revenue.repeatBuyers");
  assert(revenue.body.lapsedCustomers.length > 0, "revenue has lapsed customers");
}

const atRisk = getAtRiskInvoices();
assert(atRisk.ok && atRisk.status === 200, "GET invoices/at-risk status 200");
if (atRisk.ok) {
  assert(atRisk.body.length > 0, "at-risk list non-empty");
}

// --- POST validation ---
const badReceivable = await postReceivablesDraft({});
assert(badReceivable.status === 400, "receivables-draft rejects empty body");

const missingReceivable = await postReceivablesDraft({ invoiceId: "no-such-id" });
assert(missingReceivable.status === 404, "receivables-draft 404 for unknown id");

const badPayable = await postPayablesDraft({});
assert(badPayable.status === 400, "payables-draft rejects empty body");

const badReengage = await postReengagementQuote({});
assert(badReengage.status === 400, "reengagement-quote rejects empty body");

// --- POST agent drafts (Gemini) ---
const topRisk = atRisk.ok ? atRisk.body[0] : undefined;
const topLapsed = revenue.ok ? revenue.body.lapsedCustomers[0] : undefined;
const topPayable = openPayables(getNormalizedData())[0];

if (!topRisk || !topLapsed || !topPayable) {
  console.error("FAIL: fixture missing scored inputs for agent drafts");
  process.exit(1);
}

console.log("\nCalling Gemini via handlers...\n");

const receivables = await postReceivablesDraft({ invoiceId: topRisk.invoiceId });
assert(receivables.ok && receivables.status === 200, "receivables-draft by invoiceId");
if (receivables.ok) {
  assertGuardrails("receivables", receivables.body, {
    contactName: topRisk.contactName,
    proposedAction: topRisk.recommendedAction,
    expectedCashImpact: topRisk.expectedCashImpact,
    urgency: topRisk.urgency,
    reason: receivablesReason(topRisk),
  });
}

const payables = await postPayablesDraft({ invoiceId: topPayable.invoiceId });
assert(payables.ok && payables.status === 200, "payables-draft by invoiceId");
if (payables.ok) {
  assertGuardrails("payables", payables.body, {
    contactName: topPayable.contactName,
    proposedAction: topPayable.recommendedAction,
    expectedCashImpact: topPayable.expectedCashImpact,
    urgency: topPayable.urgency,
    reason: payablesReason(topPayable),
  });
}

const reengagement = await postReengagementQuote({
  contactId: topLapsed.contactId,
});
assert(reengagement.ok && reengagement.status === 200, "reengagement-quote by contactId");
if (reengagement.ok) {
  assertGuardrails("reengagement", reengagement.body, {
    contactName: topLapsed.contactName,
    proposedAction: topLapsed.recommendedAction,
    expectedCashImpact: topLapsed.historicalLTV,
    reason: reengagementReason(topLapsed),
  });
}

if (failed > 0) {
  console.error(`\nSmoke failed: ${failed} assertion(s)`);
  process.exit(1);
}

console.log("\nSmoke complete — all API handlers OK.");

function assertGuardrails(
  label: string,
  draft: NegotiationDraft,
  expected: {
    contactName: string;
    proposedAction: string;
    expectedCashImpact: number;
    urgency?: string;
    reason: string;
  },
): void {
  const guardOk =
    draft.contactName === expected.contactName &&
    draft.proposedAction === expected.proposedAction &&
    draft.expectedCashImpact === expected.expectedCashImpact &&
    draft.reason === expected.reason &&
    (expected.urgency === undefined || draft.urgency === expected.urgency);

  assert(guardOk, `${label} guardrails (scored fields + deterministic reason)`);
  assert(
    typeof draft.draftMessage === "string" && draft.draftMessage.length > 0,
    `${label} draftMessage`,
  );
}
