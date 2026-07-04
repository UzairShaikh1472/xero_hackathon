import assert from "node:assert/strict";

import {
  buildPaymentReminderHtml,
  buildPaymentReminderText,
  normalizeEmailBody,
  stripLeadingSalutation,
} from "../src/lib/services/email-templates.js";

function testStripLeadingSalutation() {
  assert.equal(
    stripLeadingSalutation("Hi Acorn Retail, we noticed INV-001 is outstanding."),
    "we noticed INV-001 is outstanding.",
  );
  assert.equal(
    stripLeadingSalutation("Dear Ridgeway University,\n\nOur records show..."),
    "Our records show...",
  );
  assert.equal(
    stripLeadingSalutation("Hello Sarah, quick note about payment."),
    "quick note about payment.",
  );
  assert.equal(
    stripLeadingSalutation("No greeting here."),
    "No greeting here.",
  );
}

function testNormalizeEmailBody() {
  assert.equal(
    normalizeEmailBody(
      "Dear Ridgeway University,\n\nOur records show overdue payment.\n\nBest regards,\n[Your Name]",
    ),
    "Our records show overdue payment.",
  );
}

function testPaymentReminderTemplates() {
  const params = {
    contactName: "Ridgeway University",
    organizationName: "Northstar Services Ltd",
    body: "Our records show this invoice is overdue. Please let us know if you have any questions.",
    invoiceNumber: "INV-1041",
    amountDue: 6187.5,
    currency: "GBP",
    daysOverdue: 12,
    discountPercent: 2,
    discountedAmount: 6063.75,
  };

  const html = buildPaymentReminderHtml(params);
  const text = buildPaymentReminderText(params);

  assert.match(html, /Hi Ridgeway University,/);
  assert.doesNotMatch(html, /Dear Ridgeway University/);
  assert.match(html, /#INV-1041/);
  assert.match(html, /£6,187\.50/);
  assert.match(html, /6063\.75|6,063\.75/);
  assert.match(html, /Northstar Services Ltd/);
  assert.doesNotMatch(html, /\[Your Name\]/);

  assert.match(text, /Hi Ridgeway University,/);
  assert.doesNotMatch(text, /Dear Ridgeway University/);
  assert.match(text, /Invoice summary/);
  assert.match(text, /#INV-1041/);
  assert.match(text, /Northstar Services Ltd/);

  const duplicateGreetingBody = normalizeEmailBody(
    "Hi Ridgeway University, please settle soon.",
  );
  const htmlWithLegacyBody = buildPaymentReminderHtml({
    ...params,
    body: duplicateGreetingBody,
  });
  const greetingCount = (htmlWithLegacyBody.match(/Hi Ridgeway University/g) ?? []).length;
  assert.equal(greetingCount, 1, "expected exactly one greeting in HTML output");
}

testStripLeadingSalutation();
testNormalizeEmailBody();
testPaymentReminderTemplates();

console.log("email-templates: all tests passed");
