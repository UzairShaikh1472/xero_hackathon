# Xero Kinetic — 48-Hour Execution Plan

## Product Summary

**Xero Kinetic** is an AI-powered liquidity and revenue acceleration engine for small businesses using Xero. It combines deterministic financial analysis with agentic recommendation workflows to help businesses identify upcoming cash gaps, prioritize collections, unlock lapsed revenue, and simulate financially safe corrective actions.

It operates through two lenses from the same Xero data:
- **Cash Flow Lens**: Detect liquidity gaps, overdue receivables, supplier pressure, and next-best financial actions.
- **Revenue Lens**: Identify lapsed customers, repeat buyers, and high-value opportunities that can bring cash back faster.

## Judging Alignment

| Criteria | Weight | How We Win |
|----------|--------|------------|
| Xero Connection | 50% | Real OAuth, real data pull, real write-back path via MCP Server |
| API Integration | 30% | Deep use of Invoices, Contacts, Payments, Aged Receivables, Aged Payables, Quotes, Credit Notes |
| Architecture | 20% | Clean separation of concerns, idempotency, deterministic scoring + AI drafting, fallback demo data |

## Product Flow (The Winning Narrative)

1. Connect to Xero
2. Pull real accounting data
3. Detect a future cash gap
4. Rank the best customer and supplier actions
5. Generate AI negotiation drafts
6. Show simulated approval and write-back path
7. Display "Cash Unlocked" counter showing measurable impact

## Architecture

```
Frontend (Next.js) → Backend (API Routes) → Xero MCP Server → Xero API
                                           → Scoring Engine (deterministic)
                                           → AI Layer (OpenAI structured outputs)
                                           → Local Store (SQLite / JSON fallback)
```

### Tech Stack
- **Frontend**: Next.js + Tailwind CSS
- **Backend**: Next.js API routes or lightweight Node service
- **Xero Layer**: MCP Server (`@xeroapi/xero-mcp-server`) or SDK adapter
- **Scoring Engine**: Deterministic logic module (TypeScript)
- **AI Layer**: OpenAI API with structured output schemas
- **Data Store**: SQLite or in-memory JSON
- **Fallback**: Seeded demo JSON dataset (MUST be ready by Hour 4)

## Team Structure

| Role | Owns | Judging Target |
|------|------|----------------|
| Person 1: Xero + Backend | Auth, MCP setup, data fetching, normalization, write-back, idempotency | 50% Xero Connection |
| Person 2: AI + Scoring | Liquidity engine, revenue scoring, agent prompts, negotiation drafts | The "agent" magic |
| Person 3: Frontend + Demo | Dashboard, two-lens UI, approval flow, demo story, pitch visuals | 20% Architecture + Demo Impact |

## Internal Data Model

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

## Backend API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check and Xero connection status |
| GET | `/api/summary` | Company snapshot with all KPIs |
| GET | `/api/liquidity` | Liquidity gap analysis and 30-day projection |
| GET | `/api/revenue-opportunities` | Lapsed customers + repeat buyers + upsell targets |
| GET | `/api/invoices/at-risk` | Ranked at-risk invoices |
| POST | `/api/agent/receivables-draft` | Generate receivables negotiation draft |
| POST | `/api/agent/payables-draft` | Generate payables extension draft |
| POST | `/api/agent/reengagement-quote` | Generate lapsed customer re-engagement quote |
| POST | `/api/simulate/execute` | Simulate write-back and show impact |

## Xero MCP Commands Used

### READ (Data Sources)
- `list-bank-transactions` — Cash position
- `list-aged-receivables-by-contact` — Who owes what and for how long
- `list-aged-payables-by-contact` — What we owe and when
- `list-contacts` — Customer/supplier profiles
- `list-invoices` — Invoice details and history
- `list-payments` — Payment history for reliability scoring
- `list-profit-and-loss` — Revenue and COGS for DSO/DPO calculation

### WRITE (Actions)
- `create-credit-note` — Apply early settlement discount
- `create-quote` — Draft re-engagement quote for lapsed customer
- `update-invoice` — Update payment terms

## Scoring Models (Person 2)

### Payment Reliability Score
```
reliability = (on_time_payments / total_payments) * 100
```

### Liquidity Priority Score
```
priority = (invoice_amount * days_overdue * (1 - reliability_score)) / 1000
```

### Lapsed Customer Score
```
lapsed_score = (historical_ltv * days_since_last_activity) / 10000
```

### Repeat Buyer Score
```
repeat_score = transaction_count * average_invoice_size * recency_weight
```

### Payment Velocity Decay (The "Surprise" Metric)
```
velocity_decay = current_avg_payment_days / historical_avg_payment_days
// If > 1.5, flag as "slowing down" — early churn indicator
```

### Core Principle
> Rules identify the financial truth. AI turns it into action and communication.

- Formulas detect what matters
- AI explains why it matters
- AI drafts the message
- AI does NOT invent the risk itself

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│ Xero Kinetic          Connected: Demo Co    ● Live      │
├─────────────────────────────────────────────────────────┤
│ 💰 Cash: £12,400 │ ⚠️ 30-Day Gap: -£8,200 │ 📊 Overdue: £24,600 │ 🚀 Cash Unlocked: £0 │
├──────────────────────────┬──────────────────────────────┤
│   CASH FLOW LENS         │   REVENUE LENS               │
│                          │                              │
│ DSO: 42 days             │ Lapsed Customers: 4          │
│ DPO: 28 days             │ Repeat Buyers: 7             │
│ CCC: 14 days             │ Re-engagement Value: £18,200 │
│ Receivables Due: £24,600 │ Upsell Potential: £6,400     │
│ Payables Due: £16,800    │                              │
│ Projected Shortfall: -£8,200 │                          │
├──────────────────────────┴──────────────────────────────┤
│   AGENTS AT WORK                                        │
│                                                         │
│ [Receivables Agent] Drafting offer for Customer A...    │
│ [Revenue Agent] Re-engagement quote for Lapsed Co B...  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│   APPROVAL PANEL                                        │
│                                                         │
│ Action: Offer 2% discount to Customer A (£8,000 inv)   │
│ Impact: +£7,840 cash in 24h                            │
│ Confidence: 92%                                         │
│ [✓ Approve] [✗ Reject] [📝 Edit Draft]                 │
└─────────────────────────────────────────────────────────┘
```

## 48-Hour Phase Plan

### Phase 1: Foundation (Hours 0–8)
**Primary Owner: Person 1**

| Task | Owner | Deadline |
|------|-------|----------|
| Create Xero developer app | P1 | Hour 1 |
| Configure Custom Connection + OAuth | P1 | Hour 2 |
| Set up MCP server locally | P1 | Hour 3 |
| First successful data fetch (list-invoices) | P1 | Hour 4 |
| **Create fallback demo JSON dataset** | P1 | **Hour 4** |
| Define internal data contracts (TypeScript interfaces) | P1 + P2 | Hour 5 |
| Set up Next.js project with Tailwind | P3 | Hour 3 |
| Create basic dashboard shell with placeholder data | P3 | Hour 6 |
| Define scoring requirements and formulas | P2 | Hour 5 |
| Set up AI prompt templates | P2 | Hour 6 |

**Exit Criteria:** "We can connect to Xero and fetch real data. Fallback data is ready."

### Phase 2: Scoring Engine + Data Normalization (Hours 8–18)
**Primary Owner: Person 2**

| Task | Owner | Deadline |
|------|-------|----------|
| Normalize invoices, contacts, payments into internal model | P1 | Hour 12 |
| Build backend API routes (summary, liquidity, revenue) | P1 | Hour 14 |
| Implement DSO/DPO/CCC calculation | P2 | Hour 10 |
| Implement 30-day liquidity gap projection | P2 | Hour 12 |
| Implement payment reliability scoring | P2 | Hour 14 |
| Implement lapsed customer scoring | P2 | Hour 16 |
| Implement repeat buyer scoring | P2 | Hour 17 |
| Implement Payment Velocity Decay metric | P2 | Hour 18 |
| Wire dashboard to real backend endpoints | P3 | Hour 14 |
| Build Cash Flow Lens UI panel | P3 | Hour 16 |
| Build Revenue Lens UI panel | P3 | Hour 18 |

**Exit Criteria:** "We can identify financial risk and revenue opportunity from real data."

### Phase 3: Agent Layer (Hours 18–30)
**Primary Owner: Person 2**

| Task | Owner | Deadline |
|------|-------|----------|
| Build Receivables Negotiator agent (prompt + guardrails) | P2 | Hour 22 |
| Build Payables Negotiator agent | P2 | Hour 25 |
| Build Revenue Re-engagement agent (create-quote) | P2 | Hour 28 |
| Build action payload format for write-back | P1 | Hour 24 |
| Build simulated execution endpoint | P1 | Hour 28 |
| Build "Agents At Work" panel with typing/progress indicators | P3 | Hour 24 |
| Build Approval Panel UI | P3 | Hour 27 |
| Build "Cash Unlocked" counter with animation | P3 | Hour 30 |

**Exit Criteria:** "We can recommend, draft, and simulate actions — not just report."

### Phase 4: Execution + Production Readiness (Hours 30–40)
**Primary Owner: Person 1**

| Task | Owner | Deadline |
|------|-------|----------|
| Implement simulated write-back (create-credit-note, create-quote) | P1 | Hour 34 |
| Add idempotency keys to all write operations | P1 | Hour 36 |
| Add audit log / action history | P1 | Hour 38 |
| Add error handling and loading states | P3 | Hour 34 |
| Add post-execution impact visualization | P3 | Hour 36 |
| Polish scoring edge cases | P2 | Hour 34 |
| Add explanation layer ("Why this action?") | P2 | Hour 38 |
| End-to-end integration test | ALL | Hour 40 |

**Exit Criteria:** "We thought about reliability, safety, and real deployment."

### Phase 5: Demo + Submission (Hours 40–48)
**Primary Owner: Person 3**

| Task | Owner | Deadline |
|------|-------|----------|
| Final UI polish (colors, spacing, animations) | P3 | Hour 42 |
| Build demo flow script (exact click path) | P3 | Hour 43 |
| Create architecture diagram slide | P1 | Hour 42 |
| Create API usage summary | P1 | Hour 43 |
| Rehearse 3-minute pitch (3 full run-throughs) | ALL | Hour 45 |
| Record backup video demo | P3 | Hour 46 |
| Write submission copy | P3 | Hour 47 |
| Final deploy and smoke test | P1 | Hour 48 |

**Exit Criteria:** "Judges understand the product in under 30 seconds."

## Demo Script (3 Minutes)

**Minute 1 — The Problem:**
"Small businesses don't fail because they lack revenue. They fail because they lack liquidity. £26 billion is trapped in late invoices in the UK alone. And the tools they use? They show the problem after it's too late. Meet Xero Kinetic."

**Minute 2 — The Product:**
Live demo. Show the dashboard. Point to the 30-day gap. Show the agents identifying Customer A (£8,000 overdue, historically pays in 5 days). Show the negotiation draft. Click Approve. Show the Cash Unlocked counter tick up to £7,840. Then show the Revenue Lens — a lapsed customer worth £14,000/year gets a re-engagement quote drafted and ready to send.

**Minute 3 — The Architecture:**
"We use deterministic financial logic for risk identification and AI for explanation, prioritization, and negotiation drafting. That gives us both trustworthiness and actionability. Every action has guardrails, idempotency, and human approval. This isn't a chatbot. It's an autonomous treasury system."

## Key Lines for Judges

- **Differentiation:** "Most tools show business data after the fact. Xero Kinetic acts before liquidity problems become operational problems."
- **Architecture:** "We use deterministic financial logic for risk identification and AI for explanation, prioritization, and negotiation drafting."
- **Track Fit:** "This is built specifically for the Cash Flow Accelerator track because it turns Xero accounting data into immediate, measurable revenue and cash flow actions."

## Anti-Patterns (What NOT to Do)

- Do NOT build a chatbot interface
- Do NOT let AI invent financial risks (deterministic rules only)
- Do NOT over-engineer deployment (localhost is fine for demo)
- Do NOT chase more than 7 Xero API endpoints
- Do NOT build multiple pages (one dashboard, one approval flow)
- Do NOT skip the fallback demo dataset

## MVP Freeze Line

If time runs out, ship THIS and nothing more:
- ✅ Xero connection working
- ✅ Invoices + contacts + payables data normalized
- ✅ Liquidity gap detection
- ✅ At-risk invoice ranking
- ✅ Lapsed customer list
- ✅ Repeat buyer list
- ✅ AI draft for receivables negotiation
- ✅ One polished dashboard with Cash Unlocked counter
- ✅ Fallback demo data ready
