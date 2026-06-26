import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { getOrAnalyzeDNA, withRetry } from "@/lib/cache";

// Live vision analysis over a batch of ads can exceed the 10s default.
export const maxDuration = 60;

const adInputSchema = z.object({
  id: z.string(),
  coverUrl: z.string().optional(),
  copy: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const requestSchema = z.object({
  ads: z.array(adInputSchema).min(1).max(30),
  vertical: z.string().optional(), // slug used to hit seed DNA cache
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { ads, vertical = "" } = parsed.data;
  const slug = vertical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const provider = getProvider();

  try {
    const results = await Promise.all(
      ads.map(async (ad) => {
        const dna = await getOrAnalyzeDNA(
          ad.id,
          slug,
          "competitor",
          () =>
            withRetry(() =>
              provider.analyzeCreative({
                imageUrl: ad.coverUrl,
                copy: ad.copy,
                metadata: ad.metadata,
              }),
            ),
          process.env.AI_PROVIDER ?? "anthropic",
        );
        return { adId: ad.id, dna };
      }),
    );

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[deconstruct] error:", err);
    return NextResponse.json({ error: "Failed to analyze creatives" }, { status: 500 });
  }
}
