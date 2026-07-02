import { NextRequest, NextResponse } from "next/server";
import { listSampleSets, getSampleSet } from "@/lib/cache/seed";

// Lists the pre-baked sample ad sets (Module 3), or returns one in full (?slug=).
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ samples: listSampleSets() });
  }

  const set = getSampleSet(slug);
  if (!set) {
    return NextResponse.json({ error: "Sample set not found" }, { status: 404 });
  }

  // Clustering is intentionally omitted — /api/score is the source of truth for it.
  return NextResponse.json({
    slug: set.slug,
    label: set.label,
    vertical: set.vertical,
    ads: set.ads,
    dna: set.dna,
    preflightExamples: (set.preflightExamples ?? []).map((e) => ({ id: e.id, label: e.label })),
  });
}
