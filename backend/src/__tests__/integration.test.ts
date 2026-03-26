import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import express, { type Router } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let server: Server;
let baseUrl = "";
let batchRouter: Router;

before(async () => {
  const require = createRequire(__filename);
  const redisMock = require("ioredis-mock") as {
    prototype: { ping: () => Promise<string> };
  };
  redisMock.prototype.ping = async () => {
    throw new Error("Redis unavailable (forced for tests)");
  };

  const resolved = require.resolve("ioredis");
  require.cache[resolved] = { exports: redisMock } as unknown as NodeJS.Module;

  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.REDIS_HOST = "localhost-unreachable-test";
  process.env.REDIS_PORT = "6379";

  await mongoose.connect(uri);

  const mod = await import("../controllers/batchController");
  batchRouter = mod.batchRouter;

  const app = express();
  app.use(express.json());
  app.use(batchRouter);
  app.get("/health", (_req, res) => {
    const mongoOk = mongoose.connection.readyState === 1 && Boolean(mongoose.connection.db);
    res.status(mongoOk ? 200 : 503).json({ status: mongoOk ? "ok" : "degraded" });
  });

  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await mongoose.disconnect();
  await mongod.stop();
});

test("POST /batch returns 202 with batchId", async () => {
  const ids = Array.from({ length: 5 }, (_, i) => `integ_user_${i}`);
  const res = await fetch(`${baseUrl}/api/documents/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids)
  });
  assert.equal(res.status, 202);
  const body = (await res.json()) as { batchId?: string };
  assert.ok(body.batchId);
});

test("GET /batch/:batchId returns documents list", async () => {
  const ids = Array.from({ length: 5 }, (_, i) => `integ_user_${i}`);
  const postRes = await fetch(`${baseUrl}/api/documents/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids)
  });
  assert.equal(postRes.status, 202);
  const postBody = (await postRes.json()) as { batchId?: string };
  assert.ok(postBody.batchId);

  const getRes = await fetch(`${baseUrl}/api/documents/batch/${postBody.batchId}`);
  assert.equal(getRes.status, 200);
  const batch = (await getRes.json()) as {
    documents: Array<{ documentId: string; userId: string; status: string }>;
  };

  assert.equal(batch.documents.length, 5);
  for (const doc of batch.documents) {
    assert.ok(doc.documentId);
    assert.ok(doc.userId);
    assert.ok(doc.status);
  }
});

test("GET /documents/:id returns 404 when not found", async () => {
  const fakeId = crypto.randomUUID();
  const res = await fetch(`${baseUrl}/api/documents/${fakeId}`);
  assert.equal(res.status, 404);
});

test("GET /health returns 200 when mongo is up", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
});
