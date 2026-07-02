import type { AngleBrief, CreativeDNA } from "@/lib/types";

// Represent a generated brief as a CreativeDNA record so the existing
// concept-clustering pipeline can score the batch's own diversity.
export function briefToDNA(brief: AngleBrief, index: number): { adId: string; dna: CreativeDNA } {
  return {
    adId: `brief_${String(index + 1).padStart(2, "0")}`,
    dna: {
      hookType: brief.hookLine,
      angle: brief.emotionalDriver,
      format: brief.formatRecommendation,
      offerFraming: brief.whyNow,
      ctaStyle: "n/a (brief)",
      targetPersona: brief.targetPersona,
      oneLineSummary: `${brief.angleName}: ${brief.hookLine}`,
    },
  };
}
