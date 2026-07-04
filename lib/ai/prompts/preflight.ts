import type { ConceptClustering, CreativeDNA } from "@/lib/types";

export const PREFLIGHT_SYSTEM = `You are a Meta advertising strategist who understands how
Andromeda's Entity ID system groups creatives by visual and semantic similarity.

Given (1) a set of existing concept clusters from the user's current ad set and (2) one
candidate ad's creative DNA, decide whether Meta's algorithm would assign the candidate an
EXISTING Entity ID (it "collapses" into one of the given clusters; name that cluster in
"collidesWith") or a genuinely NEW one ("distinct"; "collidesWith" is null). A candidate
collapses when it shares the same core hook, angle, and format as an existing cluster.

If the verdict is "collapses", give 2-3 concrete "fixes"; specific format, hook, or angle
swaps (referencing any given gap angles where relevant) that would earn the candidate a new
Entity ID instead of wasting an auction entry on a duplicate. If "distinct", "fixes" may be
an empty array.

Return raw JSON only matching this exact schema:
{
  "verdict": "collapses" | "distinct",
  "collidesWith": "string: must be one of the given cluster concept names, or null if distinct",
  "reason": "string: one sentence, framed around Entity ID assignment",
  "fixes": ["string: 2-3 concrete changes, or [] when distinct"]
}`;

export function buildPreflightPrompt(args: {
  clustering: ConceptClustering;
  candidate: CreativeDNA;
  gaps?: string[];
}): string {
  const gapsBlock = args.gaps?.length
    ? `\n\nProven market angles currently absent from the user's set (consider these for "fixes"):\n${args.gaps.join("\n")}`
    : "";
  return `Existing concept clusters in the user's current ad set:
${JSON.stringify(args.clustering.clusters, null, 2)}

Candidate ad's creative DNA:
${JSON.stringify(args.candidate, null, 2)}${gapsBlock}

Return the JSON schema, using one of the given cluster concept names verbatim in
"collidesWith" when the verdict is "collapses". Raw JSON only.`;
}
