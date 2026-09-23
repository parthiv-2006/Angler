import { test } from "node:test";
import assert from "node:assert/strict";
import { addCounts, adjustedRandIndex, agreement, pairCounts, precisionRecallF1 } from "@/lib/diversity/metrics";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !≈ ${b}`);

test("identical partitions agree perfectly, regardless of group order", () => {
  const a = agreement([["x", "y"], ["z"]], [["z"], ["y", "x"]]);
  assert.equal(a.precision, 1);
  assert.equal(a.recall, 1);
  assert.equal(a.f1, 1);
  close(a.ari, 1);
});

test("pair counts classify every pair exactly once", () => {
  // truth: {a,b,c} {d}; predicted: {a,b} {c,d}
  const c = pairCounts([["a", "b"], ["c", "d"]], [["a", "b", "c"], ["d"]]);
  assert.deepEqual(c, { truePositive: 1, falsePositive: 1, falseNegative: 2, trueNegative: 2 });
  const total = c.truePositive + c.falsePositive + c.falseNegative + c.trueNegative;
  assert.equal(total, 6); // C(4,2)
});

test("over-merging hurts precision, over-splitting hurts recall", () => {
  const truth = [["a", "b"], ["c", "d"]];
  const merged = agreement([["a", "b", "c", "d"]], truth);
  assert.equal(merged.recall, 1);
  assert.ok(merged.precision < 1);

  const split = agreement([["a"], ["b"], ["c"], ["d"]], truth);
  assert.equal(split.precision, 1); // vacuous: no predicted pairs
  assert.equal(split.recall, 0);
});

test("ARI matches scikit-learn's documented reference values", () => {
  // sklearn: adjusted_rand_score([0, 0, 1, 1], [0, 0, 1, 2]) == 0.5714...
  close(adjustedRandIndex([["a", "b"], ["c"], ["d"]], [["a", "b"], ["c", "d"]]), 4 / 7);
  // truth {1,2,3}{4,5,6}, predicted {1,2}{3,4}{5,6}: cells 2,1,1,2 → (2 - 1.2) / (4.5 - 1.2)
  close(adjustedRandIndex([["1", "2"], ["3", "4"], ["5", "6"]], [["1", "2", "3"], ["4", "5", "6"]]), 0.8 / 3.3);
});

test("ARI is ~0 or negative for a partition unrelated to the truth", () => {
  const ari = adjustedRandIndex([["a", "c"], ["b", "d"]], [["a", "b"], ["c", "d"]]);
  assert.ok(ari <= 0);
});

test("rejects partitions over different items or with duplicates", () => {
  assert.throws(() => agreement([["a"]], [["b"]]));
  assert.throws(() => agreement([["a", "a"]], [["a"]]));
});

test("micro-averaged counts combine across sets", () => {
  const c = addCounts(
    pairCounts([["a", "b"]], [["a", "b"]]),
    pairCounts([["c", "d"]], [["c"], ["d"]]),
  );
  const { precision, recall } = precisionRecallF1(c);
  close(precision, 0.5);
  close(recall, 1);
});
