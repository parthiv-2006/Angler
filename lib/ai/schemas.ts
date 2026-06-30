import { z } from "zod";

export const creativeDNASchema = z.object({
  hookType: z.string(),
  angle: z.string(),
  format: z.string(),
  offerFraming: z.string(),
  ctaStyle: z.string(),
  targetPersona: z.string(),
  oneLineSummary: z.string(),
});

export const conceptClusterSchema = z.object({
  concept: z.string(),
  adIds: z.array(z.string()),
  reason: z.string(),
});

export const conceptClusteringSchema = z.object({
  clusters: z.array(conceptClusterSchema),
  nAds: z.number(),
  kConcepts: z.number(),
  gaps: z.array(z.string()),
});

export const angleBriefSchema = z.object({
  angleName: z.string(),
  emotionalDriver: z.string(),
  whyNow: z.string(),
  hookLine: z.string(),
  formatRecommendation: z.string(),
  targetPersona: z.string(),
  priority: z.number(),
  variants: z.object({
    meta: z.string(),
    tiktok: z.string(),
    native: z.string(),
  }),
});

export const angleBatchSchema = z.object({
  briefs: z.array(angleBriefSchema),
});

export const winnerSummarySchema = z.object({
  summary: z.string(),
});
