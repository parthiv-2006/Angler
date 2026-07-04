import type { CreativeDNA } from "@/lib/types";

export const ANALYZE_CREATIVE_SYSTEM = `You are a direct-response creative strategist.
Analyze the provided ad creative (image and/or copy) and return a JSON object matching
this exact schema; no extra keys, no markdown fencing, raw JSON only:

{
  "hookType": "question | bold_claim | callout | pattern_interrupt | problem_agitation | other",
  "angle": "fear | greed | curiosity | status | urgency | novelty | social_proof | other",
  "format": "ugc | testimonial | founder | static | demo | listicle | other",
  "offerFraming": "discount | free_trial | risk_reversal | scarcity | social_proof | other",
  "ctaStyle": "string: e.g. 'Shop Now', 'Learn More', 'Get 50% Off'",
  "targetPersona": "string: one sentence describing who this ad is talking to",
  "oneLineSummary": "string: one sentence capturing the core angle and why it would convert"
}`;

export function buildAnalyzeCreativePrompt(
  copy?: string,
  metadata?: Record<string, unknown>,
): string {
  const parts: string[] = [];
  if (copy) parts.push(`Ad copy:\n${copy}`);
  if (metadata && Object.keys(metadata).length > 0) {
    parts.push(`Metadata:\n${JSON.stringify(metadata, null, 2)}`);
  }
  parts.push("Return the JSON schema described in the system prompt. Raw JSON only.");
  return parts.join("\n\n");
}

export type { CreativeDNA };
