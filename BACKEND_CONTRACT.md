# UpFlow Backend Contract

Backend status as of July 4, 2026:

- live Xero OAuth working
- live invoices and contacts sync working
- real receivables and payables now reflected in liquidity
- action draft and simulation workflow available

All responses use the same envelope:

```json
{
  "ok": true,
  "mode": "live",
  "generatedAt": "2026-07-04T14:20:00Z",
  "data": {}
}
```

## Core GET routes

### `GET /api/health`

Purpose:
- backend readiness
- Xero connection state

Key fields:
- `xeroConfigured`
- `xeroConnected`
- `authReady`
- `fallbackEnabled`
- `lastSyncAt`

### `GET /api/sync/phase-one`

Purpose:
- raw usable business snapshot for internal integration

Key fields:
- `invoices[]`
- `contacts[]`
- `sync`

Invoice fields:
- `id`
- `contactId`
- `contactName`
- `invoiceNumber`
- `invoiceType`
- `status`
- `issueDate`
- `dueDate`
- `total`
- `amountDue`
- `isOutstanding`
- `direction`
- `daysOverdue`
- `isOverdue`

### `GET /api/summary`

Purpose:
- top dashboard KPI row

Key fields:
- `organizationName`
- `currency`
- `totalInvoices`
- `contactsCount`
- `totalOutstandingReceivables`
- `overdueReceivables`
- `averageInvoiceValue`
- `overdueInvoicesCount`
- `atRiskInvoicesCount`
- `suggestedActionsCount`

### `GET /api/liquidity`

Purpose:
- cash flow lens

Key fields:
- `currentCash`
- `receivablesDue30d`
- `payablesDue30d`
- `receivablesOverdue`
- `projectedGap30d`
- `dso`
- `dpo`
- `ccc`
- `status`

### `GET /api/revenue-opportunities`

Purpose:
- revenue lens opportunity cards

Key fields:
- `totalOpportunities`
- `estimatedRevenueUnlock`
- `items[]`

Item fields:
- `id`
- `type`
- `contactId`
- `contactName`
- `estimatedValue`
- `reason`
- `priority`
- `recommendedAction`

### `GET /api/invoices/at-risk`

Purpose:
- ranked collections queue

Key fields:
- `totalAtRisk`
- `items[]`

Item fields:
- `invoiceId`
- `invoiceNumber`
- `contactName`
- `amountDue`
- `daysOverdue`
- `priority`
- `riskScore`
- `reason`
- `recommendedAction`

### `GET /api/executions/history`

Purpose:
- approval history and audit timeline

Key fields:
- `totalExecutions`
- `items[]`

Item fields:
- `executionId`
- `actionType`
- `actionId`
- `status`
- `idempotencyKey`
- `expectedCashUnlocked`
- `cashUnlocked`
- `auditLog`
- `targetName`
- `recordedAt`

## Action POST routes

### `POST /api/agent/receivables-draft`

Request:

```json
{
  "invoiceId": "inv_demo_001",
  "tone": "firm",
  "discountPercent": 3
}
```

Returns:
- one structured receivables negotiation draft

### `POST /api/agent/payables-draft`

Request:

```json
{
  "supplierName": "Paperline Supplies",
  "amount": 4200,
  "extensionDays": 21,
  "tone": "friendly"
}
```

Returns:
- one structured supplier extension draft

### `POST /api/agent/reengagement-quote`

Request:

```json
{
  "contactId": "contact_demo_001",
  "offerPercent": 12,
  "tone": "friendly"
}
```

Returns:
- one structured re-engagement quote draft

### `POST /api/simulate/execute`

Request:

```json
{
  "actionType": "receivables_discount",
  "actionId": "draft_receivables_inv_demo_001",
  "approved": true,
  "idempotencyKey": "demo-key-001"
}
```

Returns:
- execution result
- expected cash impact
- actual simulated cash unlocked
- audit log

## Current known limitations

- current cash is still `null`
- liquidity is stronger now, but still not using bank balance data
- some scoring heuristics are still simple
- storage is local file plus in-memory, not production database backed

## Recommended frontend mapping

Person 2:
- use `summary`, `invoices/at-risk`, `revenue-opportunities`

Person 3:
- use `summary`, `liquidity`, `receivables-draft`, `simulate/execute`, `executions/history`
