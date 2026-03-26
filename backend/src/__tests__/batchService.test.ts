import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";

import { BatchModel } from "../models/Batch";
import { DocumentModel } from "../models/Document";
import * as queueFactory from "../infrastructure/queue/queueFactory";
import { createBatch, updateBatchProgress } from "../services/batchService";

type QueueLike = {
  addBulk: (jobs: Array<{ name: string; data: unknown }>) => Promise<void>;
};

function makeIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `user-${i}`);
}

test("createBatch inserts 1000 documents via insertMany", async () => {
  const originalCreate = BatchModel.create;
  const originalInsertMany = DocumentModel.insertMany;
  const originalCreateQueue = queueFactory.createQueue;

  let insertedCount = 0;

  BatchModel.create = (async (doc: { status: string; totalDocuments: number }) => {
    return { _id: new Types.ObjectId(), ...doc } as unknown;
  }) as typeof BatchModel.create;

  DocumentModel.insertMany = (async (docs: Array<unknown>) => {
    insertedCount = docs.length;
    return docs as Array<unknown>;
  }) as typeof DocumentModel.insertMany;

  const queueFactoryAny = queueFactory as unknown as { createQueue: typeof queueFactory.createQueue };
  queueFactoryAny.createQueue = (async () => {
    const queue: QueueLike = { addBulk: async () => {} };
    return queue as unknown;
  }) as typeof queueFactory.createQueue;

  try {
    const ids = makeIds(1000);
    await createBatch(ids);
    assert.equal(insertedCount, 1000);
  } finally {
    BatchModel.create = originalCreate;
    DocumentModel.insertMany = originalInsertMany;
    queueFactoryAny.createQueue = originalCreateQueue;
  }
});

test("createBatch creates batch with correct totalDocuments", async () => {
  const originalCreate = BatchModel.create;
  const originalInsertMany = DocumentModel.insertMany;
  const originalCreateQueue = queueFactory.createQueue;

  let totalDocuments = 0;

  BatchModel.create = (async (doc: { status: string; totalDocuments: number }) => {
    totalDocuments = doc.totalDocuments;
    return { _id: new Types.ObjectId(), ...doc } as unknown;
  }) as typeof BatchModel.create;

  DocumentModel.insertMany = (async (docs: Array<unknown>) => {
    return docs as Array<unknown>;
  }) as typeof DocumentModel.insertMany;

  const queueFactoryAny = queueFactory as unknown as { createQueue: typeof queueFactory.createQueue };
  queueFactoryAny.createQueue = (async () => {
    const queue: QueueLike = { addBulk: async () => {} };
    return queue as unknown;
  }) as typeof queueFactory.createQueue;

  try {
    const ids = makeIds(42);
    await createBatch(ids);
    assert.equal(totalDocuments, 42);
  } finally {
    BatchModel.create = originalCreate;
    DocumentModel.insertMany = originalInsertMany;
    queueFactoryAny.createQueue = originalCreateQueue;
  }
});

test("updateBatchProgress increments processedCount on success", async () => {
  const originalFindOneAndUpdate = BatchModel.findOneAndUpdate;
  let updateUsed: Record<string, unknown> | null = null;

  BatchModel.findOneAndUpdate = (async (_filter, update) => {
    updateUsed = update as Record<string, unknown>;
    return {
      processedCount: 1,
      failedCount: 0,
      totalDocuments: 10,
      createdAt: new Date()
    } as unknown;
  }) as typeof BatchModel.findOneAndUpdate;

  try {
    await updateBatchProgress("batch-id", true);
    const inc = (updateUsed as { $inc?: Record<string, number> } | null)?.$inc;
    assert.equal(inc?.processedCount, 1);
  } finally {
    BatchModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("updateBatchProgress increments failedCount on failure", async () => {
  const originalFindOneAndUpdate = BatchModel.findOneAndUpdate;
  let updateUsed: Record<string, unknown> | null = null;

  BatchModel.findOneAndUpdate = (async (_filter, update) => {
    updateUsed = update as Record<string, unknown>;
    return {
      processedCount: 0,
      failedCount: 1,
      totalDocuments: 10,
      createdAt: new Date()
    } as unknown;
  }) as typeof BatchModel.findOneAndUpdate;

  try {
    await updateBatchProgress("batch-id", false);
    const inc = (updateUsed as { $inc?: Record<string, number> } | null)?.$inc;
    assert.equal(inc?.failedCount, 1);
  } finally {
    BatchModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("batch finalizes to 'completed' when all docs succeed", async () => {
  const originalFindOneAndUpdate = BatchModel.findOneAndUpdate;
  const calls: Array<Record<string, unknown>> = [];

  BatchModel.findOneAndUpdate = (async (_filter, update) => {
    calls.push(update as Record<string, unknown>);
    const isFinalUpdate = "$set" in (update as Record<string, unknown>) && !("$inc" in (update as Record<string, unknown>));
    if (isFinalUpdate) return null as unknown;
    return {
      processedCount: 3,
      failedCount: 0,
      totalDocuments: 3,
      createdAt: new Date()
    } as unknown;
  }) as typeof BatchModel.findOneAndUpdate;

  try {
    await updateBatchProgress("batch-id", true);
    const finalUpdate = calls.find((u) => {
      const set = u["$set"] as Record<string, unknown> | undefined;
      return Boolean(set && set.status === "completed");
    });
    assert.ok(finalUpdate, "expected final status update to completed");
  } finally {
    BatchModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("batch finalizes to 'failed' when all docs failed", async () => {
  const originalFindOneAndUpdate = BatchModel.findOneAndUpdate;
  const calls: Array<Record<string, unknown>> = [];

  BatchModel.findOneAndUpdate = (async (_filter, update) => {
    calls.push(update as Record<string, unknown>);
    const isFinalUpdate = "$set" in (update as Record<string, unknown>) && !("$inc" in (update as Record<string, unknown>));
    if (isFinalUpdate) return null as unknown;
    return {
      processedCount: 0,
      failedCount: 2,
      totalDocuments: 2,
      createdAt: new Date()
    } as unknown;
  }) as typeof BatchModel.findOneAndUpdate;

  try {
    await updateBatchProgress("batch-id", false);
    const finalUpdate = calls.find((u) => {
      const set = u["$set"] as Record<string, unknown> | undefined;
      return Boolean(set && set.status === "failed");
    });
    assert.ok(finalUpdate, "expected final status update to failed");
  } finally {
    BatchModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
