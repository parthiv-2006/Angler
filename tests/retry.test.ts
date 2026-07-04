import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "@/lib/cache";

test("returns the first successful result", async () => {
  const result = await withRetry(async () => 42);
  assert.equal(result, 42);
});

test("retries transient failures and eventually succeeds", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 2) throw Object.assign(new Error("boom"), { status: 500 });
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(calls, 2);
});

test("does not retry a 400 — the request will never succeed", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => {
      calls++;
      throw Object.assign(new Error("bad request"), { status: 400 });
    }),
  );
  assert.equal(calls, 1);
});

test("retries 429 throttling", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 2) throw Object.assign(new Error("throttled"), { status: 429 });
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(calls, 2);
});
