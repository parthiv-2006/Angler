import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";
import { withRetry } from "@/lib/cache";
import type { CreativeDNA } from "@/lib/types";

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
  dna: z.array(creativeDNASchema).min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { dna } = parsed.data as { dna: CreativeDNA[] };
  const provider = getProvider();

  try {
    const clustering = await withRetry(() => provider.clusterConcepts(dna));
    return NextResponse.json({ clustering });
  } catch (err) {
    console.error("[score] error:", err);
    return NextResponse.json({ error: "Failed to score diversity" }, { status: 500 });
  }
}
