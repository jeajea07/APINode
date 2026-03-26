import type { BatchGetResponse } from "./api";

export type DocStatus = "completed" | "processing" | "failed" | "pending";
export type BatchStatus = "pending" | "processing" | "completed" | "failed";

export interface BatchDocument {
  id: string;
  status: DocStatus;
  retries: number;
  timeMs: number;
}

export interface Batch {
  id: string;
  name: string;
  status: BatchStatus;
  totalItems: number;
  completedItems: number;
  errorItems: number;
  avgTimeMs: number;
  createdAt: string;
  documents: BatchDocument[];
}

export function toBatchView(name: string, createdAt: string, apiBatch: BatchGetResponse): Batch {
  const documents: BatchDocument[] = apiBatch.documents.map((doc) => ({
    id: doc.documentId,
    status: doc.status,
    retries: 0,
    timeMs: doc.generationTimeMs ?? 0,
  }));

  const completed = documents.filter((d) => d.status === "completed").length;
  const failed = documents.filter((d) => d.status === "failed").length;
  const doneDocs = documents.filter((d) => d.timeMs > 0);
  const avgTimeMs =
    doneDocs.length > 0 ? Math.round(doneDocs.reduce((sum, d) => sum + d.timeMs, 0) / doneDocs.length) : 0;

  return {
    id: apiBatch.batchId,
    name,
    status: apiBatch.status,
    totalItems: documents.length,
    completedItems: completed,
    errorItems: failed,
    avgTimeMs,
    createdAt,
    documents,
  };
}
