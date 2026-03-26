import { Schema, model, Types } from "mongoose";

export type DocumentStatus = "pending" | "processing" | "completed" | "failed";

export interface Document {
  batchId: Types.ObjectId;
  userId: string;
  status: DocumentStatus;
  gridfsFileId: Types.ObjectId | null;
  retryCount: number;
  errorMessage: string | null;
  generationTimeMs: number | null;
}

const documentSchema = new Schema<Document>(
  {
    batchId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true
  }
);

export const DocumentModel = model<Document>("Document", documentSchema);

