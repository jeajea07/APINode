import express from "express";
import cors from "cors";

import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import * as promClient from "prom-client";
import swaggerUi from "swagger-ui-express";

import { disconnectDatabase, connectDatabase } from "./config/database";
import { checkRedisConnection, closeRedisHealthClient } from "./config/redisHealth";
import { redisConnection } from "./config/redis";
import { batchRouter } from "./controllers/batchController";
import { documentQueue } from "./queues/documentQueue";
import { logger } from "./config/logger";
import { register, startQueueSizeGauge, stopQueueSizeGauge } from "./config/prometheus";
import { openApiSpec } from "./swagger";
import { ENV } from "./config/env";

const PORT = ENV.PORT;
const FRONTEND_ORIGIN = ENV.FRONTEND_ORIGIN;

const app = express();
app.use(
  cors({
    origin: FRONTEND_ORIGIN
  })
);
app.use(express.json());

app.use(helmet());
app.use(
  rateLimit({
    windowMs: ENV.RATE_LIMIT_WINDOW_MS,
    max: ENV.RATE_LIMIT_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

promClient.collectDefaultMetrics();

app.get("/health", async (_req, res) => {
  try {
    const mongoOk = mongoose.connection.readyState === 1 && Boolean(mongoose.connection.db);
    const redisOk = await checkRedisConnection();
    const ok = mongoOk && redisOk;
    res.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      mongo: { ok: mongoOk, readyState: mongoose.connection.readyState },
      redis: { ok: redisOk }
    });
  } catch {
    res.status(503).json({ status: "degraded" });
  }
});

app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use(batchRouter);

let server: ReturnType<typeof app.listen> | null = null;
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    if (server) {
      await new Promise<void>((resolve) => {
        server?.close(() => resolve());
      });
    }
  } catch {
    // ignore shutdown errors
  }

  // Close Redis connection used by BullMQ
  try {
    await documentQueue.close();
  } catch {
    // ignore shutdown errors
  }

  await closeRedisHealthClient().catch(() => {});
  stopQueueSizeGauge();

  // Close MongoDB connection
  try {
    await disconnectDatabase();
  } catch {
    // ignore shutdown errors
  }

  logger.info("Shutdown complete", { signal });
  process.exit(0);
}

async function start(): Promise<void> {
  await connectDatabase();

  // Ensure Redis config is valid at startup (number parsing, etc.)
  if (!redisConnection.host || Number.isNaN(redisConnection.port)) {
    throw new Error("Invalid Redis connection configuration");
  }

  server = app.listen(PORT, () => {
    logger.info("Server listening", { port: PORT });
  });

  // Prometheus custom queue size gauge.
  startQueueSizeGauge(documentQueue);
}

void start();

process.once("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

