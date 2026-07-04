# UpFlow

UpFlow is a Xero-connected cash control room with:

- live Xero OAuth
- live invoice and contact sync
- fallback demo data
- summary, liquidity, at-risk, revenue, payables, and execution history APIs
- draft generation for receivables, payables, and re-engagement actions
- email reminders for receivables under 14 days overdue
- automated call reminders for receivables overdue by 15+ days
- simulated approval flow with idempotency

## Main backend routes

- `GET /api/health`
- `GET /api/summary`
- `GET /api/liquidity`
- `GET /api/invoices/at-risk`
- `GET /api/revenue-opportunities`
- `GET /api/payables/open`
- `GET /api/executions/history`
- `GET /api/xero/auth-url`
- `GET /api/xero/callback`
- `GET /api/sync/phase-one`
- `POST /api/agent/receivables-draft`
- `POST /api/agent/payables-draft`
- `POST /api/agent/reengagement-quote`
- `POST /api/communications/send-email`
- `POST /api/communications/place-call`
- `POST /api/simulate/execute`
- `POST /api/xero/disconnect`

## Local setup

1. Install backend dependencies:

```bash
pnpm install
```

2. Install frontend dependencies:

```bash
cd frontend
pnpm install
```

3. Create `.env` from `.env.example`.

4. Set these important values:

```env
PORT=3001
FRONTEND_APP_URL=http://localhost:8080
USE_XERO_FALLBACK=false
XERO_CLIENT_ID=your-client-id
XERO_CLIENT_SECRET=your-client-secret
XERO_REDIRECT_URI=http://localhost:3001/api/xero/callback
XERO_SCOPES=openid profile email offline_access accounting.transactions accounting.contacts accounting.settings accounting.reports.read
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

5. Start the backend from the repo root:

```bash
pnpm dev
```

6. Start the frontend from `frontend/`:

```bash
pnpm dev
```

## Xero app setup

In the Xero developer app:

- set the redirect URI to `http://localhost:3001/api/xero/callback`
- keep the client ID and client secret ready
- ensure the requested scopes match the backend config

## Notes

- OAuth success redirects to `FRONTEND_APP_URL/?xero=connected`
- fallback mode still works if live sync is unavailable
- draft generation is live
- reminder emails only send when SMTP is configured
- reminder calls only place when Twilio Voice is configured
- invoices under 14 days overdue are routed to email
- invoices overdue by 15 days or more are routed to voice
- invoices at exactly 14 days overdue remain a manual review lane for now

## External setup for live reminders

For email:

- use any SMTP provider such as Gmail SMTP, Outlook, SendGrid, or Mailgun
- fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`
- make sure the sender mailbox is allowed to send externally

For voice:

- create a Twilio account and buy or verify an outbound phone number
- fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`
- the current implementation uses Twilio REST API plus TwiML `<Say>` for a polite reminder script
- for richer live conversation later, switch the scripted call flow to Twilio ConversationRelay or another realtime voice stack
