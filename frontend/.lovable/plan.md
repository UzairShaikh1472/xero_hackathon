# Xero Kinetic — Frontend Build Plan (Person 3)

Scope for this Lovable project: the **Liquidity Control Room** UI and demo flow. Backend Xero/AI work stays with Persons 1 & 2 — I'll ship a clean frontend wired to a **seeded demo dataset** with a typed data contract, so their real APIs can drop in later without UI changes.

## Product surface

One route, one dense operator console (not a multi-page app):

```text
/                → Liquidity Control Room
/approvals/$id   → Draft detail + approval + simulated execution result
```

Everything else lives inside the control room as panels.

## Screen structure

1. **Header bar** — product mark "Xero Kinetic", connected org name ("Acme Trading Co · Xero"), live/demo status pill, last sync time.
2. **KPI strip (4 cards)** — Current cash, Projected 30-day gap (with delta), Overdue receivables, Revenue opportunities found (£).
3. **Cash Flow Lens (left column)** — DSO / DPO / CCC tiles, 30-day inflow vs outflow mini-chart (Recharts area), projected shortfall callout, at-risk invoices table (customer, amount, days overdue, risk score, action button).
4. **Revenue Lens (right column)** — Lapsed customers list (LTV, days silent, recovery £), Repeat buyers list (frequency, avg invoice, upsell £), Estimated recovery total.
5. **Agents At Work (full-width band)** — Two agent cards (Receivables Negotiator, Payables Negotiator) each showing queue count, top 3 recommended actions with reason + expected cash impact + confidence, "Review draft" CTA.
6. **Approval drawer** (opened from any action) — Draft message (editable), rationale, confidence, expected impact, Approve / Simulate / Reject. On Simulate → shows post-execution impact overlay on the KPI strip.
7. **Audit rail (collapsible bottom panel)** — Action history: who/what/when, human-in-the-loop badge, rationale snippet.

## Data contract (frozen now, matches Person 1's endpoints)

Types in `src/lib/kinetic/types.ts`, seed in `src/lib/kinetic/seed.ts`, single fetch layer in `src/lib/kinetic/api.ts` that today returns seed data and tomorrow calls `/api/summary`, `/api/liquidity`, `/api/revenue-opportunities`, `/api/invoices/at-risk`, `/api/agent/*-draft`, `/api/simulate/execute`.

Objects: `CompanySnapshot`, `LiquidityGap`, `InvoiceRisk`, `SupplierOpportunity`, `LapsedCustomer`, `RepeatBuyer`, `NegotiationDraft`, `ExecutionResult` — exactly the plan's model.

## Design direction

Operator console, not a toy chatbot. Dark-first finance surface:
- Deep navy background with high-contrast cards, thin borders, monospaced numerics for figures.
- Palette: **Navy Trust / Emerald Prestige hybrid** — navy base, emerald for positive cash impact, amber for at-risk, coral for critical gap.
- Typography: **Space Grotesk** (headings, KPI numerals) + **Inter** (body).
- Motion: subtle number tick-ups on load, drawer slide for approvals, KPI flash on simulated execution.
- Tokens defined in `src/styles.css` (oklch), no ad-hoc colors in components.

## Build phases (this project)

1. **Design system + shell** — tokens, header, KPI cards, layout grid.
2. **Cash Flow Lens** — DSO/DPO/CCC tiles, inflow/outflow chart, at-risk table.
3. **Revenue Lens** — lapsed + repeat buyer panels.
4. **Agents band + Approval drawer** — draft cards, editable message, simulate flow with KPI delta overlay.
5. **Audit rail + polish** — history, empty states, loading skeletons, demo "Reset scenario" button.

## Explicit non-goals (this project)

- No Xero OAuth, no Lovable Cloud, no real AI calls (drafts are pre-written strings on the seed — Person 2 swaps in later).
- No auth, no multi-tenant, no persistence beyond in-memory state.
- No settings pages, no marketing site.

## Deliverables

- One polished route with the seven sections above wired to typed seed data.
- Clean `api.ts` seam so Person 1 can point it at real endpoints by changing one file.
- Demo-ready flow: land → see gap → open at-risk invoice → review AI draft → Simulate → watch projected gap shrink.

Confirm and I'll start with the design system + shell in phase 1.
