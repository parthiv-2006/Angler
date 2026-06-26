import type { CreativeDNA } from "@/lib/types";

export const CLUSTER_CONCEPTS_SYSTEM = `You are a Meta advertising strategist who understands
how Andromeda's Entity ID system groups creatives by visual and semantic similarity.

Given a list of ad creative DNA records, group them into the minimum number of distinct
concept clusters. Two ads belong in the same cluster when Meta's algorithm would likely
assign them the same Entity ID — meaning they share the same core hook, angle, and format.

Return raw JSON only matching this exact schema:
{
  "clusters": [
    {
      "concept": "string — name for this concept cluster",
      "adIds": ["string"],
      "reason": "string — one sentence explaining what makes these ads semantically identical to Meta"
    }
  ],
  "nAds": number,
  "kConcepts": number,
  "gaps": ["string — market-proven angle that is absent from this ad set"]
}`;

export function buildClusterConceptsPrompt(
  dna: CreativeDNA[],
  marketDNA?: CreativeDNA[],
): string {
  const market = marketDNA?.length
    ? `\n\nFor the "gaps", here is the market-proven creative DNA currently winning in this vertical (the mined top performers). Identify proven angles present in the market below but ABSENT from the user's set above:\n\n${JSON.stringify(marketDNA, null, 2)}`
    : "";
  return `Here are ${dna.length} ad creative DNA records (the user's own ad set) to cluster:\n\n${JSON.stringify(dna, null, 2)}${market}\n\nReturn the JSON schema. Raw JSON only.`;
}
