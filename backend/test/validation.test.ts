import assert from "node:assert/strict";
import { test } from "node:test";
import { validateBatchIds } from "../src/utils/validation";

test("validateBatchIds rejects non-array body", () => {
  const result = validateBatchIds({ foo: "bar" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "Body must be an array of IDs");
  }
});

test("validateBatchIds rejects array with wrong length", () => {
  const result = validateBatchIds(["a", "b"]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "IDs array must contain between 1 and 5000 items");
    assert.equal(result.received, 2);
  }
});

test("validateBatchIds rejects empty strings", () => {
  const ids = Array.from({ length: 1000 }, () => " ");
  const result = validateBatchIds(ids);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "All IDs must be non-empty strings");
  }
});

test("validateBatchIds accepts valid array", () => {
  const ids = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
  const result = validateBatchIds(ids);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.ids.length, 1000);
  }
});
