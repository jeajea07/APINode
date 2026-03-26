"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const mongoose_1 = __importDefault(require("mongoose"));
const promClient = __importStar(require("prom-client"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const database_1 = require("./config/database");
const redisHealth_1 = require("./config/redisHealth");
const redis_1 = require("./config/redis");
const batchController_1 = require("./controllers/batchController");
const documentQueue_1 = require("./queues/documentQueue");
const logger_1 = require("./config/logger");
const prometheus_1 = require("./config/prometheus");
const swagger_1 = require("./swagger");
dotenv_1.default.config();
const PORT = Number(process.env.PORT ?? 3000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:8080";
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: FRONTEND_ORIGIN
}));
app.use(express_1.default.json());
app.use((0, helmet_1.default)());
app.use((0, express_rate_limit_1.default)({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 200),
    standardHeaders: "draft-7",
    legacyHeaders: false
}));
promClient.collectDefaultMetrics();
app.get("/health", async (_req, res) => {
    try {
        const mongoOk = mongoose_1.default.connection.readyState === 1 && Boolean(mongoose_1.default.connection.db);
        const redisOk = await (0, redisHealth_1.checkRedisConnection)();
        const ok = mongoOk && redisOk;
        res.status(ok ? 200 : 503).json({
            status: ok ? "ok" : "degraded",
            mongo: { ok: mongoOk, readyState: mongoose_1.default.connection.readyState },
            redis: { ok: redisOk }
        });
    }
    catch {
        res.status(503).json({ status: "degraded" });
    }
});
app.get("/metrics", async (_req, res) => {
    res.setHeader("Content-Type", prometheus_1.register.contentType);
    res.end(await prometheus_1.register.metrics());
});
app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.openApiSpec));
app.use(batchController_1.batchRouter);
let server = null;
let isShuttingDown = false;
async function gracefulShutdown(signal) {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    try {
        if (server) {
            await new Promise((resolve) => {
                server?.close(() => resolve());
            });
        }
    }
    catch {
        // ignore shutdown errors
    }
    // Close Redis connection used by BullMQ
    try {
        await documentQueue_1.documentQueue.close();
    }
    catch {
        // ignore shutdown errors
    }
    await (0, redisHealth_1.closeRedisHealthClient)().catch(() => { });
    (0, prometheus_1.stopQueueSizeGauge)();
    // Close MongoDB connection
    try {
        await (0, database_1.disconnectDatabase)();
    }
    catch {
        // ignore shutdown errors
    }
    logger_1.logger.info("Shutdown complete", { signal });
    process.exit(0);
}
async function start() {
    await (0, database_1.connectDatabase)();
    // Ensure Redis config is valid at startup (number parsing, etc.)
    if (!redis_1.redisConnection.host || Number.isNaN(redis_1.redisConnection.port)) {
        throw new Error("Invalid Redis connection configuration");
    }
    server = app.listen(PORT, () => {
        logger_1.logger.info("Server listening", { port: PORT });
    });
    // Prometheus custom queue size gauge.
    (0, prometheus_1.startQueueSizeGauge)(documentQueue_1.documentQueue);
}
void start();
process.once("SIGTERM", () => {
    void gracefulShutdown("SIGTERM");
});
//# sourceMappingURL=app.js.map