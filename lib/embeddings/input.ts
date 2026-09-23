import type { CreativeDNA } from "@/lib/types";

// Which text represents an ad in embedding space. The eval compares all three, and
// the production path uses whichever scores best against human labels.
export const EMBEDDING_VIEWS = ["copy", "dna", "copy+dna"] as const;
export type EmbeddingView = (typeof EMBEDDING_VIEWS)[number];

export interface EmbeddingInput {
  text: string;
  imageBase64?: string;
  imageMediaType?: string; // defaults to image/jpeg
}

export function dnaToText(dna: CreativeDNA): string {
  return [
    `Hook: ${dna.hookType}`,
    `Angle: ${dna.angle}`,
    `Format: ${dna.format}`,
    `Offer: ${dna.offerFraming}`,
    `CTA: ${dna.ctaStyle}`,
    `Persona: ${dna.targetPersona}`,
    `Summary: ${dna.oneLineSummary}`,
  ].join("\n");
}

export function buildEmbeddingText(copy: string, dna: CreativeDNA, view: EmbeddingView): string {
  const trimmedCopy = copy.trim();
  if (view === "copy") return trimmedCopy || dna.oneLineSummary;
  if (view === "dna") return dnaToText(dna);
  return trimmedCopy ? `${trimmedCopy}\n\n${dnaToText(dna)}` : dnaToText(dna);
}
