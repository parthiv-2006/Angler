// Generated from the Supabase schema defined in ARCHITECTURE.md.
// Regenerate with: supabase gen types typescript --linked > lib/db/types.ts

export interface VerticalRow {
  id: string;
  slug: string;
  display_name: string;
  is_seed: boolean;
  created_at: string;
}

export interface CompetitorAdRow {
  id: string;
  vertical_id: string;
  source: string;
  advertiser: string;
  cover_url: string;
  copy: string;
  first_seen: string;
  last_seen: string;
  run_days: number;
  raw_metrics: Record<string, unknown>;
  fetched_at: string;
}

export interface CreativeDNARow {
  id: string;
  ad_id: string;
  ad_kind: "competitor" | "uploaded";
  hook_type: string;
  angle: string;
  format: string;
  offer_framing: string;
  cta_style: string;
  target_persona: string;
  one_line_summary: string;
  model: string;
  created_at: string;
}

export interface UploadedSetRow {
  id: string;
  label: string;
  created_at: string;
}

export interface UploadedAdRow {
  id: string;
  set_id: string;
  cover_url: string;
  copy: string;
}

export interface DiversityReportRow {
  id: string;
  set_id: string;
  vertical_id: string | null;
  n_ads: number;
  k_concepts: number;
  clusters: unknown;
  gaps: unknown;
  created_at: string;
}

export interface AngleBatchRow {
  id: string;
  vertical_id: string;
  set_id: string | null;
  briefs: unknown;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      verticals: {
        Row: VerticalRow;
        Insert: Omit<VerticalRow, "id" | "created_at">;
        Update: Partial<Omit<VerticalRow, "id" | "created_at">>;
      };
      competitor_ads: {
        Row: CompetitorAdRow;
        Insert: Omit<CompetitorAdRow, "id" | "fetched_at">;
        Update: Partial<Omit<CompetitorAdRow, "id" | "fetched_at">>;
      };
      creative_dna: {
        Row: CreativeDNARow;
        Insert: Omit<CreativeDNARow, "id" | "created_at">;
        Update: Partial<Omit<CreativeDNARow, "id" | "created_at">>;
      };
      uploaded_sets: {
        Row: UploadedSetRow;
        Insert: Omit<UploadedSetRow, "id" | "created_at">;
        Update: Partial<Omit<UploadedSetRow, "id" | "created_at">>;
      };
      uploaded_ads: {
        Row: UploadedAdRow;
        Insert: Omit<UploadedAdRow, "id">;
        Update: Partial<Omit<UploadedAdRow, "id">>;
      };
      diversity_reports: {
        Row: DiversityReportRow;
        Insert: Omit<DiversityReportRow, "id" | "created_at">;
        Update: Partial<Omit<DiversityReportRow, "id" | "created_at">>;
      };
      angle_batches: {
        Row: AngleBatchRow;
        Insert: Omit<AngleBatchRow, "id" | "created_at">;
        Update: Partial<Omit<AngleBatchRow, "id" | "created_at">>;
      };
    };
  };
}
