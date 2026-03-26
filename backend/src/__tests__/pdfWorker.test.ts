import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

const requireFn = createRequire(__filename);
const generatePdfBuffer = requireFn("../workers/pdf.worker") as (task: { userId: string }) => Promise<Buffer>;

test("generatePdfBuffer returns a non-empty Buffer", async () => {
  const result = await generatePdfBuffer({ userId: "user_test" });
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test("generated PDF contains userId in content", async () => {
  const result = await generatePdfBuffer({ userId: "user_xyz_123" });
  assert.ok(result.toString("latin1").includes("user_xyz_123"));
});

test("generatePdfBuffer rejects on timeout", async () => {
  const previous = process.env.PDF_TIMEOUT_MS;
  process.env.PDF_TIMEOUT_MS = "1";
  try {
    await assert.rejects(
      generatePdfBuffer({ userId: "user_test" }),
      /timeout/i
    );
  } finally {
    if (previous === undefined) {
      delete process.env.PDF_TIMEOUT_MS;
    } else {
      process.env.PDF_TIMEOUT_MS = previous;
    }
  }
});
