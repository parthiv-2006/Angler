// Evaluation helpers: turn system outputs into partitions, tune the clustering
// threshold, and score it without fitting on the data being scored.

import type { ConceptClustering } from "@/lib/types";
import { clusterBySimilarity } from "./cluster";
import { addCounts, adjustedRandIndex, pairCounts, precisionRecallF1, type PairCounts, type Partition } from "./metrics";

export interface LabelledSet {
  slug: string;
  ids: string[]; // row/column order of `similarity`
  similarity: number[][];
  truth: Partition;
}

export interface Score {
  precision: number;
  recall: number;
  f1: number;
  meanAri: number;
}

const EMPTY: PairCounts = { truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0 };

export function indicesToPartition(clusters: number[][], ids: string[]): Partition {
  return clusters.map((group) => group.map((i) => ids[i]));
}

export function predict(set: LabelledSet, threshold: number): Partition {
  return indicesToPartition(clusterBySimilarity(set.similarity, threshold), set.ids);
}

// LLM clusterings can drop ids, invent ids, or place one ad in two clusters. Repair
// into a valid partition (first placement wins, missing ads become singletons) and
// report how many repairs were needed; that count is itself a quality signal.
export function llmToPartition(clustering: ConceptClustering, ids: string[]): { partition: Partition; repairs: number } {
  const valid = new Set(ids);
  const seen = new Set<string>();
  let repairs = 0;
  const partition: Partition = [];

  for (const cluster of clustering.clusters) {
    const group: string[] = [];
    for (const id of cluster.adIds) {
      if (!valid.has(id) || seen.has(id)) {
        repairs++;
        continue;
      }
      seen.add(id);
      group.push(id);
    }
    if (group.length) partition.push(group);
  }
  for (const id of ids) {
    if (!seen.has(id)) {
      repairs++;
      partition.push([id]);
    }
  }
  return { partition, repairs };
}

// Micro-averaged pairwise P/R/F1 (pairs pooled across sets) plus mean per-set ARI.
export function scorePartitions(pairs: { predicted: Partition; truth: Partition }[]): Score {
  const counts = pairs.reduce((acc, p) => addCounts(acc, pairCounts(p.predicted, p.truth)), EMPTY);
  const meanAri = pairs.reduce((s, p) => s + adjustedRandIndex(p.predicted, p.truth), 0) / pairs.length;
  return { ...precisionRecallF1(counts), meanAri };
}

export function scoreAtThreshold(sets: LabelledSet[], threshold: number): Score {
  return scorePartitions(sets.map((set) => ({ predicted: predict(set, threshold), truth: set.truth })));
}

export const THRESHOLD_GRID = Array.from({ length: 51 }, (_, i) => Math.round((0.5 + i * 0.01) * 100) / 100);

// Best threshold by pairwise F1; ties go to the lower threshold (fewer, broader clusters
// are the conservative reading of "these ads collapse").
export function tuneThreshold(sets: LabelledSet[], grid: number[] = THRESHOLD_GRID): { threshold: number; score: Score } {
  let best = { threshold: grid[0], score: scoreAtThreshold(sets, grid[0]) };
  for (const threshold of grid.slice(1)) {
    const score = scoreAtThreshold(sets, threshold);
    if (score.f1 > best.score.f1) best = { threshold, score };
  }
  return best;
}

// Leave-one-set-out: tune τ on every other set, then score the held-out set with it.
// The pooled held-out predictions give an estimate that was never fit on its own data.
export function leaveOneSetOut(sets: LabelledSet[], grid: number[] = THRESHOLD_GRID): {
  score: Score;
  folds: { slug: string; threshold: number }[];
} {
  if (sets.length < 2) throw new Error("Leave-one-set-out needs at least two labelled sets");
  const folds = sets.map((heldOut) => {
    const { threshold } = tuneThreshold(sets.filter((s) => s !== heldOut), grid);
    return { slug: heldOut.slug, threshold, predicted: predict(heldOut, threshold), truth: heldOut.truth };
  });
  return {
    score: scorePartitions(folds),
    folds: folds.map(({ slug, threshold }) => ({ slug, threshold })),
  };
}

// Run-to-run stability: mean ARI between every pair of repeated runs on the same input.
// 1 means every run produced the identical partition.
export function stability(runs: Partition[]): number {
  if (runs.length < 2) return 1;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      total += adjustedRandIndex(runs[i], runs[j]);
      pairs++;
    }
  }
  return total / pairs;
}
