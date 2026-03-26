"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentModel = void 0;
const mongoose_1 = require("mongoose");
const documentSchema = new mongoose_1.Schema({
    batchId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Batch",
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        required: true,
        default: "pending",
        index: true
    },
    gridfsFileId: {
        type: mongoose_1.Schema.Types.ObjectId,
        default: null
    },
    retryCount: {
        type: Number,
        required: true,
        default: 0
    },
    errorMessage: {
        type: String,
        default: null
    },
    generationTimeMs: {
        type: Number,
        default: null
    }
}, {
    timestamps: true
});
exports.DocumentModel = (0, mongoose_1.model)("Document", documentSchema);
//# sourceMappingURL=Document.js.map