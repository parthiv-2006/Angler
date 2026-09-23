/**
 * Diversity-engine eval: scores the LLM-only clusterer and the embedding clusterer
 * (one row per embedding view) against human labels, then writes the winning
 * configuration to data/eval/results.json, which /api/score reads.
 *
 *   npm run eval                    # uses cached LLM runs, tops up to 3 per set
 *   npm run eval -- --llm-runs 5    # more LLM runs for a tighter stability estimate
 *   npm run eval -- --llm-runs 0    # embeddings only, no model calls
 *
 * Inputs:  data/eval/labels/*.json   (npm run label, written by a person)
 *          data/seed/embeddings/*.json (npm run embed-seed)
 * LLM runs are cached in data/eval/llm-runs/<slug>.json. They are real model outputs,
 * committed so the reported numbers can be re-derived without paying again.
 */
import dotenv from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

dotenv.config({ path: ".env.local" });

import { getProvider } from "@/lib/ai/provider";
import { withRetry } from "@/lib/cache";
import { getSeedEmbeddings, listClusterableSets, type ClusterableSet } from "@/lib/cache/seed";
import { similarityMatrix } from "@/lib/diversity/cluster";
import {
  leaveOneSetOut,
  llmToPartition,
  scorePartitions,
  stability,
  tuneThreshold,
  type LabelledSet,
  type Score,
} from "@/lib/diversity/evaluate";
import { loadLabels, validateAgainstIds, type LabelFile } from "@/lib/diversity/labels";
import type { Partition } from "@/lib/diversity/metrics";
import { EMBEDDING_VIEWS } from "@/lib/embeddings/input";
import type { ConceptClustering } from "@/lib/types";

const EVAL_DIR = join(process.cwd(), "data", "eval");
const LLM_RUNS_DIR = join(EVAL_DIR, "llm-runs");
const RESULTS_PATH = join(EVAL_DIR, "results.json");

interface LlmRunsFile {
  provider: string;
  runs: { clustering: ConceptClustering; latencyMs: number }[];
}

interface SystemResult extends Score {
  system: string;
  stability: number;
  note: string;
}

function argValue(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

function loadLabelledPairs(): { set: ClusterableSet; label: LabelFile }[] {
  const sets = new Map(listClusterableSets().map((s) => [s.slug, s]));
  return loadLabels().map((label) => {
    const set = sets.get(label.slug);
    if (!set) throw new Error(`Label file for unknown set "${label.slug}"`);
    const problem = validateAgainstIds(label, set.items.map((i) => i.adId));
    if (problem) throw new Error(`${label.slug}: ${problem}`);
    return { set, label };
  });
}

async function ensureLlmRuns(set: ClusterableSet, wanted: number): Promise<LlmRunsFile> {
  const path = join(LLM_RUNS_DIR, `${set.slug}.json`);
  const provider = (process.env.AI_PROVIDER ?? "anthropic").trim().split(/\s/)[0];
  const file: LlmRunsFile = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf-8")) as LlmRunsFile)
    : { provider, runs: [] };

  while (file.runs.length < wanted) {
    const started = Date.now();
    const clustering = await withRetry(() =>
      getProvider().clusterConcepts(set.items.map((i) => ({ adId: i.adId, dna: i.dna }))),
    );
    file.runs.push({ clustering, latencyMs: Date.now() - started });
    mkdirSync(LLM_RUNS_DIR, { recursive: true });
    writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
    console.log(`  llm run ${file.runs.length}/${wanted} for ${set.slug}`);
  }
  return file;
}

async function evaluateLlm(pairs: { set: ClusterableSet; label: LabelFile }[], runsWanted: number): Promise<SystemResult> {
  const perSet = [];
  let repairs = 0;
  let runs = 0;
  let latency = 0;
  for (const { set, label } of pairs) {
    const file = await ensureLlmRuns(set, runsWanted);
    const ids = set.items.map((i) => i.adId);
    const partitions = file.runs.slice(0, runsWanted).map((run) => {
      const repaired = llmToPartition(run.clustering, ids);
      repairs += repaired.repairs;
      runs++;
      latency += run.latencyMs;
      return repaired.partition;
    });
    perSet.push({ partitions, truth: label.groups });
  }

  // Score every run (not just the first) so the number reflects the LLM's average behaviour.
  const scored: { predicted: Partition; truth: Partition }[] = perSet.flatMap((s) =>
    s.partitions.map((predicted) => ({ predicted, truth: s.truth })),
  );
  return {
    system: "llm-only",
    ...scorePartitions(scored),
    stability: perSet.reduce((sum, s) => sum + stability(s.partitions), 0) / perSet.length,
    note: `${runs} runs, ${(repairs / runs).toFixed(2)} id repairs/run, ${Math.round(latency / runs)} ms/run`,
  };
}

function toLabelledSet(set: ClusterableSet, label: LabelFile, view: string): LabelledSet | null {
  const vectors = getSeedEmbeddings(set.slug)?.views[view];
  if (!vectors) return null;
  const ids = set.items.map((i) => i.adId);
  return { slug: set.slug, ids, similarity: similarityMatrix(ids.map((id) => vectors[id])), truth: label.groups };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(7);

async function main() {
  const pairs = loadLabelledPairs();
  if (pairs.length < 2) {
    console.error(`Need at least 2 labelled sets for leave-one-set-out (found ${pairs.length}). Run npm run label.`);
    process.exit(1);
  }
  const nAds = pairs.reduce((s, p) => s + p.set.items.length, 0);
  const nPairs = pairs.reduce((s, p) => s + (p.set.items.length * (p.set.items.length - 1)) / 2, 0);
  console.log(`${pairs.length} labelled sets, ${nAds} ads, ${nPairs} labelled pairs\n`);

  const results: SystemResult[] = [];
  const tuned: { view: string; threshold: number; heldOutF1: number }[] = [];

  for (const view of EMBEDDING_VIEWS) {
    const sets = pairs.map((p) => toLabelledSet(p.set, p.label, view));
    if (sets.some((s) => s === null)) {
      console.log(`skip embeddings:${view} (missing seed embeddings; run npm run embed-seed)`);
      continue;
    }
    const labelled = sets as LabelledSet[];
    const loso = leaveOneSetOut(labelled);
    const thresholds = loso.folds.map((f) => f.threshold);
    results.push({
      system: `embeddings:${view}`,
      ...loso.score,
      stability: 1, // pure function of stored vectors and τ
      note: `held-out τ ${Math.min(...thresholds)}–${Math.max(...thresholds)}`,
    });
    tuned.push({ view, threshold: tuneThreshold(labelled).threshold, heldOutF1: loso.score.f1 });
  }

  const llmRuns = argValue("--llm-runs", 3);
  if (llmRuns > 0) results.push(await evaluateLlm(pairs, llmRuns));

  console.log("system                 precision  recall      F1    ARI  stability  notes");
  for (const r of results) {
    console.log(
      `${r.system.padEnd(22)}${pct(r.precision)}${pct(r.recall).padStart(9)}${pct(r.f1).padStart(8)}` +
        `${r.meanAri.toFixed(2).padStart(7)}${r.stability.toFixed(2).padStart(11)}  ${r.note}`,
    );
  }

  const best = [...tuned].sort((a, b) => b.heldOutF1 - a.heldOutF1)[0];
  const embeddings = best && getSeedEmbeddings(pairs[0].set.slug);
  const output = {
    generatedAt: new Date().toISOString(),
    labelledSets: pairs.map((p) => ({ slug: p.set.slug, labeler: p.label.labeler, ads: p.set.items.length })),
    ads: nAds,
    pairs: nPairs,
    method: "Pairwise P/R/F1 micro-averaged over sets; embedding rows use leave-one-set-out τ; LLM rows average every run.",
    systems: results,
    // Read by /api/score. τ here is tuned on all labelled sets; the held-out F1 above is
    // the honest estimate of how it generalises.
    production: best && embeddings ? { view: best.view, threshold: best.threshold, model: embeddings.model, dimensions: embeddings.dimensions } : null,
  };
  mkdirSync(EVAL_DIR, { recursive: true });
  writeFileSync(RESULTS_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(`\nwrote ${RESULTS_PATH}${output.production ? ` (production: ${best.view} @ τ=${best.threshold})` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
