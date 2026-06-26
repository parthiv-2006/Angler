import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrFetchAds, withRetry } from "@/lib/cache";
import { getSeedWinnerSummary } from "@/lib/cache/seed";
import { fetchTikTokAds } from "@/lib/sources/tiktok-creative-center";
import { sortByRunDays } from "@/lib/sources/normalize";

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

  try {
    const verticalRow = await getOrCreateVertical(slug, vertical);

    const ads = await getOrFetchAds(slug, verticalRow.id, () =>
      withRetry(() => fetchTikTokAds(vertical)),
    );

    const winnerSummary = getSeedWinnerSummary(slug) ?? null;

    return NextResponse.json({
      vertical: verticalRow,
      ads: sortByRunDays(ads),
      winnerSummary,
      fromSeed: !!getSeedWinnerSummary(slug),
    });
  } catch (err) {
    console.error("[mine] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch competitor ads" },
      { status: 500 },
    );
  }
}
