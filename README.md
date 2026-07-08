# UpFlow

UpFlow is a Xero-connected cash control room designed to help teams monitor cash position, track risk, and automate follow-up actions from a single workflow.

## Highlights

- Xero OAuth integration for live account connectivity
- Invoice and contact synchronization with fallback demo data
- Liquidity, at-risk invoices, revenue opportunity, payables, and execution history endpoints
- Draft generation for receivables, payables, and re-engagement actions
- Automated email reminders for receivables under 14 days overdue
- Automated call reminders for receivables overdue by 15+ days
- Simulated approval flow with idempotent execution support

## Core API Routes

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

## Tech Stack

### Backend

- Node.js
- TypeScript
- Express
- OpenAI SDK
- Google Generative AI SDK
- Nodemailer
- Zod

### Frontend

- React
- Vite
- TypeScript
- TanStack Router
- Tailwind CSS
- Radix UI

## Local Setup

1. Install backend dependencies from the repository root.
2. Install frontend dependencies from the `frontend` directory.
3. Create a `.env` file from `.env.example`.
4. Add the required Xero, SMTP, and Twilio configuration values.
5. Start the backend from the repository root.
6. Start the frontend from the `frontend/` directory.

## Environment Notes

Important values include:

- `PORT`
- `FRONTEND_APP_URL`
- `USE_XERO_FALLBACK`
- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`
- `XERO_REDIRECT_URI`
- `XERO_SCOPES`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

## Xero App Setup

In the Xero developer dashboard:

- set the redirect URI to `http://localhost:3001/api/xero/callback`
- keep the client ID and client secret available for local configuration
- ensure the requested scopes match the backend configuration

## Behavior Notes

- OAuth success redirects to `FRONTEND_APP_URL/?xero=connected`
- fallback mode remains usable if live sync is unavailable
- reminder emails require SMTP configuration
- reminder calls require Twilio Voice configuration
- invoices under 14 days overdue are routed to email
- invoices overdue by 15 days or more are routed to voice
- invoices at exactly 14 days overdue remain in a manual review lane

## Status

This repository represents a functional hackathon-style product prototype with real integration points, automated workflows, and a clear path toward production hardening.
