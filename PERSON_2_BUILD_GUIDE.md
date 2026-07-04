# Person 2 Build Guide — AI + Scoring

**Branch:** `person-2/ai-scoring`  
**Role:** AI + Scoring — liquidity engine, revenue scoring, agent prompts, negotiation drafts  
**Judging target:** The "agent" magic

---

## What You Own

Rules find the financial truth. AI only explains and drafts. You do **not** invent risk with the model.

| You build | You do **not** build |
|-----------|----------------------|
| Scoring formulas (DSO, liquidity, lapsed, etc.) | Xero OAuth / MCP (Person 1) |
| Liquidity gap projection | Dashboard UI (Person 3) |
| Agent prompts + draft endpoints | Write-back / idempotency (Person 1) |
| Types for scored outputs | Multi-page app |

### Core Principle

> Rules identify the financial truth. AI turns it into action and communication.

- Formulas detect what matters
- AI explains why it matters
- AI drafts the message
- AI does **NOT** invent the risk itself

---

## Shared Data Contracts

Agree these with Person 1 (Hour 5). Put them in `src/types/financial.ts`.

Person 1 normalizes Xero → these shapes. You only consume them.

```typescript
interface CompanySnapshot {
  cash: number;
  totalReceivables: number;
  totalPayables: number;
  workingCapital: number;
  dso: number;
  dpo: number;
  ccc: number;
  projectedGap30Days: number;
}

interface InvoiceRisk {
  contactId: string;
  contactName: string;
  invoiceId: string;
  amount: number;
  daysOverdue: number;
  paymentReliabilityScore: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  recommendedAction: string;
  expectedCashImpact: number;
}

interface LapsedCustomer {
  contactId: string;
  contactName: string;
  lastInvoiceDate: string;
  daysSinceLastActivity: number;
  historicalLTV: number;
  lapsedScore: number;
  recommendedAction: string;
}

interface RepeatBuyer {
  contactId: string;
  contactName: string;
  transactionCount: number;
  averageInvoiceSize: number;
  repeatScore: number;
  upsellOpportunity: string;
}

interface NegotiationDraft {
  targetType: 'receivable' | 'payable' | 'lapsed_customer';
  contactName: string;
  reason: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  proposedAction: string;
  expectedCashImpact: number;
  draftMessage: string;
  confidenceLevel: number;
}
```

**Input you need from Person 1 (or demo JSON):** invoices, contacts, payments, bank/cash, aged receivables/payables.

Until that exists, build against a **local fixture** that matches these types so you are not blocked.

---

## Suggested Folder Layout

```
src/
  types/financial.ts
  scoring/
    paymentReliability.ts
    liquidityPriority.ts
    lapsedCustomer.ts
    repeatBuyer.ts
    paymentVelocityDecay.ts
    index.ts
  engines/
    liquidity.ts
    revenue.ts
  agents/
    prompts.ts
    schemas.ts
    receivablesNegotiator.ts
    payablesNegotiator.ts
    reengagementAgent.ts
  fixtures/
    demo-normalized.json   # until P1 ships real data
```

---

## Step-by-Step Build Order

### Step 0 — Align Contracts (Hour 5, with Person 1)

- Agree on shared types above
- Confirm Person 1's normalized output shape
- Create `src/types/financial.ts`
- Create a fixture file so scoring work is not blocked

---

### Step 1 — Scoring Formulas (Hours 5–6)

**Status: done on `person-2/ai-scoring`.**

Create pure TypeScript functions (no network, no AI, no LLM). Formulas are deterministic math — the LLM is only used later for negotiation *drafts*, never for risk scores.

> Why TypeScript not Python? Same stack as Person 1/3 (Next.js). They import your modules directly. Python would need a separate service for no scoring benefit.

Create pure functions (no network, no AI):

```
src/scoring/
  paymentReliability.ts
  liquidityPriority.ts
  lapsedCustomer.ts
  repeatBuyer.ts
  paymentVelocityDecay.ts
```

#### Payment Reliability Score

```
reliability = (on_time_payments / total_payments) * 100
```

#### Liquidity Priority Score

```
priority = (invoice_amount * days_overdue * (1 - reliability_score / 100)) / 1000
```

#### Lapsed Customer Score

```
lapsed_score = (historical_ltv * days_since_last_activity) / 10000
```

#### Repeat Buyer Score

```
repeat_score = transaction_count * average_invoice_size * recency_weight
```

#### Payment Velocity Decay (The "Surprise" Metric)

```
velocity_decay = current_avg_payment_days / historical_avg_payment_days
// If > 1.5, flag as "slowing down" — early churn indicator
```

Write tiny unit tests or a `scripts/smoke-score.ts` that runs on fixture data so you can demo the numbers without the UI.

---

### Step 2 — Liquidity Engine (Hours 10–12)

```
src/engines/liquidity.ts
```

Implement:

1. **DSO** — days sales outstanding from receivables + revenue
2. **DPO** — days payable outstanding from payables + COGS/purchases
3. **CCC** — `DSO - DPO` (plus inventory days if available; otherwise DSO − DPO is fine for MVP)
4. **30-day liquidity gap** — projected cash in 30 days:
   `cash + receivables_due_in_30 - payables_due_in_30` (and any known outflows)
   Output `projectedGap30Days` on `CompanySnapshot`

Return a full `CompanySnapshot` plus a ranked list of `InvoiceRisk[]` using liquidity priority + reliability.

---

### Step 3 — Revenue Engine (Hours 16–18)

```
src/engines/revenue.ts
```

From invoices + contacts:

1. **Lapsed customers** — no recent invoice activity, score with lapsed formula, sort descending
2. **Repeat buyers** — high transaction count + size + recency, score with repeat formula
3. Attach `recommendedAction` strings that are **rule-based** (e.g. "Send re-engagement quote", "Offer early-pay discount"), not LLM-invented

---

### Step 4 — AI Prompt Templates (Hour 6, then flesh out in Phase 3)

```
src/agents/
  prompts.ts
  receivablesNegotiator.ts
  payablesNegotiator.ts
  reengagementAgent.ts
  schemas.ts          // OpenAI structured output schemas
```

#### Guardrails (non-negotiable)

- AI receives **already-scored** facts (amount, days overdue, reliability, expected impact)
- AI must **not** invent amounts, risk levels, or contacts
- Output must match `NegotiationDraft` (structured JSON)

#### Three Agents

| Agent | Input | Output |
|-------|--------|--------|
| Receivables negotiator | Top `InvoiceRisk` | Draft offer (e.g. 2% early settlement) + message |
| Payables negotiator | Supplier pressure / payable | Draft extension request |
| Revenue re-engagement | Top `LapsedCustomer` | Draft quote / win-back message |

Use OpenAI structured outputs so Person 3 always gets the same shape for the Approval Panel.

---

### Step 5 — Wire Agent API Routes (Hours 18–28)

Person 1 may own the route files; you own the handlers/logic. Target:

| Method | Endpoint | Your logic |
|--------|----------|------------|
| GET | `/api/liquidity` | Liquidity engine |
| GET | `/api/revenue-opportunities` | Revenue engine |
| GET | `/api/invoices/at-risk` | Ranked `InvoiceRisk[]` |
| POST | `/api/agent/receivables-draft` | Receivables agent |
| POST | `/api/agent/payables-draft` | Payables agent |
| POST | `/api/agent/reengagement-quote` | Re-engagement agent |

Each POST body: contact/invoice ids (or the scored object). Response: `NegotiationDraft`.

If Person 1's routes are not ready, export functions they can call:

```typescript
export function getLiquidityAnalysis(data: NormalizedData): LiquidityResult
export async function draftReceivablesNegotiation(risk: InvoiceRisk): Promise<NegotiationDraft>
```

---

### Step 6 — Explanation Layer (Hours 34–38)

Add a short `reason` / "Why this action?" field on every draft, still grounded in scores:

- Good: "£8,000 overdue 12 days; reliability 92%; priority score 4.8"
- Bad: "This customer seems risky" with no numbers

Polish edge cases: zero payments, division by zero, no lapsed customers, negative cash.

---

## Build Order If Starting Now

1. Types + fixture JSON matching the plan interfaces
2. All five scoring functions + smoke script
3. Liquidity engine → `CompanySnapshot` + at-risk invoices
4. Revenue engine → lapsed + repeat lists
5. Prompt templates + one working receivables draft (OpenAI)
6. Payables + re-engagement agents
7. Hand off response shapes to Person 3 for Approval Panel / Cash Unlocked

---

## Phase Checklist (from Execution Plan)

### Phase 1 — Foundation (Hours 0–8)

| Task | Deadline |
|------|----------|
| Define internal data contracts (with P1) | Hour 5 |
| Define scoring requirements and formulas | Hour 5 |
| Set up AI prompt templates | Hour 6 |

### Phase 2 — Scoring Engine (Hours 8–18) — **Primary Owner: You**

| Task | Deadline |
|------|----------|
| Implement DSO/DPO/CCC calculation | Hour 10 |
| Implement 30-day liquidity gap projection | Hour 12 |
| Implement payment reliability scoring | Hour 14 |
| Implement lapsed customer scoring | Hour 16 |
| Implement repeat buyer scoring | Hour 17 |
| Implement Payment Velocity Decay metric | Hour 18 |

**Exit criteria:** We can identify financial risk and revenue opportunity from real data.

### Phase 3 — Agent Layer (Hours 18–30) — **Primary Owner: You**

| Task | Deadline |
|------|----------|
| Build Receivables Negotiator agent (prompt + guardrails) | Hour 22 |
| Build Payables Negotiator agent | Hour 25 |
| Build Revenue Re-engagement agent (create-quote) | Hour 28 |

**Exit criteria:** We can recommend, draft, and simulate actions — not just report.

### Phase 4 — Polish (Hours 30–40)

| Task | Deadline |
|------|----------|
| Polish scoring edge cases | Hour 34 |
| Add explanation layer ("Why this action?") | Hour 38 |
| End-to-end integration test (with team) | Hour 40 |

---

## Coordination

### Blockers

- Need normalized invoices/contacts/payments — use fixtures until Person 1 delivers

### Handoff to Person 3

Stable JSON for:

- `GET /api/liquidity`
- `GET /api/revenue-opportunities`
- `GET /api/invoices/at-risk`
- `POST /api/agent/receivables-draft`
- `POST /api/agent/payables-draft`
- `POST /api/agent/reengagement-quote`

### Handoff to Person 1

`NegotiationDraft` fields they need for simulate/write-back:

- `proposedAction`
- `expectedCashImpact`
- contact/invoice ids

---

## MVP Freeze (Your Slice)

If time runs out, ship **this** and nothing more:

- [ ] Liquidity gap detection
- [ ] At-risk invoice ranking
- [ ] Lapsed customer list
- [ ] Repeat buyer list
- [ ] AI draft for receivables negotiation

---

## Anti-Patterns (Do Not Do)

- Do **not** let AI invent financial risks (deterministic rules only)
- Do **not** build a chatbot interface
- Do **not** invent amounts, contacts, or urgency levels in prompts
- Do **not** block on Person 1 — use fixtures

---

## Git

```bash
# You should already be on:
git checkout person-2/ai-scoring

# Push when ready:
git push -u origin person-2/ai-scoring
```
