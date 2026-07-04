import type { Ad } from "@/lib/types";
import { normalizeApifyAd, type ApifyRawAd } from "./normalize";

const APIFY_BASE = "https://api.apify.com/v2";

// Public, maintained Facebook Ad Library actor. Search-URL oriented (the right fit
// for keyword mining) with ~15M runs. Output is flat (advertiser/body at top level).
// Fallback (page-centric, output nested under pageInfo.page.name): apify~facebook-ads-scraper
const META_ACTOR_ID = "curious_coder~facebook-ads-library-scraper";

// Build a public Meta Ad Library *search* URL for a keyword. Both real actors take
// Ad Library URLs (not `searchTerms`), so the keyword is encoded into the URL.
function buildAdLibraryUrl(vertical: string): string {
  const params = new URLSearchParams({
    active_status: "active",
    ad_type: "all",
    country: "US",
    q: vertical,
    search_type: "keyword_unordered",
    media_type: "all",
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

// Run the actor and return the RAW dataset items (untyped). Exposed so the build-time
// seed-refresh script can persist raw output and re-derive DNA without re-scraping.
export async function fetchMetaAdsRaw(
  vertical: string,
  count = 30,
  pollAttempts?: number,
): Promise<ApifyRawAd[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");

  const runRes = await fetch(`${APIFY_BASE}/acts/${META_ACTOR_ID}/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      urls: [{ url: buildAdLibraryUrl(vertical), method: "GET" }],
      count,
      "scrapePageAds.activeStatus": "active",
      scrapeAdDetails: true,
    }),
  });

  if (!runRes.ok) {
    throw new Error(`Apify run start failed: ${runRes.status}`);
  }

  const { data: run } = (await runRes.json()) as { data: { id: string } };
  return pollRunDataset(run.id, token, pollAttempts);
}

export async function fetchMetaAds(vertical: string, count = 30): Promise<Ad[]> {
  const raw = await fetchMetaAdsRaw(vertical, count);
  return raw.map(normalizeApifyAd);
}

// Route handlers cap at maxDuration=60s, so the default poll budget stays well
// under that (~45s) — a slow run fails gracefully instead of being killed. The
// offline seed-refresh script passes a larger budget.
async function pollRunDataset(
  runId: string,
  token: string,
  maxAttempts = 9,
): Promise<ApifyRawAd[]> {
  const delayMs = 5_000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));

    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!statusRes.ok) continue;
    const { data: run } = (await statusRes.json()) as {
      data: { status: string; defaultDatasetId: string };
    };

    if (run.status === "SUCCEEDED") {
      const itemsRes = await fetch(
        `${APIFY_BASE}/datasets/${run.defaultDatasetId}/items`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return (await itemsRes.json()) as ApifyRawAd[];
    }

    if (run.status === "FAILED" || run.status === "ABORTED") {
      throw new Error(`Apify run ${runId} ended with status ${run.status}`);
    }
  }

  throw new Error(`Apify run ${runId} timed out`);
}
