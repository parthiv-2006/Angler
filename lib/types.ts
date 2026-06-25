// Shared domain types consumed across all modules.
// Each module's route handler returns a strict subset or extension of these.

export interface Ad {
  id: string;
  source: string;
  advertiser: string;
  coverUrl: string;
  copy: string;
  firstSeen: string;
  lastSeen: string;
  runDays: number;
  rawMetrics: Record<string, unknown>;
}

export interface CreativeDNA {
  hookType: string;
  angle: string;
  format: string;
  offerFraming: string;
  ctaStyle: string;
  targetPersona: string;
  oneLineSummary: string;
}

export interface ConceptCluster {
  concept: string;
  adIds: string[];
  reason: string;
}

export interface ConceptClustering {
  clusters: ConceptCluster[];
  nAds: number;
  kConcepts: number;
  gaps: string[];
}

export interface AngleBrief {
  angleName: string;
  emotionalDriver: string;
  whyNow: string;
  hookLine: string;
  formatRecommendation: string;
  targetPersona: string;
  priority: number;
  variants: {
    meta: string;
    tiktok: string;
    native: string;
  };
}
