import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  getSampleSet,
  getSeedAds,
  getSeedBriefs,
  getSeedDNA,
  getSeedWinnerSummary,
  listSampleSets,
  listSeedSlugs,
  listSeedVerticals,
} from "@/lib/cache/seed";
import { sortByRunDays } from "@/lib/sources/normalize";

// MCP endpoint (streamable HTTP at /api/mcp). Serves the pre-analyzed seed
// verticals and sample sets only — no AI calls, no credentials required.
// Payloads are trimmed for token-friendliness: no cover URLs, no raw metrics,
// ad copy capped. Live pulls on novel verticals stay in the web app.

const MAX_COPY_CHARS = 200;

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function trimCopy(copy: string): string {
  return copy.length > MAX_COPY_CHARS ? `${copy.slice(0, MAX_COPY_CHARS)}…` : copy;
}

function textResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof payload === "string" ? payload : JSON.stringify(payload),
      },
    ],
  };
}

function unknownVertical(input: string) {
  return textResult(
    `No pre-analyzed vertical matches "${input}". Available verticals: ` +
      `${listSeedSlugs().join(", ")}. For a live pull on a new vertical, use the web app.`,
  );
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_verticals",
      {
        title: "List verticals",
        description:
          "List the pre-analyzed ad-market verticals and sample ad sets available from this server.",
      },
      async () =>
        textResult({
          verticals: listSeedVerticals(),
          sampleSets: listSampleSets().map((s) => ({
            slug: s.slug,
            label: s.label,
            vertical: s.vertical,
            adCount: s.adCount,
          })),
        }),
    );

    server.registerTool(
      "get_market_winners",
      {
        title: "Get market winners",
        description:
          "Top competitor ads currently winning in a vertical, ranked by run-duration (longevity is a public proxy for profitability), plus a summary of what's winning and why.",
        inputSchema: { vertical: z.string() },
      },
      async ({ vertical }) => {
        const slug = slugify(vertical);
        const ads = getSeedAds(slug);
        if (!ads) return unknownVertical(vertical);
        return textResult({
          vertical: slug,
          winnerSummary: getSeedWinnerSummary(slug),
          ads: sortByRunDays(ads).map((ad) => ({
            id: ad.id,
            advertiser: ad.advertiser,
            copy: trimCopy(ad.copy),
            runDays: ad.runDays,
          })),
        });
      },
    );

    server.registerTool(
      "get_market_dna",
      {
        title: "Get market creative DNA",
        description:
          "Structured creative-DNA records (hook type, angle, format, offer framing, CTA style, persona) for a vertical's winning ads.",
        inputSchema: { vertical: z.string() },
      },
      async ({ vertical }) => {
        const slug = slugify(vertical);
        const dna = getSeedDNA(slug);
        if (!dna) return unknownVertical(vertical);
        return textResult({
          vertical: slug,
          dna: [...dna.entries()].map(([adId, record]) => ({ adId, dna: record })),
        });
      },
    );

    server.registerTool(
      "get_diversity_report",
      {
        title: "Get diversity report",
        description:
          "Entity-ID collapse analysis for a sample ad set: how many distinct concepts Meta's algorithm actually sees, which ads collapse together, and the proven market angles the set is missing.",
        inputSchema: { sampleSetId: z.string() },
      },
      async ({ sampleSetId }) => {
        const sample = getSampleSet(slugify(sampleSetId));
        if (!sample) {
          return textResult(
            `No sample ad set matches "${sampleSetId}". Available sample sets: ` +
              `${listSampleSets().map((s) => s.slug).join(", ")}. ` +
              `To score your own ad set, use the web app.`,
          );
        }
        return textResult({
          sampleSet: sample.slug,
          label: sample.label,
          vertical: sample.vertical,
          nAds: sample.clustering.nAds,
          kConcepts: sample.clustering.kConcepts,
          clusters: sample.clustering.clusters,
          gaps: sample.clustering.gaps,
        });
      },
    );

    server.registerTool(
      "get_angle_briefs",
      {
        title: "Get angle briefs",
        description:
          "Prioritized net-new angle briefs for a vertical, with platform copy variants and evidence citations back to the winning market ads.",
        inputSchema: { vertical: z.string() },
      },
      async ({ vertical }) => {
        const slug = slugify(vertical);
        const briefs = getSeedBriefs(slug);
        if (!briefs) return unknownVertical(vertical);
        return textResult({ vertical: slug, briefs });
      },
    );
  },
  { serverInfo: { name: "creative-strategist", version: "0.1.0" } },
  {
    basePath: "/api", // dynamic [transport] segment → endpoint is /api/mcp
    disableSse: true, // stateless streamable HTTP only; SSE would require Redis
  },
);

export { handler as GET, handler as POST, handler as DELETE };
