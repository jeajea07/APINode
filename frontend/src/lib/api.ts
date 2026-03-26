const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export type ApiBatchStatus = "pending" | "processing" | "completed" | "failed";
export type ApiDocStatus = "pending" | "processing" | "completed" | "failed";

export type BatchCreateResponse = {
  batchId: string;
  message: string;
};

export type BatchGetResponse = {
  batchId: string;
  status: ApiBatchStatus;
  documents: Array<{
    documentId: string;
    status: ApiDocStatus;
    generationTimeMs: number | null;
  }>;
};

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function createBatch(userIds: string[]): Promise<BatchCreateResponse> {
  const res = await fetch(`${API_BASE_URL}/api/documents/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userIds),
  });
  return parseJson<BatchCreateResponse>(res);
}

export async function getBatch(batchId: string): Promise<BatchGetResponse> {
  const res = await fetch(`${API_BASE_URL}/api/documents/batch/${batchId}`);
  return parseJson<BatchGetResponse>(res);
}

export function getDocumentDownloadUrl(documentId: string): string {
  return `${API_BASE_URL}/api/documents/${documentId}`;
}

export function generateUserIds(count: number): string[] {
  return Array.from({ length: count }, () => crypto.randomUUID());
}

