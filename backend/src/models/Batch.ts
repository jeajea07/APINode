import { Schema, model, Types } from "mongoose";

import { DocumentModel } from "./Document";

export type BatchStatus = "pending" | "processing" | "completed" | "failed";

export interface Batch {
  status: BatchStatus;
  totalDocuments: number;
  processedCount: number;
  failedCount: number;
  completedAt?: Date | null;
  // Nombre de documents liés à ce batch (non persistant).
  documentCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const batchSchema = new Schema<Batch>(
  {
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      required: true,
      default: "pending",
      index: true
    },
    totalDocuments: {
      type: Number,
      required: true,
      min: 0
    },
    processedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    failedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Référence virtuelle vers les documents générés.
batchSchema.virtual("documents", {
  ref: "Document",
  localField: "_id",
  foreignField: "batchId"
});

// Helper pratique pour compter les documents liés.
batchSchema.statics.countDocumentsForBatch = async function (batchId: Types.ObjectId | string) {
  return DocumentModel.countDocuments({ batchId });
};

export const BatchModel = model<Batch>("Batch", batchSchema);