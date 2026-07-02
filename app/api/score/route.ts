import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { withRetry } from "@/lib/cache";
import { getSampleClustering } from "@/lib/cache/seed";
import type { CreativeDNA } from "@/lib/types";

// Live clustering can run long on a cold model; raise above the 10s default.
export const maxDuration = 60;

// Cap how many DNA records we cluster live so a novel set can't blow the budget.
const LIVE_BATCH_CAP = 20;

const creativeDNASchema = z.object({
  hookType: z.string(),
  angle: z.string(),
  format: z.string(),
  offerFraming: z.string(),
  ctaStyle: z.string(),
  targetPersona: z.string(),
  oneLineSummary: z.string(),
});

const requestSchema = z.object({
  dna: z.array(z.object({ adId: z.string(), dna: creativeDNASchema })).min(0),
  // Mined market winners (Modules 1–2) used to ground the gap analysis.
  marketDNA: z.array(creativeDNASchema).optional(),
  // When the user loads a pre-baked sample ad set, its clustering is served instantly.
  sampleSetId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { dna, marketDNA, sampleSetId } = parsed.data as {
    dna: { adId: string; dna: CreativeDNA }[];
    marketDNA?: CreativeDNA[];
    sampleSetId?: string;
  };

  // Seed-first: a known sample ad set returns its pre-baked clustering instantly.
  if (sampleSetId) {
    const seedClustering = getSampleClustering(sampleSetId);
    if (seedClustering) {
      return NextResponse.json({ clustering: seedClustering, fromSeed: true });
    }
  }

  const provider = getProvider();

  try {
    const clustering = await withRetry(() =>
      provider.clusterConcepts(dna.slice(0, LIVE_BATCH_CAP), marketDNA),
    );
    return NextResponse.json({ clustering, fromSeed: false });
  } catch (err) {
    console.error("[score] error:", err);
    return NextResponse.json({ error: "Failed to score diversity" }, { status: 500 });
  }
}
