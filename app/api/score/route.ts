import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { withRetry } from "@/lib/cache";
import { getSampleClustering } from "@/lib/cache/seed";
import { creativeDNAInputSchema } from "@/lib/ai/schemas";
import { budgetExceeded, underDailyCap } from "@/lib/budget";
import { rateLimited } from "@/lib/rate-limit";
import type { CreativeDNA } from "@/lib/types";

// Live clustering can run long on a cold model; raise above the 10s default.
export const maxDuration = 60;

// Cap how many DNA records we cluster live so a novel set can't blow the budget.
const LIVE_BATCH_CAP = 20;

const requestSchema = z.object({
  // min(0) so the seed path can send an empty array alongside sampleSetId.
  dna: z.array(z.object({ adId: z.string().max(100), dna: creativeDNAInputSchema })).min(0).max(50),
  // Mined market winners (Modules 1–2) used to ground the gap analysis.
  marketDNA: z.array(creativeDNAInputSchema).max(50).optional(),
  // When the user loads a pre-baked sample ad set, its clustering is served instantly.
  sampleSetId: z.string().max(100).optional(),
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

  // Nothing to cluster; fail fast instead of paying for a pointless model call.
  if (dna.length === 0) {
    return NextResponse.json({ error: "dna must contain at least one ad" }, { status: 400 });
  }

  const limited = rateLimited(req);
  if (limited) return limited;
  if (!(await underDailyCap())) return budgetExceeded();

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
