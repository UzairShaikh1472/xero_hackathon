# Xero Kinetic Backend

Phase 1 backend foundation for the `Person 1: Xero + Backend + Execution Owner` track.

## What is already working

- Express + TypeScript backend scaffold
- Structured API envelope format
- Xero OAuth URL generation
- Xero callback handling
- In-memory token and tenant session store
- Phase 1 sync route for invoices and contacts
- Seeded fallback mode for demo safety

## Current endpoints

- `GET /api/health`
- `GET /api/xero/auth-url`
- `GET /api/xero/callback`
- `GET /api/sync/phase-one`
- `POST /api/xero/disconnect`

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a local env file:

```bash
copy .env.example .env
```

3. Fill in the Xero values in `.env`.

4. Start the backend:

```bash
pnpm dev
```

The backend runs on `http://localhost:3001` by default.

## Required Xero env values

```env
PORT=3001
NODE_ENV=development
USE_XERO_FALLBACK=false
XERO_STATE_SALT=replace-this-with-a-random-secret
XERO_CLIENT_ID=your-client-id
XERO_CLIENT_SECRET=your-client-secret
XERO_REDIRECT_URI=http://localhost:3001/api/xero/callback
XERO_SCOPES=openid profile email offline_access accounting.invoices accounting.contacts accounting.settings
```

## Xero app setup

In the Xero developer app:

- create an app
- set the redirect URI to `http://localhost:3001/api/xero/callback`
- keep the client ID and client secret ready
- connect a demo or real tenant

## Live connection flow

1. Set `USE_XERO_FALLBACK=false`
2. Start the backend
3. Open:

```txt
http://localhost:3001/api/xero/auth-url
```

4. Copy the returned `authUrl` into the browser and complete Xero login
5. Xero redirects back to `/api/xero/callback`
6. Then open:

```txt
http://localhost:3001/api/sync/phase-one
```

If live auth or fetch fails, switch fallback back on:

```env
USE_XERO_FALLBACK=true
```

## Phase 1 goal

Phase 1 is done when:

- auth flow works
- invoices fetch
- contacts fetch
- fallback route still works
- structured response contracts stay stable

## Important limitation right now

The session store is currently in-memory only.

That is fine for hackathon bring-up, but if the server restarts:

- access tokens are lost
- tenant selection is lost
- last sync state is lost

Next step after Phase 1 is to add:

- refresh token handling
- persistent session storage
- summary/liquidity endpoints
- richer normalization for contacts and invoice metrics
