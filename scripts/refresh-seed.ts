/**
 * Build-time seed refresh — regenerates data/seed/<slug>.json (and the Module-3
 * sample sets) from REAL ads pulled via Apify's Facebook Ad Library actor.
 *
 * This is an offline tool. It is NEVER imported by a route. Cached *real* data is
 * explicitly allowed by the contest; fabricated data is not. Run it once per
 * vertical, commit the resulting JSON, and the live demo serves it instantly.
 *
 *   npm run refresh-seed                          # all verticals
 *   npm run refresh-seed weight-loss-supplement   # one vertical
 *
 * Guardrails (FREE tiers):
 *  - Apify is PAY_PER_EVENT → one small run per vertical; raw output cached locally
 *    so re-deriving DNA never re-scrapes.
 *  - Gemini free tier is ~10 RPM AND ~20 requests/day PER MODEL. To fit, all DNA for
 *    a vertical is extracted in ONE batched call, every AI artifact (DNA, summary,
 *    clustering, briefs) is cached to scripts/.cache/state-<slug>.json, and an
 *    already-real seed file pre-seeds that cache — so a re-run costs only what's
 *    missing. Pick the model bucket with `GEMINI_MODEL=gemini-2.5-flash-lite`.
 */
import dotenv from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

dotenv.config({ path: ".env.local" });

import { getProvider } from "@/lib/ai/provider";
import { fetchMetaAdsRaw } from "@/lib/sources/apify";
import { normalizeApifyAd, sortByRunDays, type ApifyRawAd } from "@/lib/sources/normalize";
import { creativeDNASchema, winnerSummarySchema, angleBatchSchema } from "@/lib/ai/schemas";
import { ANALYZE_CREATIVE_SYSTEM } from "@/lib/ai/prompts/analyze";
import { WINNER_SUMMARY_SYSTEM, buildWinnerSummaryPrompt } from "@/lib/ai/prompts/summary";
import { GENERATE_ANGLES_SYSTEM, buildGenerateAnglesPrompt } from "@/lib/ai/prompts/generate";
import type { Ad, CreativeDNA, ConceptClustering, AngleBrief } from "@/lib/types";

// ── Config ──────────────────────────────────────────────────────────────────────

interface VerticalConfig {
  slug: string;
  display: string;
  query: string; // Ad Library keyword
  sampleSlug?: string; // Module-3 sample set to rebuild, if any
}

const VERTICALS: VerticalConfig[] = [
  { slug: "weight-loss-supplement", display: "Weight-Loss Supplement", query: "weight loss", sampleSlug: "weight-loss-redundant" },
  { slug: "debt-relief", display: "Debt Relief", query: "debt relief", sampleSlug: "debt-relief-redundant" },
  { slug: "ed-telehealth", display: "ED Telehealth", query: "erectile dysfunction" },
];

const SCRAPE_COUNT = 40; // raw ads to request from Apify (one run per vertical)
const MARKET_SIZE = 15; // top ads (by run duration) kept as the market winners
const SAMPLE_SIZE = 8; // ads in the Module-3 "your ad set" sample
const THROTTLE_MS = 6000; // stay under Gemini's ~10 RPM free limit

const ROOT = process.cwd();
const SEED_DIR = join(ROOT, "data", "seed");
const SAMPLE_DIR = join(SEED_DIR, "samples");
const CACHE_DIR = join(ROOT, "scripts", ".cache");

// ── Small utilities ───────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Gemini's free tier throws transient 503 ("high demand") and RPM-429 spikes that
// can last a minute. Retry those with long backoff. But a *daily* quota exhaustion
// (or a model with no free allocation) can't be waited out within a run — bail fast.
async function robustAI<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const maxAttempts = 7;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const e = err as { status?: number; message?: string };
      const msg = String(e.message ?? err);
      const dailyExhausted = /PerDay|GenerateRequestsPerDay|limit: 0/.test(msg);
      if (dailyExhausted || i === maxAttempts - 1) throw err;
      const wait = Math.min(5000 * 2 ** i, 60000) + Math.random() * 1000;
      console.log(`  [retry] ${label} ${e.status ?? ""} — attempt ${i + 1}, waiting ${Math.round(wait / 1000)}s…`);
      await sleep(wait);
    }
  }
  throw new Error("unreachable");
}

function readJSON<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf-8")) as T) : null;
}

function writeJSON(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

// ── Resumable per-vertical AI cache ─────────────────────────────────────────────

interface VerticalState {
  dna: Record<string, CreativeDNA>;
  summary?: string;
  briefs?: AngleBrief[];
  sampleClustering?: ConceptClustering;
}

interface SeedFileShape {
  vertical: { slug: string; display_name: string; is_seed: boolean };
  ads: Ad[];
  dna: { adId: string; dna: CreativeDNA }[];
  winnerSummary: string;
  briefs?: AngleBrief[];
}

function statePath(slug: string): string {
  return join(CACHE_DIR, `state-${slug}.json`);
}

// Load the AI cache, pre-seeding it from an already-real seed file so a re-run
// never re-spends quota on artifacts we already produced.
function loadState(slug: string): VerticalState {
  const state = readJSON<VerticalState>(statePath(slug)) ?? { dna: {} };

  // Back-compat with the earlier per-ad dna cache file.
  const legacyDna = readJSON<Record<string, CreativeDNA>>(join(CACHE_DIR, `dna-${slug}.json`));
  if (legacyDna) state.dna = { ...legacyDna, ...state.dna };

  const seed = readJSON<SeedFileShape>(join(SEED_DIR, `${slug}.json`));
  const isReal = seed?.ads?.[0]?.source === "facebook_ad_library";
  if (seed && isReal) {
    for (const { adId, dna } of seed.dna) state.dna[adId] ??= dna;
    state.summary ??= seed.winnerSummary;
    if (seed.briefs?.length) state.briefs ??= seed.briefs;
  }
  return state;
}

function saveState(slug: string, state: VerticalState): void {
  writeJSON(statePath(slug), state);
}

// ── Stage 1: real ads (Apify, cached) ───────────────────────────────────────────

async function getRawAds(v: VerticalConfig): Promise<ApifyRawAd[]> {
  const cachePath = join(CACHE_DIR, `raw-${v.slug}.json`);
  const cached = readJSON<ApifyRawAd[]>(cachePath);
  if (cached) {
    console.log(`  [scrape] using cached raw (${cached.length} items) — no Apify spend`);
    return cached;
  }
  console.log(`  [scrape] running Apify for "${v.query}" (count=${SCRAPE_COUNT})…`);
  const raw = await fetchMetaAdsRaw(v.query, SCRAPE_COUNT);
  writeJSON(cachePath, raw);
  console.log(`  [scrape] got ${raw.length} raw items → cached`);
  return raw;
}

// Real, usable ads: non-empty human copy + advertiser, de-duped by advertiser so a
// single page can't dominate, sorted by run duration (longevity = winning signal).
function usableAds(raw: ApifyRawAd[]): Ad[] {
  const seenAdvertiser = new Set<string>();
  const ads: Ad[] = [];
  for (const ad of sortByRunDays(raw.map(normalizeApifyAd))) {
    if (!ad.copy || ad.copy.length < 15 || !ad.advertiser) continue;
    if (seenAdvertiser.has(ad.advertiser)) continue;
    seenAdvertiser.add(ad.advertiser);
    ads.push(ad);
  }
  return ads;
}

// ── Stage 2: DNA for every ad in ONE batched call (quota-frugal) ─────────────────

const batchDnaSchema = z.object({
  results: z.array(creativeDNASchema.extend({ id: z.string() })),
});

async function analyzeAll(slug: string, state: VerticalState, ads: Ad[]): Promise<void> {
  const missing = ads.filter((a) => !state.dna[a.id]);
  if (missing.length === 0) {
    console.log(`  [dna] all ${ads.length} ads already analyzed (cache)`);
    return;
  }

  console.log(`  [dna] batch-analyzing ${missing.length} ads in one call…`);
  const prompt = `${ANALYZE_CREATIVE_SYSTEM}

Analyze EACH ad below and return raw JSON only in this exact shape — one entry per
input id, no extra keys:
{ "results": [ { "id": "<id>", ...all DNA fields for that ad } ] }

Ads:
${missing.map((a) => `[${a.id}] ${a.copy}`).join("\n\n")}`;

  const { results } = await robustAI("dna-batch", () =>
    getProvider().generateJSON({
      system: "You are a direct-response creative strategist analyzing a batch of ads.",
      prompt,
      schema: batchDnaSchema,
    }),
  );

  const byId = new Map(results.map((r) => [r.id, r]));
  for (const ad of missing) {
    const r = byId.get(ad.id);
    if (!r) throw new Error(`Batch DNA missing result for ${ad.id}`);
    const { id: _id, ...dna } = r;
    state.dna[ad.id] = dna;
  }
  saveState(slug, state);
  await sleep(THROTTLE_MS);
}

// ── Stage 3: vertical seed (market winners, summary, briefs) ─────────────────────

async function buildVerticalSeed(
  v: VerticalConfig,
  state: VerticalState,
  marketAds: Ad[],
): Promise<void> {
  const provider = getProvider();
  const marketDNA = marketAds.map((a) => state.dna[a.id]).filter(Boolean) as CreativeDNA[];
  const marketDNAWithIds = marketAds
    .map((a) => ({ adId: a.id, dna: state.dna[a.id] }))
    .filter((x): x is { adId: string; dna: CreativeDNA } => Boolean(x.dna));

  if (!state.summary) {
    console.log(`  [summary] generating "what's winning" summary…`);
    const { summary } = await robustAI("summary", () =>
      provider.generateJSON({
        system: WINNER_SUMMARY_SYSTEM,
        prompt: buildWinnerSummaryPrompt({ vertical: v.display, marketDNA }),
        schema: winnerSummarySchema,
      }),
    );
    state.summary = summary;
    saveState(v.slug, state);
    await sleep(THROTTLE_MS);
  }

  if (!state.briefs) {
    console.log(`  [briefs] clustering market DNA for gaps…`);
    const marketClustering = await robustAI("market-cluster", () => provider.clusterConcepts(marketDNAWithIds));
    await sleep(THROTTLE_MS);

    console.log(`  [briefs] generating net-new angle briefs…`);
    const { briefs } = await robustAI("briefs", () =>
      provider.generateJSON({
        system: GENERATE_ANGLES_SYSTEM,
        prompt: buildGenerateAnglesPrompt({
          vertical: v.display,
          marketDNA,
          winnerSummary: state.summary!,
          clustering: marketClustering,
        }),
        schema: angleBatchSchema,
      }),
    );
    state.briefs = briefs as AngleBrief[];
    saveState(v.slug, state);
    await sleep(THROTTLE_MS);
  }

  const seedFile: SeedFileShape = {
    vertical: { slug: v.slug, display_name: v.display, is_seed: true },
    ads: marketAds,
    dna: marketAds.map((a) => ({ adId: a.id, dna: state.dna[a.id] })),
    winnerSummary: state.summary!,
    briefs: state.briefs!,
  };
  writeJSON(join(SEED_DIR, `${v.slug}.json`), seedFile);
  console.log(`  [seed] wrote data/seed/${v.slug}.json (${marketAds.length} ads, ${state.briefs!.length} briefs)`);
}

// ── Stage 4: Module-3 sample set (the user's "own ad set") ───────────────────────

// Pick ads whose DNA signature repeats, so the "N ads → K concepts" collapse stays
// visible — a real selection from real ads, not fabricated redundancy.
function pickSampleAds(pool: Ad[], dna: Record<string, CreativeDNA>): Ad[] {
  const buckets = new Map<string, Ad[]>();
  for (const ad of pool) {
    const d = dna[ad.id];
    if (!d) continue;
    const sig = `${d.hookType}|${d.angle}|${d.format}`;
    (buckets.get(sig) ?? buckets.set(sig, []).get(sig)!).push(ad);
  }
  const ordered = [...buckets.values()].sort((a, b) => b.length - a.length);
  const picked: Ad[] = [];
  for (const bucket of ordered) {
    for (const ad of bucket) {
      if (picked.length >= SAMPLE_SIZE) break;
      picked.push(ad);
    }
  }
  return picked.slice(0, SAMPLE_SIZE);
}

async function buildSampleSet(
  v: VerticalConfig,
  state: VerticalState,
  pool: Ad[],
  marketDNA: CreativeDNA[],
): Promise<void> {
  if (!v.sampleSlug) return;
  const existingPath = join(SAMPLE_DIR, `${v.sampleSlug}.json`);
  const existing = readJSON<{ slug: string; label: string; vertical: string }>(existingPath);
  if (!existing) {
    console.log(`  [sample] no existing ${v.sampleSlug}.json — skipping`);
    return;
  }

  const picked = pickSampleAds(pool, state.dna);
  const abbr = v.slug.split("-").map((w) => w[0]).join("");

  // Real copy from real ads, presented as the user's own set (clearly labelled
  // "Your Ad Set"). DNA is reused from the already-analyzed pool (same copy → no
  // extra AI spend), re-keyed to the sample ad ids.
  const sampleAds: Ad[] = picked.map((ad, i) => ({
    ...ad,
    id: `own_${abbr}_${String(i + 1).padStart(2, "0")}`,
    source: "uploaded",
    advertiser: "Your Ad Set",
  }));
  const sampleDNA = sampleAds.map((ad, i) => ({ adId: ad.id, dna: state.dna[picked[i].id] }));

  if (!state.sampleClustering) {
    console.log(`  [sample] clustering ${sampleAds.length} ads against the market…`);
    state.sampleClustering = await robustAI("sample-cluster", () =>
      getProvider().clusterConcepts(sampleDNA, marketDNA),
    );
    saveState(v.slug, state);
    await sleep(THROTTLE_MS);
  }

  const sampleFile = {
    slug: existing.slug,
    label: existing.label,
    vertical: existing.vertical,
    ads: sampleAds,
    dna: sampleDNA,
    clustering: state.sampleClustering,
  };
  writeJSON(existingPath, sampleFile);
  console.log(
    `  [sample] wrote ${v.sampleSlug}.json (${sampleAds.length} ads → ${state.sampleClustering.kConcepts} concepts)`,
  );
}

// ── Orchestration ─────────────────────────────────────────────────────────────

async function refreshVertical(v: VerticalConfig): Promise<void> {
  console.log(`\n=== ${v.display} (${v.slug}) ===`);
  const state = loadState(v.slug);
  const raw = await getRawAds(v);
  const pool = usableAds(raw);
  console.log(`  [filter] ${pool.length} usable ads from ${raw.length} raw`);
  if (pool.length < SAMPLE_SIZE) {
    console.warn(`  [warn] only ${pool.length} usable ads — thin vertical, consider swapping the query`);
  }

  await analyzeAll(v.slug, state, pool);
  const marketAds = pool.slice(0, MARKET_SIZE);
  await buildVerticalSeed(v, state, marketAds);

  const marketDNA = marketAds.map((a) => state.dna[a.id]).filter(Boolean) as CreativeDNA[];
  await buildSampleSet(v, state, pool, marketDNA);
}

async function main() {
  if (!process.env.APIFY_TOKEN) throw new Error("APIFY_TOKEN is not set (check .env.local)");
  mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`Provider: ${getProvider().constructor.name} | model: ${process.env.GEMINI_MODEL ?? "default"}`);

  const only = process.argv[2];
  const targets = only ? VERTICALS.filter((v) => v.slug === only) : VERTICALS;
  if (targets.length === 0) throw new Error(`No vertical matches "${only}"`);

  for (const v of targets) await refreshVertical(v);
  console.log("\n✓ Seed refresh complete.");
}

main().catch((err) => {
  console.error("\nrefresh-seed FAILED:", err);
  process.exit(1);
});
