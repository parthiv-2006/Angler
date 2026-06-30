import type { CreativeDNA } from "@/lib/types";

export const WINNER_SUMMARY_SYSTEM = `You are a direct-response creative strategist for an
affiliate media-buying team. Given the creative DNA of the longest-running (and therefore
most-proven) competitor ads in a vertical, write a tight "what's winning right now and why"
summary for a media buyer.

Call out the dominant angles, hooks, and formats, and explain WHY they convert in this
vertical — concrete patterns, not generic advice. Two or three sentences, no preamble.
Return raw JSON only:
{ "summary": "string" }`;

export function buildWinnerSummaryPrompt(args: {
  vertical: string;
  marketDNA: CreativeDNA[];
}): string {
  return `Vertical: ${args.vertical}

Creative DNA of the top competitor ads (${args.marketDNA.length}), ranked by run duration:
${JSON.stringify(args.marketDNA, null, 2)}

Write the "what's winning and why" summary. Raw JSON only.`;
}
