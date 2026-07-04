import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrFetchAds, withRetry } from "@/lib/cache";
import { getSeedAds, getSeedWinnerSummary } from "@/lib/cache/seed";
import { rateLimited } from "@/lib/rate-limit";
import { fetchTikTokAds } from "@/lib/sources/tiktok-creative-center";
import { fetchMetaAds } from "@/lib/sources/apify";
import { sortByRunDays } from "@/lib/sources/normalize";
import type { Ad } from "@/lib/types";

// Live scraping (TikTok retry → Apify poll) can run long; raise above the default.
export const maxDuration = 60;

const requestSchema = z.object({
  vertical: z.string().min(1).max(100),
});

async function getOrCreateVertical(slug: string, displayName: string) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return { id: `local_${slug}`, slug, display_name: displayName, is_seed: false };
  }
  const { findOrCreateVertical } = await import("@/lib/db/queries");
  return findOrCreateVertical(slug, displayName);
}

// Best-effort live pull for novel verticals. Apify's Facebook Ad Library actor is
// the primary source (real, public, no login). The TikTok Creative Center call is a
// commented-out last resort: its public endpoint now requires a signed token and
// returns 40101 for anonymous demo traffic (see tiktok-creative-center.ts).
// Seed verticals never reach here; the cache layer serves them first.
async function fetchLiveAds(vertical: string): Promise<Ad[]> {
  if (process.env.APIFY_TOKEN) {
    try {
      // No withRetry here: each attempt starts a NEW paid actor run, and one
      // full poll cycle already uses most of the route's 60s budget.
      const ads = await fetchMetaAds(vertical);
      if (ads.length > 0) return ads;
    } catch (err) {
      console.error("[mine] Apify source failed:", err);
    }
  }

  // Last resort; kept wired but expected to fail anonymously (signed-token guard):
  try {
    return await withRetry(() => fetchTikTokAds(vertical));
  } catch (err) {
    console.error("[mine] TikTok Creative Center fallback failed:", err);
    return [];
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { vertical } = parsed.data;
  const slug = vertical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (!slug) {
    return NextResponse.json({ error: "Enter a vertical with at least one letter or number" }, { status: 400 });
  }

  // Seed verticals are free to serve; only novel ones (live scrape spend) are metered.
  if (!getSeedAds(slug)) {
    const limited = rateLimited(req);
    if (limited) return limited;
  }

  let ads: Ad[] = [];
  try {
    const verticalRow = await getOrCreateVertical(slug, vertical);
    ads = await getOrFetchAds(slug, verticalRow.id, () => fetchLiveAds(vertical));
  } catch (err) {
    console.error("[mine] live sources unavailable:", err);
    ads = [];
  }

  // Graceful degradation: never surface a raw error to the judge. If live sources
  // returned nothing, steer them to the instant seed verticals.
  if (ads.length === 0) {
    return NextResponse.json({
      ads: [],
      winnerSummary: null,
      fromSeed: false,
      unavailable: true,
      message:
        "Live sources didn't return results for this vertical right now. Try one of the instant demo verticals (Weight-Loss, Debt Relief, ED Telehealth).",
    });
  }

  return NextResponse.json({
    ads: sortByRunDays(ads),
    winnerSummary: getSeedWinnerSummary(slug),
    fromSeed: !!getSeedWinnerSummary(slug),
  });
}
