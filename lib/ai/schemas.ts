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
  // Real ad ids from the mined market set that evidence this angle's "whyNow".
  // Default [] keeps old seed files and live responses from failing validation.
  evidenceAdIds: z.array(z.string()).default([]),
});

export const angleBatchSchema = z.object({
  briefs: z.array(angleBriefSchema),
});

export const winnerSummarySchema = z.object({
  summary: z.string(),
});

// Request-boundary variants of the schemas above. Model *output* stays
// unbounded (a valid response must never fail validation on length), but
// client-supplied input gets sane size caps so a crafted request can't feed
// megabytes of text into a paid model call.
const boundedString = z.string().max(1_000);

export const creativeDNAInputSchema = z.object({
  hookType: boundedString,
  angle: boundedString,
  format: boundedString,
  offerFraming: boundedString,
  ctaStyle: boundedString,
  targetPersona: boundedString,
  oneLineSummary: boundedString,
});

export const conceptClusteringInputSchema = z.object({
  clusters: z
    .array(
      z.object({
        concept: boundedString,
        adIds: z.array(z.string().max(100)).max(100),
        reason: boundedString,
      }),
    )
    .max(50),
  nAds: z.number().int().min(0).max(1_000),
  kConcepts: z.number().int().min(0).max(1_000),
  gaps: z.array(boundedString).max(50),
});

export const preflightVerdictSchema = z.object({
  verdict: z.enum(["collapses", "distinct"]),
  collidesWith: z.string().nullable(), // concept name from the existing clustering, or null
  reason: z.string(),                  // one sentence, Entity-ID framing
  fixes: z.array(z.string()),          // 2-3 concrete changes to earn a new Entity ID
});
