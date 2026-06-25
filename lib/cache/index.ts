import type { Ad, CreativeDNA } from "@/lib/types";
import { getCachedAds, cacheAds, getCachedDNA, cacheDNA } from "@/lib/db/queries";

// Thin write-through cache over Supabase.
// Seed verticals (is_seed=true) are pre-populated at build time from data/seed/.

export async function getOrFetchAds(
  verticalId: string,
  fetcher: () => Promise<Ad[]>,
): Promise<Ad[]> {
  const cached = await getCachedAds(verticalId);
  if (cached) return cached;

  const fresh = await fetcher();
  await cacheAds(verticalId, fresh).catch(console.error); // best-effort write
  return fresh;
}

export async function getOrAnalyzeDNA(
  adId: string,
  adKind: "competitor" | "uploaded",
  analyzer: () => Promise<CreativeDNA>,
  model: string,
): Promise<CreativeDNA> {
  const cached = await getCachedDNA(adId);
  if (cached) return cached;

  const fresh = await analyzer();
  await cacheDNA(adId, adKind, fresh, model).catch(console.error); // best-effort write
  return fresh;
}

// Exponential backoff retry — wraps any async function
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
