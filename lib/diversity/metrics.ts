// Agreement metrics between a predicted partition and a human-labelled one.
// A partition is a list of groups of item ids; every id must appear exactly once.

export type Partition = string[][];

export interface PairCounts {
  truePositive: number; // same group in both
  falsePositive: number; // grouped by the system, split by the human
  falseNegative: number; // split by the system, grouped by the human
  trueNegative: number; // split in both
}

export interface Agreement extends PairCounts {
  precision: number;
  recall: number;
  f1: number;
  ari: number;
}

function groupOf(partition: Partition): Map<string, number> {
  const map = new Map<string, number>();
  partition.forEach((group, g) => {
    for (const id of group) {
      if (map.has(id)) throw new Error(`Item "${id}" appears in more than one group`);
      map.set(id, g);
    }
  });
  return map;
}

function sameItems(a: Map<string, number>, b: Map<string, number>): void {
  if (a.size !== b.size || [...a.keys()].some((id) => !b.has(id))) {
    throw new Error("Partitions must cover exactly the same items");
  }
}

export function pairCounts(predicted: Partition, truth: Partition): PairCounts {
  const pred = groupOf(predicted);
  const gold = groupOf(truth);
  sameItems(pred, gold);

  const ids = [...gold.keys()].sort();
  const counts: PairCounts = { truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0 };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const p = pred.get(ids[i]) === pred.get(ids[j]);
      const t = gold.get(ids[i]) === gold.get(ids[j]);
      if (p && t) counts.truePositive++;
      else if (p) counts.falsePositive++;
      else if (t) counts.falseNegative++;
      else counts.trueNegative++;
    }
  }
  return counts;
}

const choose2 = (n: number) => (n * (n - 1)) / 2;

// Adjusted Rand Index (Hubert & Arabie 1985): 1 = identical, ~0 = chance, can be < 0.
export function adjustedRandIndex(predicted: Partition, truth: Partition): number {
  const pred = groupOf(predicted);
  const gold = groupOf(truth);
  sameItems(pred, gold);

  const contingency = new Map<string, number>();
  for (const [id, g] of gold) {
    const key = `${g}:${pred.get(id)}`;
    contingency.set(key, (contingency.get(key) ?? 0) + 1);
  }

  const sumCells = [...contingency.values()].reduce((s, n) => s + choose2(n), 0);
  const sumGold = truth.reduce((s, group) => s + choose2(group.length), 0);
  const sumPred = predicted.reduce((s, group) => s + choose2(group.length), 0);
  const totalPairs = choose2(gold.size);
  if (totalPairs === 0) return 1;

  const expected = (sumGold * sumPred) / totalPairs;
  const max = (sumGold + sumPred) / 2;
  // Both partitions all-singletons or both one group: identical by construction.
  if (max === expected) return 1;
  return (sumCells - expected) / (max - expected);
}

// Pairs are summed across sets before computing P/R/F1 (micro-average), so large sets
// weigh more than small ones, which matches how the metric is reported.
export function precisionRecallF1(c: PairCounts): { precision: number; recall: number; f1: number } {
  const precision = c.truePositive + c.falsePositive === 0 ? 1 : c.truePositive / (c.truePositive + c.falsePositive);
  const recall = c.truePositive + c.falseNegative === 0 ? 1 : c.truePositive / (c.truePositive + c.falseNegative);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

export function agreement(predicted: Partition, truth: Partition): Agreement {
  const counts = pairCounts(predicted, truth);
  return { ...counts, ...precisionRecallF1(counts), ari: adjustedRandIndex(predicted, truth) };
}

export function addCounts(a: PairCounts, b: PairCounts): PairCounts {
  return {
    truePositive: a.truePositive + b.truePositive,
    falsePositive: a.falsePositive + b.falsePositive,
    falseNegative: a.falseNegative + b.falseNegative,
    trueNegative: a.trueNegative + b.trueNegative,
  };
}
