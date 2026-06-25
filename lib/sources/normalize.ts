import type { Ad } from "@/lib/types";

// Raw shapes from each source — normalized into the common Ad before leaving this layer.

export interface TikTokRawAd {
  id: string;
  advertiser_name: string;
  cover_image_url: string;
  ad_title: string;
  create_time: number; // unix seconds
  // TikTok CC doesn't expose last_seen directly; approximated as now
  metrics?: Record<string, unknown>;
}

export interface ApifyRawAd {
  id: string;
  page_name: string;
  snapshot_url?: string;
  ad_creative_body?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
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
  const firstSeen = raw.ad_delivery_start_time?.split("T")[0] ?? "";
  const lastSeen = raw.ad_delivery_stop_time?.split("T")[0] ?? new Date().toISOString().split("T")[0];
  const runDays =
    firstSeen && lastSeen
      ? Math.floor(
          (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

  return {
    id: `apify_${raw.id}`,
    source: "apify_meta",
    advertiser: raw.page_name,
    coverUrl: raw.snapshot_url ?? "",
    copy: raw.ad_creative_body ?? "",
    firstSeen,
    lastSeen,
    runDays,
    rawMetrics: {},
  };
}

export function sortByRunDays(ads: Ad[]): Ad[] {
  return [...ads].sort((a, b) => b.runDays - a.runDays);
}
