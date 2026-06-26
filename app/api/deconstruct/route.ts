import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { getOrAnalyzeDNA, withRetry } from "@/lib/cache";

const adInputSchema = z.object({
  id: z.string(),
  coverUrl: z.string().optional(),
  copy: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const requestSchema = z.object({
  ads: z.array(adInputSchema).min(1).max(30),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { ads } = parsed.data;
  const provider = getProvider();

  try {
    const results = await Promise.all(
      ads.map(async (ad) => {
        const dna = await getOrAnalyzeDNA(
          ad.id,
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
