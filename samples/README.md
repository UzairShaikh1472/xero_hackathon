# Sample Payloads

These files are for teammate integration before live Xero credentials are available.

## Suggested use

- `person2-summary.json`
  - scoring and agent context
- `person2-invoices-at-risk.json`
  - risk ranking and action reasoning
- `person3-liquidity.json`
  - dashboard cards and liquidity panels
- `person3-action-flow.json`
  - approval flow and execution UI

All payloads follow the backend envelope:

```json
{
  "ok": true,
  "mode": "fallback",
  "generatedAt": "2026-07-04T14:00:00Z",
  "data": {}
}
```
