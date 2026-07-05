import { Router } from "express";

import { env } from "../lib/config/env.js";
import {
  buildPayablesDraftResponse,
  buildReceivablesDraftResponse,
  buildReceivablesDraftsListResponse,
  buildReengagementDraftsListResponse,
  buildReengagementQuoteResponse,
  buildSimulationExecuteResponse
} from "../lib/services/action-service.js";
import {
  buildCreateVoiceSessionResponse,
  buildPlaceDraftCallResponse,
  buildSendDraftEmailResponse,
  buildSendVoiceInviteResponse
} from "../lib/services/communications-service.js";
import { buildDemoNarrationResponse } from "../lib/services/demo-narration-service.js";
import { buildExecutionHistoryResponse } from "../lib/services/execution-history-service.js";
import { buildFollowUpsResponse } from "../lib/services/resolved-actions-service.js";
import { buildHealthResponse } from "../lib/services/health-service.js";
import { buildInvoiceRiskResponse } from "../lib/services/invoice-risk-service.js";
import { buildLiquidityResponse } from "../lib/services/liquidity-service.js";
import { buildOpenPayablesResponse } from "../lib/services/payables-service.js";
import { clearSnapshotCache, getPhaseOneSnapshot, getPhaseOneSnapshotData, handleOAuthCallback } from "../lib/services/phase-one-sync-service.js";
import { buildVoiceChatResponse } from "../lib/services/voice-chat-service.js";
import { buildVoiceCallCompleteResponse } from "../lib/services/voice-call-report-service.js";
import { buildVoiceTtsResponse } from "../lib/services/elevenlabs-tts-service.js";
import { buildVoiceSessionContext } from "../lib/services/voice-session-service.js";
import { buildRevenueOpportunitiesResponse } from "../lib/services/revenue-opportunities-service.js";
import { buildSummaryResponse } from "../lib/services/summary-service.js";
import { getBackendMode } from "../lib/config/runtime-mode.js";
import { isXeroConfigured } from "../lib/config/xero-config.js";
import { buildAuthUrl } from "../lib/xero/auth.js";
import { clearTokenSet } from "../lib/xero/session-store.js";
import { HttpError } from "../lib/utils/http-error.js";
import { isValidOAuthState } from "../lib/xero/state.js";

export const apiRouter = Router();

apiRouter.get("/health", async (_request, response) => {
  const payload = await buildHealthResponse();
  response.json(payload);
});

apiRouter.get("/summary", async (_request, response, next) => {
  try {
    const payload = await buildSummaryResponse();
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/liquidity", async (_request, response, next) => {
  try {
    const payload = await buildLiquidityResponse();
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/revenue-opportunities", async (_request, response, next) => {
  try {
    const payload = await buildRevenueOpportunitiesResponse();
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/invoices/at-risk", async (_request, response, next) => {
  try {
    const payload = await buildInvoiceRiskResponse();
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/payables/open", async (_request, response, next) => {
  try {
    const payload = await buildOpenPayablesResponse();
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/executions/history", async (_request, response, next) => {
  try {
    const payload = await buildExecutionHistoryResponse();
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/actions/follow-ups", async (_request, response, next) => {
  try {
    const payload = await buildFollowUpsResponse();
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/xero/auth-url", (_request, response) => {
  if (!isXeroConfigured()) {
    return response.status(503).json({
      ok: false,
      mode: "fallback",
      generatedAt: new Date().toISOString(),
      data: {
        message:
          "Xero not configured. Set XERO_CLIENT_ID and XERO_CLIENT_SECRET in .env, then restart the backend."
      }
    });
  }

  response.json({
    ok: true,
    mode: getBackendMode(),
    generatedAt: new Date().toISOString(),
    data: {
      authUrl: buildAuthUrl()
    }
  });
});

apiRouter.get("/xero/callback", async (request, response, next) => {
  try {
    const code = String(request.query.code ?? "");
    const state = String(request.query.state ?? "");

    if (!code) {
      throw new HttpError(400, "Missing Xero authorization code");
    }

    if (!state || !isValidOAuthState(state)) {
      throw new HttpError(400, "Invalid Xero OAuth state");
    }

    await handleOAuthCallback(code);
    clearSnapshotCache();

    response.redirect(`${env.FRONTEND_APP_URL.replace(/\/$/, "")}/?xero=connected`);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/sync/phase-one", async (_request, response, next) => {
  try {
    const payload = await getPhaseOneSnapshot();
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/agent/receivables-drafts", async (request, response, next) => {
  try {
    const fast = request.query.fast === "1" || request.query.fast === "true";
    const payload = await buildReceivablesDraftsListResponse({ fast });
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/agent/reengagement-drafts", async (request, response, next) => {
  try {
    const fast = request.query.fast === "1" || request.query.fast === "true";
    const payload = await buildReengagementDraftsListResponse({ fast });
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/agent/receivables-draft", async (request, response, next) => {
  try {
    const payload = await buildReceivablesDraftResponse(request.body);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/agent/payables-draft", async (request, response, next) => {
  try {
    const payload = await buildPayablesDraftResponse(request.body);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/agent/reengagement-quote", async (request, response, next) => {
  try {
    const payload = await buildReengagementQuoteResponse(request.body);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/simulate/execute", async (request, response, next) => {
  try {
    const payload = await buildSimulationExecuteResponse(request.body);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/communications/send-email", async (request, response, next) => {
  try {
    const payload = await buildSendDraftEmailResponse(request.body);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/communications/send-voice-invite", async (request, response, next) => {
  try {
    const payload = await buildSendVoiceInviteResponse(request.body);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/communications/place-call", async (request, response, next) => {
  try {
    const payload = await buildPlaceDraftCallResponse(request.body);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/voice/sessions", async (request, response, next) => {
  try {
    const draftId = String(request.body?.draftId ?? "").trim();
    const invoiceId = String(request.body?.invoiceId ?? "").trim() || undefined;
    const payload = await buildCreateVoiceSessionResponse(draftId, invoiceId);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/voice/sessions/:token", async (request, response, next) => {
  try {
    const token = String(request.params.token ?? "").trim();
    const snapshot = await getPhaseOneSnapshotData();
    response.json({
      ok: true,
      mode: snapshot.sync.source,
      generatedAt: new Date().toISOString(),
      data: buildVoiceSessionContext(token)
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/voice/chat", async (request, response, next) => {
  try {
    const payload = await buildVoiceChatResponse(request.body);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/demo/narration", async (request, response, next) => {
  try {
    const payload = await buildDemoNarrationResponse(request.body);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/voice/tts", async (request, response, next) => {
  try {
    const payload = await buildVoiceTtsResponse(request.body ?? {});
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/voice/calls/complete", async (request, response, next) => {
  try {
    const payload = await buildVoiceCallCompleteResponse(request.body);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/xero/disconnect", (_request, response) => {
  clearTokenSet();
  clearSnapshotCache();
  response.json({
    ok: true,
    mode: getBackendMode(),
    generatedAt: new Date().toISOString(),
    data: {
      disconnected: true
    }
  });
});
