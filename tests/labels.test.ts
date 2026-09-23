import { test } from "node:test";
import assert from "node:assert/strict";
import { labelFileSchema, validateAgainstIds, type LabelFile } from "@/lib/diversity/labels";

const label = (groups: string[][]): LabelFile => ({ slug: "s", labeler: "me", labeledAt: "2026-09-23", groups });

test("a label file must partition exactly the set's ads", () => {
  const ids = ["a", "b", "c"];
  assert.equal(validateAgainstIds(label([["a", "b"], ["c"]]), ids), null);
  assert.match(validateAgainstIds(label([["a", "b"]]), ids)!, /unlabelled ads: c/);
  assert.match(validateAgainstIds(label([["a", "b"], ["c", "z"]]), ids)!, /unknown ads: z/);
  assert.match(validateAgainstIds(label([["a", "b"], ["b", "c"]]), ids)!, /more than one group/);
});

test("schema rejects empty groups, missing labeler and unsafe slugs", () => {
  assert.equal(labelFileSchema.safeParse(label([[]])).success, false);
  assert.equal(labelFileSchema.safeParse({ ...label([["a"]]), labeler: "" }).success, false);
  assert.equal(labelFileSchema.safeParse({ ...label([["a"]]), slug: "../x" }).success, false);
});
