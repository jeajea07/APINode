import { Types } from "mongoose";
import crypto from "node:crypto";

import { BatchModel } from "../models/Batch";
import { DocumentModel } from "../models/Document";
import { createQueue } from "../infrastructure/queue/queueFactory";
import { batchProcessingDurationSeconds } from "../config/prometheus";

export async function createBatch(userIds: string[]): Promise<string> {
  const batch = await BatchModel.create({
    status: "pending",
    totalDocuments: userIds.length
  });

  const batchId = (batch._id as Types.ObjectId).toString();

  // Crée les documents d'abord, puis ajoute les jobs BullMQ.
  const documents = (await DocumentModel.insertMany(
    userIds.map((userId) => ({
      documentId: crypto.randomUUID(),
      userId,
      batchId: batch._id,
      status: "pending",
      retryCount: 0,
      gridfsFileId: null,
      errorMessage: null,
      generationTimeMs: null,
      fileSize: null
    }))
  )) as unknown as Array<{ documentId: string; userId: string }>;

  const queue = await createQueue();
  await queue.addBulk(
    documents.map((doc) => ({
      name: "generate-pdf",
      data: { userId: doc.userId, batchId, documentId: doc.documentId }
    }))
  );

  return batchId;
}

export async function updateBatchProgress(batchId: string, isSuccess: boolean): Promise<void> {
  const updated = (await BatchModel.findOneAndUpdate(
    { _id: batchId },
    {
      $inc: { [isSuccess ? "processedCount" : "failedCount"]: 1 },
      $set: { status: "processing" }
    },
    { new: true }
  )) as unknown as
    | {
        processedCount: number;
        failedCount: number;
        totalDocuments: number;
        createdAt: Date;
      }
    | null;

  if (!updated) return;

  const processedCount = updated.processedCount;
  const failedCount = updated.failedCount;
  const totalDocuments = updated.totalDocuments;

  if (processedCount + failedCount >= totalDocuments) {
    const finalStatus =
      failedCount === totalDocuments ? "failed" : "completed";
    const completedAt = new Date();
    await BatchModel.findOneAndUpdate(
      { _id: batchId },
      { $set: { status: finalStatus, completedAt } }
    );

    const createdAt = updated.createdAt instanceof Date ? updated.createdAt : new Date(updated.createdAt);
    batchProcessingDurationSeconds.observe(
      (completedAt.getTime() - createdAt.getTime()) / 1000
    );
  }
}

export async function processBatch(userIds: string[]): Promise<string> {
  return createBatch(userIds);
}
