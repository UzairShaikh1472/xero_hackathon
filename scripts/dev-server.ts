/**
 * Minimal JSON API for Person 3 / local demo.
 * Run: npm run dev
 *
 * GET  /api/liquidity
 * GET  /api/revenue-opportunities
 * GET  /api/invoices/at-risk
 * POST /api/agent/receivables-draft
 * POST /api/agent/payables-draft
 * POST /api/agent/reengagement-quote
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  err,
  getAtRiskInvoices,
  getLiquidity,
  getRevenueOpportunities,
  ok,
  postPayablesDraft,
  postReceivablesDraft,
  postReengagementQuote,
  type ApiResult,
} from "../src/handlers/index.js";

const PORT = Number(process.env.PORT) || 3001;

const server = createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname.replace(/\/$/, "") || "/";

  try {
    if (req.method === "GET" && path === "/api/liquidity") {
      return send(res, getLiquidity());
    }
    if (req.method === "GET" && path === "/api/revenue-opportunities") {
      return send(res, getRevenueOpportunities());
    }
    if (req.method === "GET" && path === "/api/invoices/at-risk") {
      return send(res, getAtRiskInvoices());
    }
    if (req.method === "POST" && path === "/api/agent/receivables-draft") {
      return send(res, await postReceivablesDraft(await readJson(req)));
    }
    if (req.method === "POST" && path === "/api/agent/payables-draft") {
      return send(res, await postPayablesDraft(await readJson(req)));
    }
    if (req.method === "POST" && path === "/api/agent/reengagement-quote") {
      return send(res, await postReengagementQuote(await readJson(req)));
    }
    if (req.method === "GET" && path === "/api/health") {
      return send(res, ok({ ok: true }));
    }

    send(res, err(404, `Not found: ${req.method} ${path}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message === "Invalid JSON body" ? 400 : 500;
    send(res, err(status, message));
  }
});

server.listen(PORT, () => {
  console.log(`Xero Kinetic API listening on http://localhost:${PORT}`);
  console.log("  GET  /api/liquidity");
  console.log("  GET  /api/revenue-opportunities");
  console.log("  GET  /api/invoices/at-risk");
  console.log("  POST /api/agent/receivables-draft");
  console.log("  POST /api/agent/payables-draft");
  console.log("  POST /api/agent/reengagement-quote");
});

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function send(res: ServerResponse, result: ApiResult<unknown>): void {
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Invalid JSON body");
  }
}
