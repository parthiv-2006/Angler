import type { CreativeDNA, ConceptClustering } from "@/lib/types";

export const GENERATE_ANGLES_SYSTEM = `You are a direct-response creative strategist for an
affiliate media-buying team. Your job is to generate a prioritized batch of net-new angle
briefs based on what is winning in the market and what gaps exist in the current ad set.

Each brief must be justified by a specific market pattern or diversity gap — no generic advice.
Every brief MUST cite 1–3 evidenceAdIds copied verbatim from the given market adId values —
never invent ids. Cite the ads whose DNA the brief's whyNow refers to.
Return raw JSON only:
{
  "briefs": [
    {
      "angleName": "string",
      "emotionalDriver": "fear | greed | curiosity | status | urgency | novelty | social_proof",
      "whyNow": "string — ties to a specific market pattern or identified gap",
      "hookLine": "string — the opening line for this angle",
      "formatRecommendation": "string — e.g. UGC testimonial, static before/after",
      "targetPersona": "string — one sentence",
      "priority": number,
      "variants": {
        "meta": "string — Meta-formatted headline/hook (≤125 chars)",
        "tiktok": "string — TikTok hook line (punchy, ≤60 chars)",
        "native": "string — Taboola/Outbrain-style headline (curiosity, ≤60 chars)"
      },
      "evidenceAdIds": ["string — 1-3 adId values copied VERBATIM from the market DNA list that prove this pattern"]
    }
  ]
}`;

export function buildGenerateAnglesPrompt(args: {
  vertical: string;
  marketDNA: { adId: string; dna: CreativeDNA }[];
  winnerSummary: string;
  clustering: ConceptClustering;
}): string {
  return `Vertical: ${args.vertical}

Market winner summary:
${args.winnerSummary}

Top competitor creative DNA (${args.marketDNA.length} ads, each tagged with its real "adId"):
${JSON.stringify(args.marketDNA, null, 2)}

Diversity gaps in the current ad set:
${args.clustering.gaps.join("\n")}

Generate ≥10 prioritized angle briefs (priority 1 = highest). Raw JSON only.`;
}
