import type { CreativeDNA, ConceptClustering } from "@/lib/types";

export const GENERATE_ANGLES_SYSTEM = `You are a direct-response creative strategist for an
affiliate media-buying team. Your job is to generate a prioritized batch of net-new angle
briefs based on what is winning in the market and what gaps exist in the current ad set.

Each brief must be justified by a specific market pattern or diversity gap — no generic advice.
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
      }
    }
  ]
}`;

export function buildGenerateAnglesPrompt(args: {
  vertical: string;
  marketDNA: CreativeDNA[];
  winnerSummary: string;
  clustering: ConceptClustering;
}): string {
  return `Vertical: ${args.vertical}

Market winner summary:
${args.winnerSummary}

Top competitor creative DNA (${args.marketDNA.length} ads):
${JSON.stringify(args.marketDNA, null, 2)}

Diversity gaps in the current ad set:
${args.clustering.gaps.join("\n")}

Generate ≥10 prioritized angle briefs (priority 1 = highest). Raw JSON only.`;
}
