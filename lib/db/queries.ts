import type { Ad, CreativeDNA } from "@/lib/types";
import type { VerticalRow, CompetitorAdRow, CreativeDNARow } from "./types";
import { getDbClient } from "./client";

// ── Verticals ────────────────────────────────────────────────────────────────

export async function findOrCreateVertical(
  slug: string,
  displayName: string,
): Promise<VerticalRow> {
  const db = getDbClient();

  const { data: existing } = await db
    .from("verticals")
    .select("*")
    .eq("slug", slug)
    .single();

  if (existing) return existing as VerticalRow;

  const { data, error } = await db
    .from("verticals")
    .insert({ slug, display_name: displayName, is_seed: false })
    .select()
    .single();

  if (error) throw error;
  return data as VerticalRow;
}

// ── Competitor ads (cache layer for Module 1) ─────────────────────────────────

export async function getCachedAds(verticalId: string): Promise<Ad[] | null> {
  const db = getDbClient();

  const { data } = await db
    .from("competitor_ads")
    .select("*")
    .eq("vertical_id", verticalId)
    .order("run_days", { ascending: false });

  if (!data || data.length === 0) return null;

  return (data as CompetitorAdRow[]).map((row) => ({
    id: row.id,
    source: row.source,
    advertiser: row.advertiser,
    coverUrl: row.cover_url,
    copy: row.copy,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    runDays: row.run_days,
    rawMetrics: row.raw_metrics,
  }));
}

export async function cacheAds(verticalId: string, ads: Ad[]): Promise<void> {
  const db = getDbClient();

  const rows = ads.map((ad) => ({
    vertical_id: verticalId,
    source: ad.source,
    advertiser: ad.advertiser,
    cover_url: ad.coverUrl,
    copy: ad.copy,
    first_seen: ad.firstSeen,
    last_seen: ad.lastSeen,
    run_days: ad.runDays,
    raw_metrics: ad.rawMetrics,
  }));

  const { error } = await db.from("competitor_ads").insert(rows);
  if (error) throw error;
}

// ── Creative DNA (cache layer for Module 2) ───────────────────────────────────

export async function getCachedDNA(adId: string): Promise<CreativeDNA | null> {
  // adId is an app-generated string (fb_*, tiktok_*, paste_*, upload_*,
  // preflight_*), not a UUID — creative_dna.ad_id is `text` (see migration 002).
  const db = getDbClient();

  const { data } = await db
    .from("creative_dna")
    .select("*")
    .eq("ad_id", adId)
    .single();

  if (!data) return null;

  const row = data as CreativeDNARow;
  return {
    hookType: row.hook_type,
    angle: row.angle,
    format: row.format,
    offerFraming: row.offer_framing,
    ctaStyle: row.cta_style,
    targetPersona: row.target_persona,
    oneLineSummary: row.one_line_summary,
  };
}

export async function cacheDNA(
  adId: string,
  adKind: "competitor" | "uploaded",
  dna: CreativeDNA,
  model: string,
): Promise<void> {
  const db = getDbClient();

  const { error } = await db.from("creative_dna").insert({
    ad_id: adId,
    ad_kind: adKind,
    hook_type: dna.hookType,
    angle: dna.angle,
    format: dna.format,
    offer_framing: dna.offerFraming,
    cta_style: dna.ctaStyle,
    target_persona: dna.targetPersona,
    one_line_summary: dna.oneLineSummary,
    model,
  });

  if (error) throw error;
}
