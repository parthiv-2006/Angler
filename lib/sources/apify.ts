import type { Ad } from "@/lib/types";
import { normalizeApifyAd, type ApifyRawAd } from "./normalize";

const APIFY_BASE = "https://api.apify.com/v2";
// Ready-made Meta Ad Library actor from Apify Store
const META_ACTOR_ID = "apify~meta-ads-scraper";

export async function fetchMetaAds(vertical: string): Promise<Ad[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");

  const runRes = await fetch(`${APIFY_BASE}/acts/${META_ACTOR_ID}/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      searchTerms: [vertical],
      maxResults: 50,
      activeStatus: "ACTIVE",
    }),
  });

  if (!runRes.ok) {
    throw new Error(`Apify run start failed: ${runRes.status}`);
  }

  const { data: run } = (await runRes.json()) as { data: { id: string } };

  // Poll until the run finishes (max ~60 s)
  const dataset = await pollRunDataset(run.id, token);
  return dataset.map(normalizeApifyAd);
}

async function pollRunDataset(runId: string, token: string): Promise<ApifyRawAd[]> {
  const maxAttempts = 12;
  const delayMs = 5_000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));

    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
