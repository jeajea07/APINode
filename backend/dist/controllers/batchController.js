"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchRouter = void 0;
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_1 = require("mongodb");
const Batch_1 = require("../models/Batch");
const Document_1 = require("../models/Document");
const queueFactory_1 = require("../infrastructure/queue/queueFactory");
exports.batchRouter = (0, express_1.Router)();
function isNonEmptyString(x) {
    return typeof x === "string" && x.trim().length > 0;
}
exports.batchRouter.post("/api/documents/batch", async (req, res) => {
    const body = req.body;
    const ids = Array.isArray(body) ? body : null;
    if (!ids) {
        return res.status(400).json({ error: "Body must be an array of 1000 IDs" });
    }
    if (ids.length !== 1000) {
        return res.status(400).json({
            error: "IDs array must contain exactly 1000 items",
            received: ids.length
        });
    }
    if (!ids.every(isNonEmptyString)) {
        return res.status(400).json({
            error: "All IDs must be non-empty strings"
        });
    }
    try {
        const batch = await Batch_1.BatchModel.create({
            status: "pending"
        });
        const batchId = batch._id.toString();
        // 1) Crée d'abord les entrées Document, puis seulement ensuite les jobs BullMQ.
        const documents = await Document_1.DocumentModel.insertMany(ids.map((userId) => ({
            userId,
            batchId: batch._id,
            status: "pending",
            retryCount: 0,
            gridfsFileId: null,
            errorMessage: null,
            generationTimeMs: null
        })));
        const queue = await (0, queueFactory_1.createQueue)();
        // 2) Ajoute les jobs avec l'identifiant de document correspondant.
        await queue.addBulk(documents.map((doc, idx) => {
            const userId = ids[idx];
            return {
                name: "generate-pdf",
                data: { userId, batchId, documentId: doc._id.toString() }
            };
        }));
        return res.status(202).json({
            batchId,
            message: "Batch created and processing has started"
        });
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to process batch" });
    }
});
exports.batchRouter.get("/api/documents/batch/:batchId", async (req, res) => {
    const { batchId } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({ error: "Invalid batchId" });
    }
    try {
        const batch = await Batch_1.BatchModel.findById(batchId).lean();
        if (!batch)
            return res.status(404).json({ error: "Batch not found" });
        const documents = await Document_1.DocumentModel.find({ batchId })
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
    }
    catch {
        return res.status(500).json({ error: "Failed to fetch batch documents" });
    }
});
exports.batchRouter.get("/api/documents/:documentId", async (req, res) => {
    const { documentId } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(documentId)) {
        return res.status(400).json({ error: "Invalid documentId" });
    }
    try {
        const document = await Document_1.DocumentModel.findById(documentId).lean();
        if (!document)
            return res.status(404).json({ error: "Document not found" });
        if (!document.gridfsFileId) {
            return res.status(404).json({ error: "Document file not generated yet" });
        }
        const db = mongoose_1.default.connection.db;
        if (!db) {
            return res.status(500).json({ error: "MongoDB connection not ready" });
        }
        const bucket = new mongodb_1.GridFSBucket(db);
        const downloadStream = bucket.openDownloadStream(document.gridfsFileId);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="document_${documentId}.pdf"`);
        downloadStream.on("error", (err) => {
            if (res.headersSent)
                return;
            if (err?.code === "ENOENT")
                return res.status(404).json({ error: "File not found" });
            return res.status(500).json({ error: "Failed to download file" });
        });
        downloadStream.pipe(res);
    }
    catch {
        return res.status(500).json({ error: "Failed to download document" });
    }
});
//# sourceMappingURL=batchController.js.map