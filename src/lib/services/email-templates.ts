import { markdownToHtml } from "../utils/markdown.js";

export interface PaymentReminderParams {
  contactName: string;
  organizationName: string;
  body: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  daysOverdue: number;
  discountPercent?: number;
  discountedAmount?: number;
}

const SALUTATION_PATTERN =
  /^(?:hi|hello|dear)\s+[^,\n]+,\s*(?:\n|\r\n?)?/i;

const SIGN_OFF_PATTERN =
  /\n\s*(?:best(?:\s+regards)?|kind\s+regards|regards|sincerely|thanks|thank\s+you),?\s*(?:\n[\s\S]*)?$/i;

export function stripLeadingSalutation(body: string): string {
  return body.replace(SALUTATION_PATTERN, "").trimStart();
}

export function stripTrailingSignOff(body: string): string {
  return body.replace(SIGN_OFF_PATTERN, "").trimEnd();
}

export function normalizeEmailBody(body: string): string {
  return stripTrailingSignOff(stripLeadingSalutation(body.trim()));
}

function formatMoney(amount: number, currency: string): string {
  const symbol = currency === "GBP" ? "£" : `${currency} `;
  return `${symbol}${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildInvoiceSummaryHtml(params: PaymentReminderParams): string {
  const amountLabel = formatMoney(params.amountDue, params.currency);
  const discountRow =
    params.discountPercent != null &&
    params.discountPercent > 0 &&
    params.discountedAmount != null
      ? `<tr>
          <td style="padding: 8px 0; color: #555;">Settlement offer (${params.discountPercent}% off)</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #166534;">${formatMoney(params.discountedAmount, params.currency)} if paid within 7 days</td>
        </tr>`
      : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
    <tr>
      <td style="padding: 16px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #555;">Invoice</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">#${escapeHtml(params.invoiceNumber)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #555;">Amount due</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${amountLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #555;">Overdue</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${params.daysOverdue} day${params.daysOverdue === 1 ? "" : "s"}</td>
          </tr>
          ${discountRow}
        </table>
      </td>
    </tr>
  </table>`;
}

function buildInvoiceSummaryText(params: PaymentReminderParams): string {
  const lines = [
    "── Invoice summary ──",
    `Invoice:     #${params.invoiceNumber}`,
    `Amount due:  ${formatMoney(params.amountDue, params.currency)}`,
    `Overdue:     ${params.daysOverdue} day${params.daysOverdue === 1 ? "" : "s"}`,
  ];

  if (
    params.discountPercent != null &&
    params.discountPercent > 0 &&
    params.discountedAmount != null
  ) {
    lines.push(
      `Offer:       ${formatMoney(params.discountedAmount, params.currency)} if paid within 7 days (${params.discountPercent}% off)`,
    );
  }

  lines.push("────────────────────");
  return lines.join("\n");
}

export function buildPaymentReminderHtml(params: PaymentReminderParams): string {
  const body = normalizeEmailBody(params.body);
  const bodyHtml = escapeHtml(body).replace(/\n/g, "<br />");

  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="margin: 0 0 16px;">Hi ${escapeHtml(params.contactName)},</p>
  ${buildInvoiceSummaryHtml(params)}
  ${body ? `<p style="margin: 0 0 16px;">${bodyHtml}</p>` : ""}
  <p style="margin: 24px 0 4px;">Best regards,</p>
  <p style="margin: 0; font-weight: 600;">${escapeHtml(params.organizationName)}</p>
  <p style="margin-top: 32px; font-size: 13px; color: #666;">Sent via UpFlow on behalf of your finance team.</p>
</body>
</html>`;
}

export function buildPaymentReminderText(params: PaymentReminderParams): string {
  const body = normalizeEmailBody(params.body);

  return `Hi ${params.contactName},

${buildInvoiceSummaryText(params)}

${body}

Best regards,
${params.organizationName}

Sent via UpFlow on behalf of your finance team.`;
}

export function buildVoiceInviteHtml(params: {
  contactName: string;
  invoiceNumber: string;
  daysOverdue: number;
  amountLabel: string;
  callUrl: string;
  message?: string;
}) {
  const intro =
    normalizeEmailBody(
      params.message?.trim() ||
        `Invoice ${params.invoiceNumber} is now ${params.daysOverdue} days overdue with ${params.amountLabel} outstanding. We'd like to discuss a quick resolution.`,
    );

  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p>Hi ${escapeHtml(params.contactName)},</p>
  <p>${escapeHtml(intro)}</p>
  <p style="margin: 32px 0;">
    <a href="${escapeHtml(params.callUrl)}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
      Join call with agent
    </a>
  </p>
  <p style="font-size: 14px; color: #666;">Or copy this link: <a href="${escapeHtml(params.callUrl)}">${escapeHtml(params.callUrl)}</a></p>
  <p style="margin-top: 32px; font-size: 13px; color: #666;">Sent via UpFlow on behalf of your finance team.</p>
</body>
</html>`;
}

export function buildVoiceInviteText(params: {
  contactName: string;
  invoiceNumber: string;
  daysOverdue: number;
  amountLabel: string;
  callUrl: string;
  message?: string;
}) {
  const intro =
    normalizeEmailBody(
      params.message?.trim() ||
        `Invoice ${params.invoiceNumber} is now ${params.daysOverdue} days overdue with ${params.amountLabel} outstanding.`,
    );

  return `Hi ${params.contactName},

${intro}

Join a call with our collections agent here:
${params.callUrl}

Sent via UpFlow on behalf of your finance team.`;
}

export interface ReactivationEmailParams {
  contactName: string;
  organizationName: string;
  body: string;
  daysSinceLastActivity: number;
  historicalLTV: number;
  currency: string;
  offerPercent?: number;
  estimatedValue?: number;
}

function buildReactivationSummaryHtml(params: ReactivationEmailParams): string {
  const ltvLabel = formatMoney(params.historicalLTV, params.currency);
  const offerRow =
    params.offerPercent != null &&
    params.offerPercent > 0 &&
    params.estimatedValue != null
      ? `<tr>
          <td style="padding: 8px 0; color: #555;">Returning-customer offer (${params.offerPercent}% off)</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #166534;">${formatMoney(params.estimatedValue, params.currency)} estimated order value</td>
        </tr>`
      : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
    <tr>
      <td style="padding: 16px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #555;">Days since last order</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${params.daysSinceLastActivity} day${params.daysSinceLastActivity === 1 ? "" : "s"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #555;">Historical LTV</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${ltvLabel}</td>
          </tr>
          ${offerRow}
        </table>
      </td>
    </tr>
  </table>`;
}

function buildReactivationSummaryText(params: ReactivationEmailParams): string {
  const lines = [
    "── Account summary ──",
    `Last activity: ${params.daysSinceLastActivity} day${params.daysSinceLastActivity === 1 ? "" : "s"} ago`,
    `Historical LTV: ${formatMoney(params.historicalLTV, params.currency)}`,
  ];

  if (
    params.offerPercent != null &&
    params.offerPercent > 0 &&
    params.estimatedValue != null
  ) {
    lines.push(
      `Offer: ${formatMoney(params.estimatedValue, params.currency)} estimated with ${params.offerPercent}% returning-customer incentive`,
    );
  }

  lines.push("────────────────────");
  return lines.join("\n");
}

export function buildReactivationEmailHtml(params: ReactivationEmailParams): string {
  const body = normalizeEmailBody(params.body);
  const bodyHtml = escapeHtml(body).replace(/\n/g, "<br />");

  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="margin: 0 0 16px;">Hi ${escapeHtml(params.contactName)},</p>
  ${buildReactivationSummaryHtml(params)}
  ${body ? `<p style="margin: 0 0 16px;">${bodyHtml}</p>` : ""}
  <p style="margin: 24px 0 4px;">Best regards,</p>
  <p style="margin: 0; font-weight: 600;">${escapeHtml(params.organizationName)}</p>
  <p style="margin-top: 32px; font-size: 13px; color: #666;">Sent via UpFlow on behalf of your finance team.</p>
</body>
</html>`;
}

export function buildReactivationEmailText(params: ReactivationEmailParams): string {
  const body = normalizeEmailBody(params.body);

  return `Hi ${params.contactName},

${buildReactivationSummaryText(params)}

${body}

Best regards,
${params.organizationName}

Sent via UpFlow on behalf of your finance team.`;
}

export function buildReactivationVoiceInviteHtml(params: {
  contactName: string;
  daysSinceLastActivity: number;
  amountLabel: string;
  callUrl: string;
  message?: string;
}) {
  const intro =
    normalizeEmailBody(
      params.message?.trim() ||
        `It's been ${params.daysSinceLastActivity} days since we last worked together (${params.amountLabel} historical value). We'd love to hear what you're planning next.`,
    );

  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p>Hi ${escapeHtml(params.contactName)},</p>
  <p>${escapeHtml(intro)}</p>
  <p style="margin: 32px 0;">
    <a href="${escapeHtml(params.callUrl)}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
      Speak with reactivation agent
    </a>
  </p>
  <p style="font-size: 14px; color: #666;">Or copy this link: <a href="${escapeHtml(params.callUrl)}">${escapeHtml(params.callUrl)}</a></p>
  <p style="margin-top: 32px; font-size: 13px; color: #666;">Sent via UpFlow on behalf of your finance team.</p>
</body>
</html>`;
}

export function buildReactivationVoiceInviteText(params: {
  contactName: string;
  daysSinceLastActivity: number;
  amountLabel: string;
  callUrl: string;
  message?: string;
}) {
  const intro =
    normalizeEmailBody(
      params.message?.trim() ||
        `It's been ${params.daysSinceLastActivity} days since we last worked together (${params.amountLabel} historical value).`,
    );

  return `Hi ${params.contactName},

${intro}

Speak with our reactivation agent here:
${params.callUrl}

Sent via UpFlow on behalf of your finance team.`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildCallReportHtml(params: {
  contactName: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  daysOverdue: number;
  summary: string;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const amountLabel = formatMoney(params.amountDue, params.currency);
  const summaryHtml = markdownToHtml(params.summary);
  const transcriptHtml = params.transcript
    .map((turn) => {
      const speaker = turn.role === "user" ? params.contactName : "Agent";
      return `<p style="margin: 0 0 12px;"><strong>${escapeHtml(speaker)}:</strong> ${escapeHtml(turn.content)}</p>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 20px; margin: 0 0 8px;">Collections call summary</h1>
  <p style="margin: 0 0 20px; color: #555;">${escapeHtml(params.contactName)} · Invoice #${escapeHtml(params.invoiceNumber)} · ${amountLabel} · ${params.daysOverdue} day${params.daysOverdue === 1 ? "" : "s"} overdue</p>
  <h2 style="font-size: 16px; margin: 24px 0 8px;">Summary</h2>
  <div style="margin: 0 0 24px;">${summaryHtml}</div>
  <h2 style="font-size: 16px; margin: 24px 0 8px;">Full transcript</h2>
  <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #f9fafb;">
    ${transcriptHtml}
  </div>
  <p style="margin-top: 32px; font-size: 13px; color: #666;">Sent via UpFlow after a browser voice collections call.</p>
</body>
</html>`;
}

export function buildCallReportText(params: {
  contactName: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  daysOverdue: number;
  summary: string;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const amountLabel = formatMoney(params.amountDue, params.currency);
  const transcriptText = params.transcript
    .map((turn) => {
      const speaker = turn.role === "user" ? params.contactName : "Agent";
      return `${speaker}: ${turn.content}`;
    })
    .join("\n\n");

  return `Collections call summary

${params.contactName} · Invoice #${params.invoiceNumber} · ${amountLabel} · ${params.daysOverdue} days overdue

Summary
-------
${params.summary}

Full transcript
-----------------
${transcriptText}

Sent via UpFlow after a browser voice collections call.`;
}
