import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterBySimilarity, cosineSimilarity, similarityMatrix } from "@/lib/diversity/cluster";

test("cosine similarity of identical, orthogonal and opposite vectors", () => {
  assert.equal(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
});

test("cosine similarity is scale-invariant and safe on zero vectors", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 1], [5, 5]) - 1) < 1e-12);
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
});

test("cosine similarity rejects mismatched dimensions", () => {
  assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]));
});

test("similarity matrix is symmetric with a unit diagonal", () => {
  const m = similarityMatrix([[1, 0], [0.9, 0.1], [0, 1]]);
  for (let i = 0; i < 3; i++) {
    assert.equal(m[i][i], 1);
    for (let j = 0; j < 3; j++) assert.equal(m[i][j], m[j][i]);
  }
});

// Two tight groups pointing in different directions.
const vectors = [
  [1, 0.05, 0],
  [1, 0, 0.05],
  [0.95, 0.05, 0.05],
  [0, 1, 0.05],
  [0.05, 1, 0],
];

test("groups near-duplicates and separates distinct concepts", () => {
  const clusters = clusterBySimilarity(similarityMatrix(vectors), 0.8);
  assert.deepEqual(clusters, [[0, 1, 2], [3, 4]]);
});

test("threshold controls granularity: 1.0 keeps singletons, -1 merges everything", () => {
  const sim = similarityMatrix(vectors);
  assert.equal(clusterBySimilarity(sim, 1.01).length, vectors.length);
  assert.deepEqual(clusterBySimilarity(sim, -1), [[0, 1, 2, 3, 4]]);
});

test("output is deterministic and independent of cluster merge order", () => {
  const sim = similarityMatrix(vectors);
  assert.deepEqual(clusterBySimilarity(sim, 0.8), clusterBySimilarity(sim, 0.8));
});

test("handles empty and single-item inputs", () => {
  assert.deepEqual(clusterBySimilarity([], 0.8), []);
  assert.deepEqual(clusterBySimilarity([[1]], 0.8), [[0]]);
});
