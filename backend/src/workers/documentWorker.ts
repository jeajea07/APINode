import { Worker } from "bullmq";
import CircuitBreaker from "opossum";
import Piscina from "piscina";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { Readable } from "node:stream";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { BatchModel } from "../models/Batch";
import { ENV } from "../config/env";
import { logger } from "../config/logger";
import { redisConnection } from "../config/redis";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { DocumentModel } from "../models/Document";
import type { PdfWorkerTaskData } from "./pdf.worker";
import {
  batchProcessingDurationSeconds,
  documentsGeneratedTotal,
  pdfGenerationDurationSeconds
} from "../config/prometheus";

type DocumentJobData = {
  userId: string;
  batchId: string;
  documentId: string;
};

const QUEUE_NAME = "pdf-generation";
const TOTAL_JOBS_PER_BATCH = 1000;

const doneJobsByBatchId = new Map<string, number>();
const processingStartedByBatchId = new Set<string>();
const batchStartedAtByBatchId = new Map<string, number>();
const completedBatches = new Set<string>();
const failedBatches = new Set<string>();
let gridFsBucket: GridFSBucket | null = null;
let pdfPiscina: Piscina | null = null;

/**
 * Gestion de MongoDB et Circuit Breaker
 */
const mongoUpdateBreaker = new CircuitBreaker(
  async (args: { batchId: string; status: "processing" | "completed" | "failed" }) => {
    try {
      await BatchModel.updateOne({ _id: args.batchId }, { $set: { status: args.status } });
    } catch (err: any) {
      logger.error("MongoDB update error", { message: err?.message });
      throw err;
    }
  },
  {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 15000
  }
);

async function safeUpdateBatchStatusProcessing(batchId: string): Promise<void> {
  await mongoUpdateBreaker.fire({ batchId, status: "processing" }).catch(() => {});
}

async function updateBatchStatusCompleted(batchId: string): Promise<void> {
  await mongoUpdateBreaker.fire({ batchId, status: "completed" });
}

async function updateBatchStatusFailed(batchId: string): Promise<void> {
  await mongoUpdateBreaker.fire({ batchId, status: "failed" });
}

let worker: Worker<DocumentJobData> | null = null;

async function uploadPdfBufferToGridFS(buffer: Buffer, filename: string): Promise<mongoose.Types.ObjectId> {
  if (!gridFsBucket) throw new Error("GridFSBucket is not initialized");

  const uploadStream = gridFsBucket.openUploadStream(filename, {
    contentType: "application/pdf"
  });

  await new Promise<void>((resolve, reject) => {
    uploadStream.on("finish", () => resolve());
    uploadStream.on("error", (err) => reject(err));
    // Important: `Buffer` is iterable => `Readable.from(buffer)` emits numbers (bytes).
    // GridFS expects Buffer/Uint8Array chunks, so we emit the whole buffer as one chunk.
    Readable.from([buffer]).pipe(uploadStream);
  });

  return uploadStream.id as mongoose.Types.ObjectId;
}

async function incrementBatchDoneAndMaybeFinalize(batchId: string): Promise<void> {
  const nextDone = (doneJobsByBatchId.get(batchId) ?? 0) + 1;
  doneJobsByBatchId.set(batchId, nextDone);

  if (nextDone >= TOTAL_JOBS_PER_BATCH && !completedBatches.has(batchId)) {
    completedBatches.add(batchId);
    if (failedBatches.has(batchId)) {
      const startedAt = batchStartedAtByBatchId.get(batchId);
      if (typeof startedAt === "number") {
        batchProcessingDurationSeconds.observe((Date.now() - startedAt) / 1000);
      }
      batchStartedAtByBatchId.delete(batchId);
      await updateBatchStatusFailed(batchId);
      return;
    }
    {
      const startedAt = batchStartedAtByBatchId.get(batchId);
      if (typeof startedAt === "number") {
        batchProcessingDurationSeconds.observe((Date.now() - startedAt) / 1000);
      }
      batchStartedAtByBatchId.delete(batchId);
    }
    await updateBatchStatusCompleted(batchId);
  }
}

async function initWorker(): Promise<void> {
  await connectDatabase();

  if (!mongoose.connection.db) {
    throw new Error("MongoDB connection not ready");
  }
  gridFsBucket = new GridFSBucket(mongoose.connection.db);

  const workerPathJs = path.resolve(__dirname, "pdf.worker.js");
  const workerPathTs = path.resolve(__dirname, "pdf.worker.ts");
  const filename = fs.existsSync(workerPathJs) ? workerPathJs : workerPathTs;
  const execArgv =
    filename === workerPathTs && !fs.existsSync(workerPathJs) ? ["-r", "ts-node/register"] : undefined;

  const maxThreads = Number(process.env.PDF_PISCINA_MAX_THREADS ?? os.cpus().length);
  const minThreads = Number(process.env.PDF_PISCINA_MIN_THREADS ?? 1);

  pdfPiscina = new Piscina({
    filename,
    minThreads,
    maxThreads: Number.isFinite(maxThreads) ? maxThreads : os.cpus().length,
    ...(execArgv ? { execArgv } : {})
  });

  worker = new Worker<DocumentJobData>(
    QUEUE_NAME,
    async (job) => {
      const { userId, batchId, documentId } = job.data;

      if (!processingStartedByBatchId.has(batchId)) {
        processingStartedByBatchId.add(batchId);
        batchStartedAtByBatchId.set(batchId, Date.now());
        await safeUpdateBatchStatusProcessing(batchId);
      }

      await DocumentModel.updateOne(
        { _id: documentId },
        { $set: { status: "processing", errorMessage: null } }
      );

      const startedAt = Date.now();
      try {
        const cleanUserId = userId.replace(/^(?:user_)+/, "");
        const filename = `${ENV.PDF.PREFIX}${cleanUserId}_${documentId}.pdf`;

        // Génération en thread Piscina (évite de bloquer l'Event Loop).
        const task: PdfWorkerTaskData = { userId };
        if (!pdfPiscina) throw new Error("Piscina pool not initialized");
        const workerResult = (await pdfPiscina.run(task)) as unknown;
        const pdfBuffer = Buffer.isBuffer(workerResult)
          ? workerResult
          : Buffer.from(workerResult as Uint8Array);

        // Upload GridFS en mode stream.
        const gridfsFileId = await uploadPdfBufferToGridFS(pdfBuffer, filename);

        pdfGenerationDurationSeconds.observe((Date.now() - startedAt) / 1000);

        const generationTimeMs = Date.now() - startedAt;
        const retryCount = Math.max(job.attemptsMade - 1, 0);
        await DocumentModel.updateOne(
          { _id: documentId },
          {
            $set: {
              status: "completed",
              gridfsFileId,
              generationTimeMs,
              retryCount,
              errorMessage: null
            }
          }
        );

        await incrementBatchDoneAndMaybeFinalize(batchId);
        documentsGeneratedTotal.inc({ status: "success" });
        return { userId, batchId, documentId };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const attemptsMade = job.attemptsMade;
        const retryCount = Math.max(attemptsMade - 1, 0);
        await DocumentModel.updateOne(
          { _id: documentId },
          {
            $set: {
              status: "failed",
              retryCount,
              generationTimeMs: null,
              errorMessage: errMsg
            }
          }
        );

        const maxAttempts = job.opts.attempts ?? 1;
        const isLastAttempt = attemptsMade >= maxAttempts;
        if (isLastAttempt) {
          pdfGenerationDurationSeconds.observe((Date.now() - startedAt) / 1000);
          failedBatches.add(batchId);
          await incrementBatchDoneAndMaybeFinalize(batchId);
          documentsGeneratedTotal.inc({ status: "failed" });
        } else {
          // Tentative intermédiaire: on collecte quand même la durée.
          pdfGenerationDurationSeconds.observe((Date.now() - startedAt) / 1000);
        }

        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency: 50
    }
  );

  worker.on("completed", (job) => {
    logger.info("BullMQ job completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error("BullMQ job failed", { jobId: job?.id, message: err?.message });
  });
}

async function shutdown(): Promise<void> {
  try {
    await worker?.close();
  } finally {
    if (pdfPiscina) {
      await pdfPiscina.close().catch(() => {});
      pdfPiscina = null;
    }
    await disconnectDatabase().catch(() => {});
  }
}

void initWorker().catch((err) => {
  logger.error("Worker init failed", { message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});