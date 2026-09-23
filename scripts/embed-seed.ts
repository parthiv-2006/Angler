/**
 * Offline precompute: embeds every seed vertical and sample ad set with Voyage and
 * writes data/seed/embeddings/<slug>.json, one vector per ad per embedding view.
 *
 * Committing these vectors keeps the seed demo path zero-credential: /api/score
 * clusters seed sets from the stored vectors and never calls Voyage. Never imported
 * by a route.
 *
 *   npm run embed-seed            # all sets, skipping ones already embedded
 *   npm run embed-seed -- --force # re-embed everything
 *
 * Seed cover images are signed fbcdn URLs that have since expired, so seed vectors
 * are text-only. Images are embedded on the live path, for uploaded screenshots.
 */
import dotenv from "dotenv";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

dotenv.config({ path: ".env.local" });

import { listClusterableSets, seedEmbeddingsPath, type SeedEmbeddingsFile } from "@/lib/cache/seed";
import { EMBEDDING_VIEWS, buildEmbeddingText } from "@/lib/embeddings/input";
import { getEmbeddingProvider } from "@/lib/embeddings/provider";

// 5 decimals is far below the noise floor of cosine similarity and keeps files small.
const round = (v: number[]) => v.map((x) => Math.round(x * 1e5) / 1e5);

async function main() {
  const provider = getEmbeddingProvider();
  if (!provider) {
    console.error("VOYAGE_API_KEY is not set in .env.local");
    process.exit(1);
  }
  const force = process.argv.includes("--force");

  for (const set of listClusterableSets()) {
    const outPath = seedEmbeddingsPath(set.slug);
    if (existsSync(outPath) && !force) {
      console.log(`skip  ${set.slug} (already embedded)`);
      continue;
    }

    const file: SeedEmbeddingsFile = { model: provider.model, dimensions: provider.dimensions, views: {} };
    for (const view of EMBEDDING_VIEWS) {
      const inputs = set.items.map((item) => ({ text: buildEmbeddingText(item.copy, item.dna, view) }));
      const vectors = await provider.embed(inputs);
      file.views[view] = Object.fromEntries(set.items.map((item, i) => [item.adId, round(vectors[i])]));
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(file) + "\n");
    console.log(`wrote ${set.slug} (${set.items.length} ads × ${EMBEDDING_VIEWS.length} views)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
