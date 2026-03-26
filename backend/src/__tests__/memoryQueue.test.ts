import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryQueue } from "../infrastructure/queue/memoryQueue";

type JobData = { value: number };

test("addBulk pushes jobs to internal queue", async () => {
  const queue = new MemoryQueue();
  await queue.addBulk([{ name: "job-1", data: { value: 1 } }]);
  assert.equal(queue.getSize(), 1);
});

test("getSize returns correct count after addBulk", async () => {
  const queue = new MemoryQueue();
  await queue.addBulk([
    { name: "job-1", data: { value: 1 } },
    { name: "job-2", data: { value: 2 } },
  ]);
  assert.equal(queue.getSize(), 2);
});

test("process calls handler for each job", async () => {
  const queue = new MemoryQueue();
  const seen: number[] = [];

  await queue.addBulk([
    { name: "job-1", data: { value: 1 } },
    { name: "job-2", data: { value: 2 } },
  ]);

  queue.process(async (job) => {
    const data = job.data as JobData;
    seen.push(data.value);
  }, 2);

  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.deepEqual(seen.sort(), [1, 2]);
});

test("close stops processing", async () => {
  const queue = new MemoryQueue();
  let called = 0;

  await queue.addBulk([{ name: "job-1", data: { value: 1 } }]);
  queue.process(async () => {
    called += 1;
  }, 1);

  await queue.close();
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.equal(called, 0);
});

test("getSize decrements after job is processed", async () => {
  const queue = new MemoryQueue();
  await queue.addBulk([{ name: "job-1", data: { value: 1 } }]);

  queue.process(async () => {}, 1);
  await new Promise((resolve) => setTimeout(resolve, 600));

  assert.equal(queue.getSize(), 0);
});
