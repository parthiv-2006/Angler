import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { fetchImageAsBase64 } from "@/lib/ai/image";
import { getOrAnalyzeDNA, withRetry } from "@/lib/cache";
import { winnerSummarySchema } from "@/lib/ai/schemas";
import { getSeedDNA } from "@/lib/cache/seed";
import { budgetExceeded, underDailyCap } from "@/lib/budget";
import { rateLimited } from "@/lib/rate-limit";
import { WINNER_SUMMARY_SYSTEM, buildWinnerSummaryPrompt } from "@/lib/ai/prompts/summary";

// Live vision analysis over a batch of ads plus the winner summary runs
// ~40s on the live path; give it headroom under Fluid compute's 300s ceiling.
export const maxDuration = 120;

const adInputSchema = z
  .object({
    id: z.string().min(1).max(100),
    coverUrl: z.string().url().max(2_048).optional(),
    // ~2MB of binary; client-side compression targets well under this.
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
// Key those by a hash of the actual content instead; all provided fields, delimited,
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

  // A request fully answerable from committed seed DNA costs nothing; keep the
  // judge's demo path unmetered and only rate-limit requests that can reach a
  // paid model call.
  const seedDNA = adKind === "competitor" && !generateSummary ? getSeedDNA(slug) : null;
  const fullySeeded = !!seedDNA && ads.every((ad) => seedDNA.has(ad.id));
  if (!fullySeeded) {
    const limited = rateLimited(req);
    if (limited) return limited;
    if (!(await underDailyCap())) return budgetExceeded();
  }

  const provider = getProvider();

  try {
    // Per-ad isolation: one unanalyzable ad (expired/blocked image, model
    // hiccup) degrades to a smaller result set instead of failing the batch.
    const settled = await Promise.all(
      ads.map(async (ad) => {
        try {
          const dna = await getOrAnalyzeDNA(
            cacheKeyFor(ad, adKind),
            slug,
            adKind,
            async () => {
              // Resolve the cover URL to inline bytes only on a cache miss;
              // CDNs 403 non-browser fetchers, so providers can't fetch it.
              const image = ad.imageBase64
                ? { base64: ad.imageBase64, mediaType: "image/jpeg" }
                : ad.coverUrl
                  ? await fetchImageAsBase64(ad.coverUrl)
                  : null;
              if (!image && !ad.copy) {
                throw new Error("no analyzable content (image unreachable, no copy)");
              }
              return withRetry(() =>
                provider.analyzeCreative({
                  imageBase64: image?.base64,
                  imageMediaType: image?.mediaType,
                  copy: ad.copy,
                  metadata: ad.metadata,
                }),
              );
            },
            process.env.AI_PROVIDER ?? "anthropic",
          );
          return { adId: ad.id, dna };
        } catch (err) {
          console.error(`[deconstruct] ad ${ad.id} failed:`, err);
          return null;
        }
      }),
    );
    const results = settled.filter((r): r is NonNullable<typeof r> => r !== null);

    if (results.length === 0) {
      return NextResponse.json({ error: "Failed to analyze creatives" }, { status: 500 });
    }

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
