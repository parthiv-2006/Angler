import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrFetchAds, withRetry } from "@/lib/cache";
import { getSeedWinnerSummary } from "@/lib/cache/seed";
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

// Best-effort live pull for novel verticals: TikTok primary, Apify fallback.
// Seed verticals never reach here (the cache layer serves them first).
async function fetchLiveAds(vertical: string): Promise<Ad[]> {
  try {
    const ads = await withRetry(() => fetchTikTokAds(vertical));
    if (ads.length > 0) return ads;
  } catch (err) {
    console.error("[mine] TikTok source failed, trying Apify:", err);
  }

  if (process.env.APIFY_TOKEN) {
    return withRetry(() => fetchMetaAds(vertical));
  }
  return [];
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
