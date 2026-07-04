import { test } from "node:test";
import assert from "node:assert/strict";
import { parseModelJSON } from "@/lib/ai/json";

test("parses plain JSON", () => {
  assert.deepEqual(parseModelJSON('{"a":1}'), { a: 1 });
});

test("strips a ```json fence", () => {
  assert.deepEqual(parseModelJSON('```json\n{"a":1}\n```'), { a: 1 });
});

test("strips a bare ``` fence", () => {
  assert.deepEqual(parseModelJSON('```\n[1,2]\n```'), [1, 2]);
});

test("slices leading/trailing prose around the JSON", () => {
  assert.deepEqual(parseModelJSON('Here you go:\n{"a":{"b":2}}\nHope that helps!'), { a: { b: 2 } });
});

test("throws on input with no JSON at all", () => {
  assert.throws(() => parseModelJSON("no json here"));
});
