import type { Ad, CreativeDNA } from "@/lib/types";
import { getSeedAds, getSeedDNA } from "./seed";

// Returns true when Supabase env vars are present.
function hasSupabase(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function getCachedAds(verticalId: string): Promise<Ad[] | null> {
  if (!hasSupabase()) return null;
  const { getCachedAds: dbGet } = await import("@/lib/db/queries");
  return dbGet(verticalId);
}

async function cacheAds(verticalId: string, ads: Ad[]): Promise<void> {
  if (!hasSupabase()) return;
  const { cacheAds: dbSet } = await import("@/lib/db/queries");
  await dbSet(verticalId, ads);
}

async function getCachedDNA(adId: string): Promise<CreativeDNA | null> {
  if (!hasSupabase()) return null;
  const { getCachedDNA: dbGet } = await import("@/lib/db/queries");
  return dbGet(adId);
}

async function cacheDNA(
  adId: string,
  adKind: "competitor" | "uploaded",
  dna: CreativeDNA,
  model: string,
): Promise<void> {
  if (!hasSupabase()) return;
  const { cacheDNA: dbSet } = await import("@/lib/db/queries");
  await dbSet(adId, adKind, dna, model);
}

// ── Concurrency guard ─────────────────────────────────────────────────────────
//
// Within a single warm serverless instance, two near-simultaneous requests for the
// same key (e.g. a double-click, or two judges hitting the same novel vertical at
// once) would otherwise both miss the cache and both pay for a live fetch/analysis.
// This single-flight map makes the second caller await the first's in-flight
// promise instead, so the cache is always preferred over a redundant live call.
const inFlight = new Map<string, Promise<unknown>>();

async function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getOrFetchAds(
  slug: string,
  verticalId: string,
  fetcher: () => Promise<Ad[]>,
): Promise<Ad[]> {
  // 1. Seed file (instant — always checked first for seed verticals)
  const seedAds = getSeedAds(slug);
  if (seedAds) return seedAds;

  // 2. Supabase cache
  const cached = await getCachedAds(verticalId);
  if (cached) return cached;

  // 3. Live fetch + write-through (deduped across concurrent requests for this vertical)
  return dedupe(`ads:${verticalId}`, async () => {
    const fresh = await fetcher();
    await cacheAds(verticalId, fresh).catch(console.error);
    return fresh;
  });
}

export async function getOrAnalyzeDNA(
  adId: string,
  slug: string,
  adKind: "competitor" | "uploaded",
  analyzer: () => Promise<CreativeDNA>,
  model: string,
): Promise<CreativeDNA> {
  // 1. Seed DNA map
  const seedDNAMap = getSeedDNA(slug);
  if (seedDNAMap?.has(adId)) return seedDNAMap.get(adId)!;

  // 2. Supabase cache
  const cached = await getCachedDNA(adId);
  if (cached) return cached;

  // 3. Live analysis + write-through (deduped across concurrent requests for this ad)
  return dedupe(`dna:${adId}`, async () => {
    const fresh = await analyzer();
    await cacheDNA(adId, adKind, fresh, model).catch(console.error);
    return fresh;
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // 4xx (except throttling/timeout) means the request itself is bad —
      // retrying burns budget without ever succeeding.
      const status = (err as { status?: number }).status;
      const retryable =
        status === undefined || status === 408 || status === 429 || status >= 500;
      if (!retryable || attempt === maxAttempts - 1) throw err;

      const delayMs = Math.min(1000 * 2 ** attempt + Math.random() * 200, 10_000);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError;
}
