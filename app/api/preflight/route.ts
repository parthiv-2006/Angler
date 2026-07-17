import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { withRetry } from "@/lib/cache";
import { getPreflightExample } from "@/lib/cache/seed";
import { preflightVerdictSchema, creativeDNAInputSchema, conceptClusteringInputSchema } from "@/lib/ai/schemas";
import { PREFLIGHT_SYSTEM, buildPreflightPrompt } from "@/lib/ai/prompts/preflight";
import { budgetExceeded, underDailyCap } from "@/lib/budget";
import { rateLimited } from "@/lib/rate-limit";
import type { ConceptClustering, CreativeDNA } from "@/lib/types";

// Live pre-flight scoring can run long on a cold model; raise above the 10s default.
export const maxDuration = 60;

const requestSchema = z.object({
  // Seed path: a pre-baked example candidate on a known sample set.
  sampleSetId: z.string().max(100).optional(),
  candidateId: z.string().max(100).optional(),
  // Live path: candidate DNA (client obtains it via /api/deconstruct first).
  clustering: conceptClusteringInputSchema.optional(),
  candidate: creativeDNAInputSchema.optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { sampleSetId, candidateId, clustering, candidate } = parsed.data as {
    sampleSetId?: string;
    candidateId?: string;
    clustering?: ConceptClustering;
    candidate?: CreativeDNA;
  };

  // Seed-first: a pre-baked example on a known sample set returns instantly.
  if (sampleSetId && candidateId) {
    const example = getPreflightExample(sampleSetId, candidateId);
    if (!example) {
      return NextResponse.json({ error: "Pre-flight example not found" }, { status: 404 });
    }
    return NextResponse.json({ verdict: example.verdict, ad: example.ad, fromSeed: true });
  }

  if (!clustering || !candidate) {
    return NextResponse.json(
      { error: "clustering and candidate are required for a live pre-flight check" },
      { status: 400 },
    );
  }

  const limited = rateLimited(req);
  if (limited) return limited;
  if (!(await underDailyCap())) return budgetExceeded();

  const provider = getProvider();

  try {
    const verdict = await withRetry(() =>
      provider.generateJSON({
        system: PREFLIGHT_SYSTEM,
        prompt: buildPreflightPrompt({ clustering, candidate, gaps: clustering.gaps }),
        schema: preflightVerdictSchema,
      }),
    );

    // Never render a hallucinated cluster name: if it collapses, collidesWith must
    // be one of the clusters we actually gave the model.
    const validNames = new Set(clustering.clusters.map((c) => c.concept));
    const collidesWith =
      verdict.verdict === "collapses"
        ? (verdict.collidesWith && validNames.has(verdict.collidesWith)
            ? verdict.collidesWith
            : (clustering.clusters[0]?.concept ?? null))
        : null;

    return NextResponse.json({ verdict: { ...verdict, collidesWith }, fromSeed: false });
  } catch (err) {
    console.error("[preflight] error:", err);
    return NextResponse.json({ error: "Failed to run pre-flight check" }, { status: 500 });
  }
}
