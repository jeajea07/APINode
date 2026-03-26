"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const opossum_1 = __importDefault(require("opossum"));
const piscina_1 = __importDefault(require("piscina"));
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_1 = require("mongodb");
const node_stream_1 = require("node:stream");
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const Batch_1 = require("../models/Batch");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const redis_1 = require("../config/redis");
const database_1 = require("../config/database");
const Document_1 = require("../models/Document");
const prometheus_1 = require("../config/prometheus");
const QUEUE_NAME = "pdf-generation";
const TOTAL_JOBS_PER_BATCH = 1000;
const doneJobsByBatchId = new Map();
const processingStartedByBatchId = new Set();
const batchStartedAtByBatchId = new Map();
const completedBatches = new Set();
const failedBatches = new Set();
let gridFsBucket = null;
let pdfPiscina = null;
/**
 * Gestion de MongoDB et Circuit Breaker
 */
const mongoUpdateBreaker = new opossum_1.default(async (args) => {
    try {
        await Batch_1.BatchModel.updateOne({ _id: args.batchId }, { $set: { status: args.status } });
    }
    catch (err) {
        logger_1.logger.error("MongoDB update error", { message: err?.message });
        throw err;
    }
}, {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 15000
});
async function safeUpdateBatchStatusProcessing(batchId) {
    await mongoUpdateBreaker.fire({ batchId, status: "processing" }).catch(() => { });
}
async function updateBatchStatusCompleted(batchId) {
    await mongoUpdateBreaker.fire({ batchId, status: "completed" });
}
async function updateBatchStatusFailed(batchId) {
    await mongoUpdateBreaker.fire({ batchId, status: "failed" });
}
let worker = null;
async function uploadPdfBufferToGridFS(buffer, filename) {
    if (!gridFsBucket)
        throw new Error("GridFSBucket is not initialized");
    const uploadStream = gridFsBucket.openUploadStream(filename, {
        contentType: "application/pdf"
    });
    await new Promise((resolve, reject) => {
        uploadStream.on("finish", () => resolve());
        uploadStream.on("error", (err) => reject(err));
        // Important: `Buffer` is iterable => `Readable.from(buffer)` emits numbers (bytes).
        // GridFS expects Buffer/Uint8Array chunks, so we emit the whole buffer as one chunk.
        node_stream_1.Readable.from([buffer]).pipe(uploadStream);
    });
    return uploadStream.id;
}
async function incrementBatchDoneAndMaybeFinalize(batchId) {
    const nextDone = (doneJobsByBatchId.get(batchId) ?? 0) + 1;
    doneJobsByBatchId.set(batchId, nextDone);
    if (nextDone >= TOTAL_JOBS_PER_BATCH && !completedBatches.has(batchId)) {
        completedBatches.add(batchId);
        if (failedBatches.has(batchId)) {
            const startedAt = batchStartedAtByBatchId.get(batchId);
            if (typeof startedAt === "number") {
                prometheus_1.batchProcessingDurationSeconds.observe((Date.now() - startedAt) / 1000);
            }
            batchStartedAtByBatchId.delete(batchId);
            await updateBatchStatusFailed(batchId);
            return;
        }
        {
            const startedAt = batchStartedAtByBatchId.get(batchId);
            if (typeof startedAt === "number") {
                prometheus_1.batchProcessingDurationSeconds.observe((Date.now() - startedAt) / 1000);
            }
            batchStartedAtByBatchId.delete(batchId);
        }
        await updateBatchStatusCompleted(batchId);
    }
}
async function initWorker() {
    await (0, database_1.connectDatabase)();
    if (!mongoose_1.default.connection.db) {
        throw new Error("MongoDB connection not ready");
    }
    gridFsBucket = new mongodb_1.GridFSBucket(mongoose_1.default.connection.db);
    const workerPathJs = node_path_1.default.resolve(__dirname, "pdf.worker.js");
    const workerPathTs = node_path_1.default.resolve(__dirname, "pdf.worker.ts");
    const filename = node_fs_1.default.existsSync(workerPathJs) ? workerPathJs : workerPathTs;
    const execArgv = filename === workerPathTs && !node_fs_1.default.existsSync(workerPathJs) ? ["-r", "ts-node/register"] : undefined;
    const maxThreads = Number(process.env.PDF_PISCINA_MAX_THREADS ?? node_os_1.default.cpus().length);
    const minThreads = Number(process.env.PDF_PISCINA_MIN_THREADS ?? 1);
    pdfPiscina = new piscina_1.default({
        filename,
        minThreads,
        maxThreads: Number.isFinite(maxThreads) ? maxThreads : node_os_1.default.cpus().length,
        ...(execArgv ? { execArgv } : {})
    });
    worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { userId, batchId, documentId } = job.data;
        if (!processingStartedByBatchId.has(batchId)) {
            processingStartedByBatchId.add(batchId);
            batchStartedAtByBatchId.set(batchId, Date.now());
            await safeUpdateBatchStatusProcessing(batchId);
        }
        await Document_1.DocumentModel.updateOne({ _id: documentId }, { $set: { status: "processing", errorMessage: null } });
        const startedAt = Date.now();
        try {
            const cleanUserId = userId.replace(/^(?:user_)+/, "");
            const filename = `${env_1.ENV.PDF.PREFIX}${cleanUserId}_${documentId}.pdf`;
            // Génération en thread Piscina (évite de bloquer l'Event Loop).
            const task = { userId };
            if (!pdfPiscina)
                throw new Error("Piscina pool not initialized");
            const workerResult = (await pdfPiscina.run(task));
            const pdfBuffer = Buffer.isBuffer(workerResult)
                ? workerResult
                : Buffer.from(workerResult);
            // Upload GridFS en mode stream.
            const gridfsFileId = await uploadPdfBufferToGridFS(pdfBuffer, filename);
            prometheus_1.pdfGenerationDurationSeconds.observe((Date.now() - startedAt) / 1000);
            const generationTimeMs = Date.now() - startedAt;
            const retryCount = Math.max(job.attemptsMade - 1, 0);
            await Document_1.DocumentModel.updateOne({ _id: documentId }, {
                $set: {
                    status: "completed",
                    gridfsFileId,
                    generationTimeMs,
                    retryCount,
                    errorMessage: null
                }
            });
            await incrementBatchDoneAndMaybeFinalize(batchId);
            prometheus_1.documentsGeneratedTotal.inc({ status: "success" });
            return { userId, batchId, documentId };
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const attemptsMade = job.attemptsMade;
            const retryCount = Math.max(attemptsMade - 1, 0);
            await Document_1.DocumentModel.updateOne({ _id: documentId }, {
                $set: {
                    status: "failed",
                    retryCount,
                    generationTimeMs: null,
                    errorMessage: errMsg
                }
            });
            const maxAttempts = job.opts.attempts ?? 1;
            const isLastAttempt = attemptsMade >= maxAttempts;
            if (isLastAttempt) {
                prometheus_1.pdfGenerationDurationSeconds.observe((Date.now() - startedAt) / 1000);
                failedBatches.add(batchId);
                await incrementBatchDoneAndMaybeFinalize(batchId);
                prometheus_1.documentsGeneratedTotal.inc({ status: "failed" });
            }
            else {
                // Tentative intermédiaire: on collecte quand même la durée.
                prometheus_1.pdfGenerationDurationSeconds.observe((Date.now() - startedAt) / 1000);
            }
            throw err;
        }
    }, {
        connection: redis_1.redisConnection,
        concurrency: 50
    });
    worker.on("completed", (job) => {
        logger_1.logger.info("BullMQ job completed", { jobId: job.id });
    });
    worker.on("failed", (job, err) => {
        logger_1.logger.error("BullMQ job failed", { jobId: job?.id, message: err?.message });
    });
}
async function shutdown() {
    try {
        await worker?.close();
    }
    finally {
        if (pdfPiscina) {
            await pdfPiscina.close().catch(() => { });
            pdfPiscina = null;
        }
        await (0, database_1.disconnectDatabase)().catch(() => { });
    }
}
void initWorker().catch((err) => {
    logger_1.logger.error("Worker init failed", { message: err instanceof Error ? err.message : String(err) });
    process.exit(1);
});
process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
});
//# sourceMappingURL=documentWorker.js.map