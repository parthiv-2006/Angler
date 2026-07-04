import type { Ad } from "@/lib/types";

// Raw shapes from each source; normalized into the common Ad before leaving this layer.

export interface TikTokRawAd {
  id: string;
  advertiser_name: string;
  cover_image_url: string;
  ad_title: string;
  create_time: number; // unix seconds
  // TikTok CC doesn't expose last_seen directly; approximated as now
  metrics?: Record<string, unknown>;
}

// Real output shape of the curious_coder~facebook-ads-library-scraper actor
// (locked against a live trial run; only the fields we consume are typed).
export interface ApifyRawAd {
  ad_archive_id?: string;
  page_name?: string;
  is_active?: boolean;
  start_date?: number; // unix seconds
  end_date?: number; // unix seconds
  snapshot?: {
    body?: { text?: string } | string | null;
    link_description?: string | null;
    title?: string | null;
    cta_text?: string | null;
    images?: { original_image_url?: string; resized_image_url?: string }[] | null;
  } | null;
}

// Meta's Ad Library returns dynamic-creative placeholders like "{{product.brand}}"
// for some ads; useless as copy. Returns the best human-readable copy, or "".
function bestCopy(snapshot: ApifyRawAd["snapshot"]): string {
  const body =
    typeof snapshot?.body === "string" ? snapshot.body : snapshot?.body?.text;
  for (const candidate of [body, snapshot?.link_description, snapshot?.title]) {
    const text = candidate?.trim();
    if (text && !/^\{\{.*\}\}$/.test(text)) return text;
  }
  return "";
}

// Ads missing an archive id would otherwise all collide on the id "fb_",
// cross-contaminating the DNA cache and React keys. Derive a stable stand-in
// from the ad's content instead (djb2 over advertiser + copy).
function contentKey(raw: ApifyRawAd): string {
  const text = `${raw.page_name ?? ""}|${bestCopy(raw.snapshot)}`;
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return `noid_${hash.toString(36)}`;
}

function dateOnly(unixSeconds?: number): string {
  if (!unixSeconds) return "";
  return new Date(unixSeconds * 1000).toISOString().split("T")[0];
}

export function normalizeTikTokAd(raw: TikTokRawAd): Ad {
  const firstSeen = new Date(raw.create_time * 1000).toISOString().split("T")[0];
  const lastSeen = new Date().toISOString().split("T")[0];
  const runDays = Math.floor(
    (Date.now() - raw.create_time * 1000) / (1000 * 60 * 60 * 24),
  );

  return {
    id: `tiktok_${raw.id}`,
    source: "tiktok_creative_center",
    advertiser: raw.advertiser_name,
    coverUrl: raw.cover_image_url,
    copy: raw.ad_title,
    firstSeen,
    lastSeen,
    runDays,
    rawMetrics: raw.metrics ?? {},
  };
}

export function normalizeApifyAd(raw: ApifyRawAd): Ad {
  const firstSeen = dateOnly(raw.start_date);
  // Active ads have a future scheduled end_date; longevity is now − start.
  // Inactive ads use their real end_date.
  const lastSeenMs = raw.is_active
    ? Date.now()
    : (raw.end_date ?? raw.start_date ?? 0) * 1000;
  const lastSeen = new Date(lastSeenMs).toISOString().split("T")[0];
  const runDays = raw.start_date
    ? Math.max(
        0,
        Math.floor((lastSeenMs - raw.start_date * 1000) / (1000 * 60 * 60 * 24)),
      )
    : 0;

  const image = raw.snapshot?.images?.[0];
  return {
    id: `fb_${raw.ad_archive_id ?? contentKey(raw)}`,
    source: "facebook_ad_library",
    advertiser: raw.page_name ?? "",
    coverUrl: image?.resized_image_url ?? image?.original_image_url ?? "",
    copy: bestCopy(raw.snapshot),
    firstSeen,
    lastSeen,
    runDays,
    rawMetrics: {},
  };
}

export function sortByRunDays(ads: Ad[]): Ad[] {
  return [...ads].sort((a, b) => b.runDays - a.runDays);
}
