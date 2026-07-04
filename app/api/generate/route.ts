import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { withRetry } from "@/lib/cache";
import { getSeedBriefs, getSeedBriefClustering } from "@/lib/cache/seed";
import { angleBatchSchema, creativeDNAInputSchema, conceptClusteringInputSchema } from "@/lib/ai/schemas";
import { GENERATE_ANGLES_SYSTEM, buildGenerateAnglesPrompt } from "@/lib/ai/prompts/generate";
import { rateLimited } from "@/lib/rate-limit";
import type { CreativeDNA, ConceptClustering } from "@/lib/types";

// Generating ~10 briefs with platform variants can exceed the 10s default.
export const maxDuration = 60;

const requestSchema = z.object({
  vertical: z.string().min(1).max(100),
  winnerSummary: z.string().max(5_000),
  marketDNA: z.array(z.object({ adId: z.string().max(100), dna: creativeDNAInputSchema })).max(50),
  clustering: conceptClusteringInputSchema,
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { vertical, winnerSummary, marketDNA, clustering } = parsed.data as {
    vertical: string;
    winnerSummary: string;
    marketDNA: { adId: string; dna: CreativeDNA }[];
    clustering: ConceptClustering;
  };

  const slug = vertical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // Seed-first: a pre-baked seed vertical returns its briefs instantly (no live call).
  const seedBriefs = getSeedBriefs(slug);
  if (seedBriefs) {
    return NextResponse.json({
      briefs: seedBriefs,
      briefClustering: getSeedBriefClustering(slug),
      fromSeed: true,
    });
  }

  const limited = rateLimited(req);
  if (limited) return limited;

  const provider = getProvider();

  try {
    const batch = await withRetry(() =>
      provider.generateJSON({
        system: GENERATE_ANGLES_SYSTEM,
        prompt: buildGenerateAnglesPrompt({ vertical, marketDNA, winnerSummary, clustering }),
        schema: angleBatchSchema,
      }),
    );

    // Never trust model-cited ids: keep only evidenceAdIds that actually exist
    // in the market set we gave it.
    const validIds = new Set(marketDNA.map((m) => m.adId));
    const briefs = batch.briefs.map((b) => ({
      ...b,
      evidenceAdIds: (b.evidenceAdIds ?? []).filter((id) => validIds.has(id)),
    }));

    return NextResponse.json({ briefs, fromSeed: false });
  } catch (err) {
    console.error("[generate] error:", err);
    return NextResponse.json({ error: "Failed to generate angle briefs" }, { status: 500 });
  }
}
