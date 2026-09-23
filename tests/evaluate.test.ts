import { test } from "node:test";
import assert from "node:assert/strict";
import { leaveOneSetOut, llmToPartition, stability, tuneThreshold, type LabelledSet } from "@/lib/diversity/evaluate";
import { similarityMatrix } from "@/lib/diversity/cluster";

// Each synthetic set has two true concepts: ids starting "a" and ids starting "b".
function set(slug: string, spread: number): LabelledSet {
  const vectors = [
    [1, spread, 0],
    [1, 0, spread],
    [spread, 1, 0],
    [0, 1, spread],
  ];
  return {
    slug,
    ids: ["a1", "a2", "b1", "b2"],
    similarity: similarityMatrix(vectors),
    truth: [["a1", "a2"], ["b1", "b2"]],
  };
}

test("repairs invented, duplicated and missing LLM ids into a valid partition", () => {
  const { partition, repairs } = llmToPartition(
    {
      clusters: [
        { concept: "x", adIds: ["a1", "a2", "ghost"], reason: "" },
        { concept: "y", adIds: ["a2", "b1"], reason: "" },
      ],
      nAds: 4,
      kConcepts: 2,
      gaps: [],
    },
    ["a1", "a2", "b1", "b2"],
  );
  assert.deepEqual(partition, [["a1", "a2"], ["b1"], ["b2"]]);
  assert.equal(repairs, 3); // ghost, duplicate a2, missing b2
});

test("tuning finds a threshold that recovers the true concepts", () => {
  const { threshold, score } = tuneThreshold([set("s1", 0.1), set("s2", 0.2)]);
  assert.equal(score.f1, 1);
  assert.equal(threshold, 0.5); // every grid value scores F1=1 here; ties go to the lowest
});

test("leave-one-set-out reports one fold per set and scores held-out data", () => {
  const result = leaveOneSetOut([set("s1", 0.1), set("s2", 0.2), set("s3", 0.15)]);
  assert.deepEqual(result.folds.map((f) => f.slug), ["s1", "s2", "s3"]);
  assert.equal(result.score.f1, 1);
  assert.throws(() => leaveOneSetOut([set("s1", 0.1)]));
});

test("stability is 1 for identical runs and lower when runs disagree", () => {
  const a = [["x", "y"], ["z", "w"]];
  const b = [["x", "z"], ["y", "w"]];
  assert.equal(stability([a, a, a]), 1);
  assert.ok(stability([a, b]) < 1);
  assert.equal(stability([a]), 1);
});
