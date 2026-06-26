import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findOrCreateVertical } from "@/lib/db/queries";
import { getOrFetchAds, withRetry } from "@/lib/cache";
import { fetchTikTokAds } from "@/lib/sources/tiktok-creative-center";
import { sortByRunDays } from "@/lib/sources/normalize";

const requestSchema = z.object({
  vertical: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { vertical } = parsed.data;
  const slug = vertical.toLowerCase().replace(/\s+/g, "-");

  try {
    const verticalRow = await findOrCreateVertical(slug, vertical);

    const ads = await getOrFetchAds(verticalRow.id, () =>
      withRetry(() => fetchTikTokAds(vertical)),
    );

    return NextResponse.json({ vertical: verticalRow, ads: sortByRunDays(ads) });
  } catch (err) {
    console.error("[mine] error:", err);
    return NextResponse.json({ error: "Failed to fetch competitor ads" }, { status: 500 });
  }
}
