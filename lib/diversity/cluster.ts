// Deterministic concept clustering over embedding vectors.
//
// Membership is decided here with plain math so the same input always yields the same
// partition; the LLM only names and explains the clusters afterwards.

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function similarityMatrix(vectors: number[][]): number[][] {
  const n = vectors.length;
  const matrix = Array.from({ length: n }, () => new Array<number>(n).fill(1));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }
  return matrix;
}

function averageLinkage(similarity: number[][], a: number[], b: number[]): number {
  let total = 0;
  for (const i of a) for (const j of b) total += similarity[i][j];
  return total / (a.length * b.length);
}

// Average-linkage agglomerative clustering: repeatedly merge the two most similar
// clusters until no pair's mean pairwise similarity reaches `threshold`.
// Returns clusters as sorted index lists, ordered by their first member, so output is
// stable regardless of floating-point ties. O(n^3), fine for ad sets of ≤ 50.
export function clusterBySimilarity(similarity: number[][], threshold: number): number[][] {
  let clusters = similarity.map((_, i) => [i]);

  while (clusters.length > 1) {
    let best = { score: -Infinity, a: -1, b: -1 };
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        const score = averageLinkage(similarity, clusters[a], clusters[b]);
        if (score > best.score) best = { score, a, b };
      }
    }
    if (best.score < threshold) break;

    const merged = [...clusters[best.a], ...clusters[best.b]].sort((x, y) => x - y);
    clusters = clusters.filter((_, i) => i !== best.a && i !== best.b);
    clusters.push(merged);
  }

  return clusters.sort((x, y) => x[0] - y[0]);
}
