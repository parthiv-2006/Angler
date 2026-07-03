import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import type { Ad, CreativeDNA, ConceptClustering, AngleBrief, PreflightVerdict } from "@/lib/types";

interface SeedFile {
  vertical: {
    slug: string;
    display_name: string;
    is_seed: boolean;
  };
  ads: Ad[];
  dna: { adId: string; dna: CreativeDNA }[];
  winnerSummary: string;
  // Pre-baked Module 4 output so the seed demo path never calls the live AI.
  briefs?: AngleBrief[];
  // Self-scored diversity of the generated brief batch itself ("dog food").
  briefClustering?: ConceptClustering;
}

// A user's "own" ad set for the diversity scorer (Module 3). Deliberately
// redundant so the "N ads → K concepts" collapse is visible. Clustering is
// pre-baked so the seed demo path is instant and deterministic.
// A pre-baked "planned ad" the pre-flight check (Module 3.5) can score instantly
// against this sample set's clustering — real ad copy, real model verdict.
interface PreflightExample {
  id: string;
  label: string;
  ad: Ad;
  dna: CreativeDNA;
  verdict: PreflightVerdict;
}

interface SampleSetFile {
  slug: string;
  label: string;
  vertical: string; // slug of the market vertical the gaps are relative to
  ads: Ad[];
  dna: { adId: string; dna: CreativeDNA }[];
  clustering: ConceptClustering;
  preflightExamples?: PreflightExample[];
}

const SEED_DIR = join(process.cwd(), "data", "seed");
const SAMPLE_DIR = join(SEED_DIR, "samples");

function loadSeedFile(slug: string): SeedFile | null {
  const filePath = join(SEED_DIR, `${slug}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8")) as SeedFile;
}

function loadSampleFile(slug: string): SampleSetFile | null {
  const filePath = join(SAMPLE_DIR, `${slug}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8")) as SampleSetFile;
}

// ── Vertical seeds (Modules 1, 2, 4) ────────────────────────────────────────────

export function getSeedAds(slug: string): Ad[] | null {
  const seed = loadSeedFile(slug);
  return seed?.ads ?? null;
}

export function getSeedDNA(slug: string): Map<string, CreativeDNA> | null {
  const seed = loadSeedFile(slug);
  if (!seed) return null;
  return new Map(seed.dna.map((entry) => [entry.adId, entry.dna]));
}

export function getSeedWinnerSummary(slug: string): string | null {
  return loadSeedFile(slug)?.winnerSummary ?? null;
}

export function getSeedBriefs(slug: string): AngleBrief[] | null {
  return loadSeedFile(slug)?.briefs ?? null;
}

export function getSeedBriefClustering(slug: string): ConceptClustering | null {
  return loadSeedFile(slug)?.briefClustering ?? null;
}

export function listSeedSlugs(): string[] {
  if (!existsSync(SEED_DIR)) return [];
  return readdirSync(SEED_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

export interface SeedVerticalSummary {
  slug: string;
  displayName: string;
  adCount: number;
}

export function listSeedVerticals(): SeedVerticalSummary[] {
  return listSeedSlugs()
    .map((slug) => loadSeedFile(slug))
    .filter((seed): seed is SeedFile => seed !== null)
    .map((seed) => ({
      slug: seed.vertical.slug,
      displayName: seed.vertical.display_name,
      adCount: seed.ads.length,
    }));
}

// ── Sample ad sets (Module 3) ───────────────────────────────────────────────────

export interface SampleSetSummary {
  slug: string;
  label: string;
  vertical: string;
  adCount: number;
  preflightExamples: { id: string; label: string }[];
}

export function getSampleClustering(slug: string): ConceptClustering | null {
  return loadSampleFile(slug)?.clustering ?? null;
}

export function getSampleSet(slug: string): SampleSetFile | null {
  return loadSampleFile(slug);
}

export function getPreflightExample(
  sampleSlug: string,
  candidateId: string,
): { ad: Ad; verdict: PreflightVerdict } | null {
  const example = loadSampleFile(sampleSlug)?.preflightExamples?.find((e) => e.id === candidateId);
  return example ? { ad: example.ad, verdict: example.verdict } : null;
}

export function listSampleSets(): SampleSetSummary[] {
  if (!existsSync(SAMPLE_DIR)) return [];
  return readdirSync(SAMPLE_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadSampleFile(f.replace(".json", "")))
    .filter((s): s is SampleSetFile => s !== null)
    .map((s) => ({
      slug: s.slug,
      label: s.label,
      vertical: s.vertical,
      adCount: s.ads.length,
      preflightExamples: (s.preflightExamples ?? []).map((e) => ({ id: e.id, label: e.label })),
    }));
}
