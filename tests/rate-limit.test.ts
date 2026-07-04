import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { rateLimited } from "@/lib/rate-limit";

function reqFrom(ip: string): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

test("allows normal traffic and blocks a burst past the window cap", () => {
  for (let i = 0; i < 30; i++) {
    assert.equal(rateLimited(reqFrom("10.0.0.1")), null, `request ${i + 1} should pass`);
  }
  const blocked = rateLimited(reqFrom("10.0.0.1"));
  assert.ok(blocked);
  assert.equal(blocked!.status, 429);
});

test("limits are per-IP", () => {
  for (let i = 0; i < 31; i++) rateLimited(reqFrom("10.0.0.2"));
  assert.equal(rateLimited(reqFrom("10.0.0.3")), null);
});
