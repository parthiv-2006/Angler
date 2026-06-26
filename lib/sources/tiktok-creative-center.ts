import type { Ad } from "@/lib/types";
import { normalizeTikTokAd, type TikTokRawAd } from "./normalize";

// TikTok Creative Center public top-ads endpoint (no login required).
// Returns top-performing ads ranked by CTR/engagement for a keyword + time period.
const BASE_URL = "https://ads.tiktok.com/creative_radar_api/v1/top_ads/v2/list";

interface TikTokCCResponse {
  code?: number;
  data?: {
    materials?: TikTokRawAd[];
    pagination?: { total_count: number };
  };
  msg?: string;
}

export async function fetchTikTokAds(vertical: string): Promise<Ad[]> {
  const params = new URLSearchParams({
    period: "30",       // look-back window in days
    page: "1",
    limit: "20",
    keyword: vertical,
    order_by: "vv",     // sort by video views as winning signal proxy
  });

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    },
    // Don't cache at the fetch level — the route's cache layer handles this
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TikTok Creative Center HTTP ${response.status}`);
  }

  const json: TikTokCCResponse = await response.json();

  if (json.code !== 0 && json.code !== undefined) {
    throw new Error(`TikTok Creative Center API error: ${json.msg ?? json.code}`);
  }

  const materials = json.data?.materials ?? [];
  return materials.map(normalizeTikTokAd);
}
