import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { getOrAnalyzeDNA, withRetry } from "@/lib/cache";
import { winnerSummarySchema } from "@/lib/ai/schemas";
import { getSeedDNA } from "@/lib/cache/seed";
import { rateLimited } from "@/lib/rate-limit";
import { WINNER_SUMMARY_SYSTEM, buildWinnerSummaryPrompt } from "@/lib/ai/prompts/summary";

// Live vision analysis over a batch of ads can exceed the 10s default.
export const maxDuration = 60;

const adInputSchema = z
  .object({
    id: z.string().min(1).max(100),
    coverUrl: z.string().url().max(2_048).optional(),
    // ~2MB of binary — client-side compression targets well under this.
    imageBase64: z.string().max(3_000_000).optional(),
    copy: z.string().max(10_000).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((ad) => ad.copy || ad.imageBase64 || ad.coverUrl, {
    message: "Each ad needs copy, an image, or a cover URL to analyze",
  });

const requestSchema = z.object({
  ads: z.array(adInputSchema).min(1).max(30),
  vertical: z.string().max(100).optional(), // slug used to hit seed DNA cache
  generateSummary: z.boolean().optional(), // synthesize a "what's winning" summary (novel verticals)
  adKind: z.enum(["competitor", "uploaded"]).optional().default("competitor"),
});

// Uploaded/pasted ads reuse client-side ids like "paste_0" across users, so caching
// their DNA by ad id would serve one user's analysis for another user's caption.
// Key those by a hash of the actual content instead — all provided fields, delimited,
// so e.g. two ads with identical copy but different images can't collide. Competitor
// ads keep their stable library ids.
type AdInput = z.infer<typeof adInputSchema>;

function cacheKeyFor(ad: AdInput, adKind: "competitor" | "uploaded"): string {
  if (adKind !== "uploaded") return ad.id;
  const content = JSON.stringify([ad.copy ?? "", ad.imageBase64 ?? "", ad.coverUrl ?? ""]);
  return `upl_${createHash("sha256").update(content).digest("hex").slice(0, 24)}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { ads, vertical = "", generateSummary = false, adKind } = parsed.data;
  const slug = vertical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // A request fully answerable from committed seed DNA costs nothing — keep the
  // judge's demo path unmetered and only rate-limit requests that can reach a
  // paid model call.
  const seedDNA = adKind === "competitor" && !generateSummary ? getSeedDNA(slug) : null;
  const fullySeeded = !!seedDNA && ads.every((ad) => seedDNA.has(ad.id));
  if (!fullySeeded) {
    const limited = rateLimited(req);
    if (limited) return limited;
  }

  const provider = getProvider();

  try {
    const results = await Promise.all(
      ads.map(async (ad) => {
        const dna = await getOrAnalyzeDNA(
          cacheKeyFor(ad, adKind),
          slug,
          adKind,
          () =>
            withRetry(() =>
              provider.analyzeCreative({
                imageUrl: ad.coverUrl,
                imageBase64: ad.imageBase64,
                copy: ad.copy,
                metadata: ad.metadata,
              }),
            ),
          process.env.AI_PROVIDER ?? "anthropic",
        );
        return { adId: ad.id, dna };
      }),
    );

    // For novel verticals (no seed winner summary), synthesize one from the DNA.
    // Gated by the caller so the seed path never triggers an AI call.
    let winnerSummary: string | null = null;
    if (generateSummary && results.length > 0) {
      try {
        const out = await withRetry(() =>
          provider.generateJSON({
            system: WINNER_SUMMARY_SYSTEM,
            prompt: buildWinnerSummaryPrompt({ vertical, marketDNA: results.map((r) => r.dna) }),
            schema: winnerSummarySchema,
          }),
        );
        winnerSummary = out.summary;
      } catch (err) {
        console.error("[deconstruct] summary generation failed:", err);
      }
    }

    return NextResponse.json({ results, winnerSummary });
  } catch (err) {
    console.error("[deconstruct] error:", err);
    return NextResponse.json({ error: "Failed to analyze creatives" }, { status: 500 });
  }
}
