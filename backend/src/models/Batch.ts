import { Schema, model, Types } from "mongoose";

import { DocumentModel } from "./Document";

export type BatchStatus = "pending" | "processing" | "completed" | "failed";

export interface Batch {
  status: BatchStatus;
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

