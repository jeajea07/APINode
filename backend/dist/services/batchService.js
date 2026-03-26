"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBatch = processBatch;
const Batch_1 = require("../models/Batch");
const Document_1 = require("../models/Document");
const queueFactory_1 = require("../infrastructure/queue/queueFactory");
async function processBatch(userIds) {
    const batch = await Batch_1.BatchModel.create({ status: "pending" });
    const batchId = batch._id.toString();
    // Crée les documents d'abord, puis ajoute les jobs BullMQ.
    const documents = await Document_1.DocumentModel.insertMany(userIds.map((userId) => ({
        userId,
        batchId: batch._id,
        status: "pending",
        retryCount: 0,
        gridfsFileId: null,
        errorMessage: null,
        generationTimeMs: null
    })));
    const queue = await (0, queueFactory_1.createQueue)();
    await queue.addBulk(documents.map((doc, idx) => ({
        name: "generate-pdf",
        data: { userId: userIds[idx], batchId, documentId: doc._id.toString() }
    })));
    return batchId;
}
//# sourceMappingURL=batchService.js.map