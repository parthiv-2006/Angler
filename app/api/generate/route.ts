import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { withRetry } from "@/lib/cache";
import { getSeedBriefs } from "@/lib/cache/seed";
import { angleBatchSchema } from "@/lib/ai/schemas";
import { GENERATE_ANGLES_SYSTEM, buildGenerateAnglesPrompt } from "@/lib/ai/prompts/generate";
import type { CreativeDNA, ConceptClustering } from "@/lib/types";

// Generating ~10 briefs with platform variants can exceed the 10s default.
export const maxDuration = 60;

const requestSchema = z.object({
  vertical: z.string().min(1),
  winnerSummary: z.string(),
  marketDNA: z.array(z.object({
    hookType: z.string(),
    angle: z.string(),
    format: z.string(),
    offerFraming: z.string(),
    ctaStyle: z.string(),
    targetPersona: z.string(),
    oneLineSummary: z.string(),
  })),
  clustering: z.object({
    clusters: z.array(z.object({
      concept: z.string(),
      adIds: z.array(z.string()),
      reason: z.string(),
    })),
    nAds: z.number(),
    kConcepts: z.number(),
    gaps: z.array(z.string()),
  }),
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
    marketDNA: CreativeDNA[];
    clustering: ConceptClustering;
  };

  const slug = vertical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // Seed-first: a pre-baked seed vertical returns its briefs instantly (no live call).
  const seedBriefs = getSeedBriefs(slug);
  if (seedBriefs) {
    return NextResponse.json({ briefs: seedBriefs, fromSeed: true });
  }

  const provider = getProvider();

  try {
    const batch = await withRetry(() =>
      provider.generateJSON({
        system: GENERATE_ANGLES_SYSTEM,
        prompt: buildGenerateAnglesPrompt({ vertical, marketDNA, winnerSummary, clustering }),
        schema: angleBatchSchema,
      }),
    );

    return NextResponse.json({ briefs: batch.briefs, fromSeed: false });
  } catch (err) {
    console.error("[generate] error:", err);
    return NextResponse.json({ error: "Failed to generate angle briefs" }, { status: 500 });
  }
}
