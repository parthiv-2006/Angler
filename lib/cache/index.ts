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

  // 3. Live fetch + write-through
  const fresh = await fetcher();
  await cacheAds(verticalId, fresh).catch(console.error);
  return fresh;
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

  // 3. Live analysis + write-through
  const fresh = await analyzer();
  await cacheDNA(adId, adKind, fresh, model).catch(console.error);
  return fresh;
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
      const delayMs = Math.min(1000 * 2 ** attempt + Math.random() * 200, 10_000);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError;
}
