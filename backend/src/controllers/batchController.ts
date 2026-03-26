import { Router } from "express";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";

import { BatchModel } from "../models/Batch";
import { DocumentModel } from "../models/Document";
import { createQueue } from "../infrastructure/queue/queueFactory";
import { validateBatchIds } from "../utils/validation";
import { ENV } from "../config/env";

export const batchRouter = Router();

batchRouter.post("/api/documents/batch", async (req, res) => {
  const validation = validateBatchIds(req.body, {
    min: ENV.BATCH.MIN,
    max: ENV.BATCH.MAX,
  });
  if (!validation.ok) {
    const { error, received } = validation;
    return res.status(400).json(received ? { error, received } : { error });
  }
  const ids = validation.ids;

  try {
    const batch = await BatchModel.create({
      status: "pending"
    });

    const batchId = batch._id.toString();

    // 1) Crée d'abord les entrées Document, puis seulement ensuite les jobs BullMQ.
    const documents = await DocumentModel.insertMany(
      ids.map((userId) => ({
        userId,
        batchId: batch._id,
        status: "pending",
        retryCount: 0,
        gridfsFileId: null,
        errorMessage: null,
        generationTimeMs: null
      }))
    );

    const queue = await createQueue();

    // 2) Ajoute les jobs avec l'identifiant de document correspondant.
    await queue.addBulk(
      documents.map((doc, idx) => {
        const userId = ids[idx]!;
        return {
          name: "generate-pdf",
          data: { userId, batchId, documentId: doc._id.toString() }
        };
      })
    );

    return res.status(202).json({
      batchId,
      message: "Batch created and processing has started"
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process batch" });
  }
});

batchRouter.get("/api/documents/batch/:batchId", async (req, res) => {
  const { batchId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    return res.status(400).json({ error: "Invalid batchId" });
  }

  try {
    const batch = await BatchModel.findById(batchId).lean();
    if (!batch) return res.status(404).json({ error: "Batch not found" });

    const documents = await DocumentModel.find({ batchId })
      .select({ _id: 1, status: 1, generationTimeMs: 1 })
      .sort({ _id: 1 })
      .lean();

    return res.status(200).json({
      batchId,
      status: batch.status,
      documents: documents.map((d) => ({
        documentId: d._id.toString(),
        status: d.status,
        generationTimeMs: d.generationTimeMs
      }))
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch batch documents" });
  }
});

batchRouter.get("/api/documents/:documentId", async (req, res) => {
  const { documentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ error: "Invalid documentId" });
  }

  try {
    const document = await DocumentModel.findById(documentId).lean();
    if (!document) return res.status(404).json({ error: "Document not found" });

    if (!document.gridfsFileId) {
      return res.status(404).json({ error: "Document file not generated yet" });
    }

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ error: "MongoDB connection not ready" });
    }

    const bucket = new GridFSBucket(db);
    const downloadStream = bucket.openDownloadStream(document.gridfsFileId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="document_${documentId}.pdf"`
    );

    downloadStream.on("error", (err) => {
      if (res.headersSent) return;
      if ((err as any)?.code === "ENOENT") return res.status(404).json({ error: "File not found" });
      return res.status(500).json({ error: "Failed to download file" });
    });

    downloadStream.pipe(res);
  } catch {
    return res.status(500).json({ error: "Failed to download document" });
  }
});
