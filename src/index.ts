import "dotenv/config";

import cors from "cors";
import express from "express";

import { env } from "./lib/config/env.js";
import { getBackendMode } from "./lib/config/runtime-mode.js";
import { logger } from "./lib/utils/logger.js";
import { apiRouter } from "./routes/api.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;

  const message =
    error instanceof Error ? error.message : "An unexpected backend error occurred";

  logger.error("server.request_failed", {
    statusCode,
    message
  });

  response.status(statusCode).json({
    ok: false,
    mode: getBackendMode(),
    generatedAt: new Date().toISOString(),
    data: {
      message
    }
  });
});

export default app;

if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    logger.info("server.started", {
      port: env.PORT,
      fallbackMode: env.USE_XERO_FALLBACK,
      nodeEnv: env.NODE_ENV
    });
  });
}
