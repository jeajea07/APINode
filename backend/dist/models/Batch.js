"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchModel = void 0;
const mongoose_1 = require("mongoose");
const Document_1 = require("./Document");
const batchSchema = new mongoose_1.Schema({
    status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        required: true,
        default: "pending",
        index: true
    },
}, {
    timestamps: true
});
// Référence virtuelle vers les documents générés.
batchSchema.virtual("documents", {
    ref: "Document",
    localField: "_id",
    foreignField: "batchId"
});
// Helper pratique pour compter les documents liés.
batchSchema.statics.countDocumentsForBatch = async function (batchId) {
    return Document_1.DocumentModel.countDocuments({ batchId });
};
exports.BatchModel = (0, mongoose_1.model)("Batch", batchSchema);
//# sourceMappingURL=Batch.js.map