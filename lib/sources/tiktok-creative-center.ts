import type { Ad } from "@/lib/types";
import { normalizeTikTokAd, type TikTokRawAd } from "./normalize";

const BASE_URL = "https://ads.tiktok.com/creative_radar_api/v1/top_ads/v2/list";

interface TikTokCCResponse {
  data?: {
    materials?: TikTokRawAd[];
  };
}

export async function fetchTikTokAds(vertical: string): Promise<Ad[]> {
  const params = new URLSearchParams({
    period: "7",
    page: "1",
    limit: "30",
    industry_id: "", // caller can pass industry_id once we map verticals → IDs
    keyword: vertical,
  });

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`TikTok Creative Center returned ${response.status}`);
  }

  const json: TikTokCCResponse = await response.json();
  const materials = json.data?.materials ?? [];
  return materials.map(normalizeTikTokAd);
}
