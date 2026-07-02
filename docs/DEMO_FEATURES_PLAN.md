# DEMO FEATURES PLAN — 3 differentiators before submission

> Execution plan for a delegated agent (target: Sonnet-class executor).
> Deadline: **July 4, 2026, 11:59 PM ET**. Implement in order: **Feature A → B → C**.
> If time runs short, Feature C (MCP) is the only cuttable item — A and B ship first.
> README + Vercel deploy (see memory/PROGRESS.md "Submission") outrank Feature C.

---

## 0. Ground rules (from CLAUDE.md — non-negotiable)

- **Seed path first.** Every feature must work end-to-end with ZERO env vars set
  (no `.env.local`). Live AI paths are secondary and must degrade gracefully.
- **No fabricated data.** Pre-baked artifacts must be produced by `scripts/refresh-seed.ts`
  from real ads / real model output, committed as JSON. Never hand-write "results".
- **TypeScript strict; no `any`.** All AI calls via `getProvider()` from
  `lib/ai/provider.ts` — never import a vendor SDK in feature code.
- **Route budget:** all `app/api/*` primary paths < 8s; AI routes set `export const maxDuration = 60`.
- **Quality gates before every commit:** `npm run lint && npm run typecheck && npm run build`.
- **Commits:** small, atomic, one concern each, pushed to `main` after each (the git
  history is judged). Suggested commit sequence is given at the end of this doc.
- **UI code style:** follow `app/page.tsx` conventions — inline style objects, small
  helper components at file bottom, amber/green/indigo callout patterns already present.

### Key existing pieces to REUSE (do not reinvent)

| Piece | Location |
|---|---|
| Provider interface (`analyzeCreative`, `clusterConcepts`, `generateJSON`) | `lib/ai/provider.ts` |
| Zod schemas for AI outputs | `lib/ai/schemas.ts` |
| Domain types (`Ad`, `CreativeDNA`, `ConceptClustering`, `AngleBrief`) | `lib/types.ts` |
| Seed loaders (`getSeedBriefs`, `getSampleSet`, `listSampleSets`, …) | `lib/cache/seed.ts` |
| `withRetry` backoff | `lib/cache/index.ts` |
| Offline seed baker (resumable, quota-frugal, per-vertical state cache) | `scripts/refresh-seed.ts` |
| Tolerant JSON parsing for model output | `lib/ai/json.ts` |
| UI state + step layout (`AppState`, Steps 1–6, `handleGenerate`, `handleRunFullDemo`) | `app/page.tsx` |

Seed data shapes:
- `data/seed/<slug>.json` = `{ vertical, ads: Ad[], dna: {adId,dna}[], winnerSummary, briefs: AngleBrief[] }`
- `data/seed/samples/<slug>.json` = `{ slug, label, vertical, ads, dna, clustering }`
- Seed verticals: `weight-loss-supplement`, `debt-relief`, `ed-telehealth`.
  Sample sets: `weight-loss-redundant`, `debt-relief-redundant`.

### Gemini budget for the whole plan

`refresh-seed` runs on Gemini free tier (~10 RPM, ~20 req/day per model — set
`GEMINI_MODEL=gemini-2.5-flash` in `.env.local` if the default bucket is exhausted).
Total new AI calls this plan requires: **~10** (6 for Feature A re-bake, 4 for
Feature B examples). Raw Apify data is already cached in `scripts/.cache/raw-*.json`
— **no Apify spend**. The script sleeps 6s between calls and caches every artifact,
so re-runs after a failure only spend what's missing.

---

## Feature A — Evidence-cited briefs + self-scored batch ("receipts + dog food")

**What the judge sees:** every generated angle brief shows the real competitor ads
(thumbnail · advertiser · "running N days") that prove the pattern it exploits, and
the batch ends with an integrity panel: *"These 10 briefs = 10 distinct concepts —
your current set: 8 ads → 3."*

### A1. Schema + type changes

`lib/ai/schemas.ts` — extend `angleBriefSchema`:
```ts
export const angleBriefSchema = z.object({
  // ...existing fields unchanged...
  // Real ad ids from the mined market set that evidence this angle's "whyNow".
  // Default [] keeps old seed files and live responses from failing validation.
  evidenceAdIds: z.array(z.string()).default([]),
});
```

`lib/types.ts` — add to `AngleBrief`: `evidenceAdIds: string[];`

### A2. Prompt changes — `lib/ai/prompts/generate.ts`

The current prompt receives `marketDNA` WITHOUT ad ids, so the model cannot cite.
Change `buildGenerateAnglesPrompt` to take `marketDNA: { adId: string; dna: CreativeDNA }[]`
and update `GENERATE_ANGLES_SYSTEM`'s JSON contract with:
```
"evidenceAdIds": ["string — 1-3 adId values copied VERBATIM from the market DNA list that prove this pattern"]
```
and add to the system prompt: *"Every brief MUST cite 1–3 evidenceAdIds copied verbatim
from the given market adId values — never invent ids. Cite the ads whose DNA the brief's
whyNow refers to."*

In the prompt body, serialize the market DNA **with ids** (same style as
`buildClusterConceptsPrompt` in `lib/ai/prompts/cluster.ts`).

### A3. Callers of the prompt (two)

1. **`app/api/generate/route.ts`** — request schema currently takes `marketDNA` as bare
   DNA. Change to `marketDNA: z.array(z.object({ adId: z.string(), dna: creativeDNASchema }))`
   (reuse the local `creativeDNASchema` pattern already in `app/api/score/route.ts`).
   Pass it through to the prompt builder. **This is a breaking change to the request
   shape — update both client call sites in the same commit** (`handleGenerate` and
   `handleRunFullDemo` in `app/page.tsx`: send `state.marketDna` / `marketDna` whole
   instead of `.map((r) => r.dna)`).
2. **`scripts/refresh-seed.ts`** — `buildVerticalSeed` already computes
   `marketDNAWithIds`; pass that instead of `marketDNA`.

### A4. Post-validation guard (never trust model ids)

In `app/api/generate/route.ts` live path AND in `refresh-seed.ts`, filter each brief's
`evidenceAdIds` to ids that actually exist in the provided market set:
```ts
const validIds = new Set(marketDNA.map((m) => m.adId));
const briefs = batch.briefs.map((b) => ({
  ...b,
  evidenceAdIds: b.evidenceAdIds.filter((id) => validIds.has(id)),
}));
```

### A5. Self-scored batch ("dog food")

New pure helper `lib/ai/briefs.ts` (used by client, route, and script):
```ts
import type { AngleBrief, CreativeDNA } from "@/lib/types";

// Represent a generated brief as a CreativeDNA record so the existing
// concept-clustering pipeline can score the batch's own diversity.
export function briefToDNA(brief: AngleBrief, index: number): { adId: string; dna: CreativeDNA } {
  return {
    adId: `brief_${String(index + 1).padStart(2, "0")}`,
    dna: {
      hookType: brief.hookLine,
      angle: brief.emotionalDriver,
      format: brief.formatRecommendation,
      offerFraming: brief.whyNow,
      ctaStyle: "n/a (brief)",
      targetPersona: brief.targetPersona,
      oneLineSummary: `${brief.angleName}: ${brief.hookLine}`,
    },
  };
}
```

**Seed path:** extend `SeedFile` (`lib/cache/seed.ts` + `SeedFileShape` in
`refresh-seed.ts`) with optional `briefClustering?: ConceptClustering`. In
`refresh-seed.ts` `buildVerticalSeed`, after briefs exist, compute
`provider.clusterConcepts(state.briefs.map(briefToDNA))` (cache as
`state.briefClustering`, same pattern as `state.sampleClustering`) and write it into
the seed file. Add `getSeedBriefClustering(slug)` to `lib/cache/seed.ts`.
`app/api/generate/route.ts` seed branch returns
`{ briefs, briefClustering: getSeedBriefClustering(slug), fromSeed: true }`.

**Live path:** do NOT add a second AI call inside `/api/generate` (route budget).
Instead the client fires the existing `/api/score` after briefs render:
`POST /api/score { dna: briefs.map(briefToDNA) }` — non-blocking; on failure hide the
panel silently (never block or error the demo).

### A6. UI — `app/page.tsx`

- `AppState`: add `briefClustering: ConceptClustering | null` (reset with the rest).
- `handleGenerate` / `handleRunFullDemo`: store `data.briefClustering ?? null`; if null
  and briefs exist, fire the non-blocking `/api/score` call described above.
- **Step 6 brief cards:** under each brief, an "EVIDENCE" row — for each
  `evidenceAdIds`, look up the ad in `state.ads`; render a small chip:
  32px thumbnail (`ad.coverUrl`, `onError` hides img), advertiser name,
  green `runDays`d badge. Ads not found → skip silently. Match existing chip styling.
- **Batch integrity panel** (bottom of Step 6, only when `briefClustering` exists):
  headline `"{n} briefs → {k} distinct concepts"`, green when `k / n ≥ 0.9` else amber;
  when `state.clustering` exists add the contrast line
  `"Your current set: {nAds} ads → {kConcepts} concepts."`
- `handleCopyBrief` + `handleExportCSV`: append an `evidence` field — advertiser names
  of cited ads (resolve via `state.ads`), comma-joined.

### A7. Re-bake procedure (run once, after A1–A5 compile)

1. `loadState` in `refresh-seed.ts` pre-seeds `state.briefs` from the existing seed
   file — **add a format guard** so old-format briefs are ignored:
   `if (seed.briefs?.length && seed.briefs[0].evidenceAdIds?.length) state.briefs ??= seed.briefs;`
   (This auto-invalidates the old briefs without hand-editing cache files. Also delete
   the `"briefs"` key from `scripts/.cache/state-*.json` for all 3 verticals to be safe.)
2. `npm run refresh-seed` (needs `.env.local` with `GEMINI_API_KEY`, `AI_PROVIDER=gemini`,
   `APIFY_TOKEN` — raw scrape is cached so Apify is not actually called).
3. Eyeball each `data/seed/<slug>.json`: 10 briefs, every brief has 1–3 `evidenceAdIds`
   that exist in that file's `ads`, and `briefClustering.kConcepts ≥ 9`. If a vertical's
   `kConcepts < 9`, re-run just that vertical once (`npm run refresh-seed <slug>` after
   deleting its `briefs`/`briefClustering` state keys) — do not hand-edit.
4. Commit the regenerated JSON as its own commit.

### A8. Verify (Feature A done when…)

- Zero-credential incognito run: "Run the full demo" → briefs show evidence chips with
  real thumbnails/run-days; integrity panel renders "10 briefs → K concepts" instantly.
- `npm run build` passes; no console errors (per verification checklist, use browser
  tools: screenshot Step 6, check console).
- Live path (with keys, novel vertical): briefs still render even if the follow-up
  score call fails.

---

## Feature B — Pre-flight creative check ("Entity-ID linter")

**What the judge sees:** after scoring their set, they click a sample "planned ad"
(or upload one) and instantly get a verdict: red *"Collapses into Concept 2 — wasted
auction entry"* with 2–3 concrete fixes, or green *"Genuinely new concept."*

### B1. Schema + type

`lib/ai/schemas.ts`:
```ts
export const preflightVerdictSchema = z.object({
  verdict: z.enum(["collapses", "distinct"]),
  collidesWith: z.string().nullable(), // concept name from the existing clustering, or null
  reason: z.string(),                  // one sentence, Entity-ID framing
  fixes: z.array(z.string()),          // 2-3 concrete changes to earn a new Entity ID
});
```
`lib/types.ts`: matching `PreflightVerdict` interface.

### B2. Prompt — new file `lib/ai/prompts/preflight.ts`

Follow the exact style of `cluster.ts` (system const + builder fn). System prompt:
Meta/Andromeda strategist; given (1) the user's existing concept clusters and (2) one
candidate ad's DNA, decide whether Andromeda would assign the candidate an existing
Entity ID (`collapses`, name the cluster in `collidesWith`) or a new one (`distinct`,
`collidesWith: null`). `fixes`: 2–3 specific changes (format/hook/angle swaps —
reference the set's gap angles when provided). Return raw JSON only, echo the exact
schema shape. Builder args:
`{ clustering: ConceptClustering; candidate: CreativeDNA; gaps?: string[] }`.

### B3. Route — new file `app/api/preflight/route.ts`

Mirror `app/api/score/route.ts` structure exactly (zod parse → seed-first → provider
via `withRetry` → 500 with logged error). `export const maxDuration = 60`.

Request schema:
```ts
{
  // Seed path: pre-baked example candidate on a sample set
  sampleSetId: z.string().optional(),
  candidateId: z.string().optional(),
  // Live path: candidate DNA (client obtains it via /api/deconstruct first)
  clustering: conceptClusteringLocalSchema.optional(),
  candidate: creativeDNALocalSchema.optional(),
}
```
- If `sampleSetId + candidateId`: return the pre-baked
  `{ verdict, fromSeed: true, ad }` from the sample file (new loader below). 404-style
  friendly JSON if not found.
- Else require `clustering + candidate`, call the provider with the preflight prompt
  via `generateJSON` + `preflightVerdictSchema`.
- Post-guard: if `verdict === "collapses"` and `collidesWith` is not one of the given
  cluster names, set it to the closest given name or the first cluster (never render a
  hallucinated name).

### B4. Seed data — extend sample sets

Extend `SampleSetFile` (`lib/cache/seed.ts`) with:
```ts
preflightExamples?: {
  id: string;            // e.g. "pf_wl_01"
  label: string;         // short UI chip label, e.g. "Another before/after static"
  ad: Ad;                // real ad (source: "planned"), real copy
  dna: CreativeDNA;      // already-analyzed DNA (reused from the pool — no new AI spend)
  verdict: PreflightVerdict; // real model output, baked offline
}[];
```
Add loaders: `getPreflightExample(sampleSlug, candidateId)` and include
`preflightExamples` (id + label only) in `listSampleSets()` summaries / the
`/api/samples` single-set response (`app/api/samples/route.ts` — inspect it first; it
serves both list and `?slug=` detail).

`scripts/refresh-seed.ts` — in `buildSampleSet`, after clustering exists, build TWO
candidates per sample set from the already-analyzed pool (ads NOT in the sample):
1. **Collapse candidate:** an ad whose DNA signature (`hookType|angle|format`) matches
   the sample's dominant bucket (reuse the `pickSampleAds` bucketing logic).
2. **Distinct candidate:** an ad whose `angle` appears in `state.sampleClustering.gaps`
   (fallback: any ad whose signature is absent from the sample's buckets).
For each, call the preflight prompt live (cache as `state.preflightVerdicts` keyed by
candidate id, same resumable pattern) and write into the sample file. Re-key the ad as
`{ ...ad, id: "pf_<abbr>_<nn>", source: "planned" }`. **4 AI calls total** (2 sets × 2).
Run `npm run refresh-seed` again (everything else is cached) and commit the JSON.

### B5. UI — `app/page.tsx` (new card between Step 5 and Step 6)

- `AppState` additions: `preflight: { candidateAd: Ad | null; verdict: PreflightVerdict | null } | null`,
  plus a loading flag reuse via `loadingStep`.
- Render only when `state.clustering` exists. Card title: "PRE-FLIGHT CHECK — test a
  planned ad before you spend".
- **Seed path (zero-cred):** chips for the loaded sample's `preflightExamples`
  (labels come from `/api/samples`). Click → `POST /api/preflight { sampleSetId, candidateId }`
  → instant verdict.
- **Live path:** reuse the existing upload/paste machinery: one image (reuse
  `compressImage`) or pasted copy → `POST /api/deconstruct` with
  `adKind: "uploaded"`, single ad → then `POST /api/preflight { clustering, candidate: dna }`.
  Requires keys; on failure show the existing friendly error pattern.
- **Verdict rendering:** collapse → red/amber panel: `⚠ Collapses into "{collidesWith}"`,
  reason, "wasted auction entry" framing, then "To earn a new Entity ID:" + `fixes` as
  a bullet list. Distinct → green panel: `✓ Genuinely new concept — safe to produce`,
  reason. Show the candidate's thumbnail/copy beside the verdict.
- Reset `preflight` state whenever a new sample set / upload replaces the clustering.

### B6. Verify (Feature B done when…)

- Zero-credential: load "Weight-loss redundant" sample → score → two pre-flight chips
  appear → clicking each returns the opposite verdicts instantly (one red, one green).
- With keys: paste a novel caption → live verdict in < 8s.
- Full demo button still runs end-to-end untouched; build/lint/typecheck pass.

---

## Feature C — MCP server (seed-first, zero-cost)

**What the judge sees:** a README snippet they paste into Claude Code/Desktop; then in
Claude: *"What angles should I test for debt relief?"* — and this tool answers from the
live Vercel URL. Their team's other tools are MCP-based; this slots straight in.

### C1. Dependency

`npm install mcp-handler @modelcontextprotocol/sdk` (mcp-handler is Vercel's official
Next.js adapter; zod is already installed). **Before writing code, consult the
mcp-handler README via the docs-lookup tools for the current API** — the snippet below
is the expected shape as of mid-2026; verify `createMcpHandler` signature and Next 15
compatibility.

### C2. Route — new file `app/api/[transport]/route.ts`

```ts
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getSeedAds, getSeedDNA, getSeedWinnerSummary, getSeedBriefs, listSeedSlugs,
         listSampleSets, getSampleSet } from "@/lib/cache/seed";

const handler = createMcpHandler(
  (server) => {
    server.tool("list_verticals", "List the pre-analyzed ad-market verticals available", {},
      async () => ({ content: [{ type: "text", text: JSON.stringify(/* slugs + display names + ad counts */) }] }));
    server.tool("get_market_winners", "Top competitor ads winning in a vertical, ranked by run-duration",
      { vertical: z.string() }, async ({ vertical }) => /* seed ads: id, advertiser, copy (trimmed ≤200 chars), runDays, + winnerSummary */);
    server.tool("get_market_dna", "Structured creative-DNA records for a vertical's winning ads",
      { vertical: z.string() }, async ({ vertical }) => /* seed dna */);
    server.tool("get_diversity_report", "Entity-ID collapse analysis for a sample ad set",
      { sampleSetId: z.string() }, async ({ sampleSetId }) => /* sample clustering + gaps */);
    server.tool("get_angle_briefs", "Prioritized net-new angle briefs with evidence citations",
      { vertical: z.string() }, async ({ vertical }) => /* seed briefs */);
  },
  {},
  { basePath: "/api" }, // dynamic [transport] segment → endpoint is /api/mcp
);
export { handler as GET, handler as POST, handler as DELETE };
```

Implementation notes:
- **Stateless streamable-HTTP only** — do NOT enable the SSE transport (it requires
  Redis; unnecessary).
- Next.js static routes (`/api/mine` etc.) take precedence over the dynamic
  `[transport]` segment, so existing routes are unaffected; confirm with `npm run build`
  (route list) + manual hits to `/api/mine` after adding it.
- Slugify inputs with the same `slugify` regex used in the routes; unknown
  vertical/sample → a helpful text result listing valid slugs and pointing to the web
  app for live pulls (friendly, never an error). **No AI calls anywhere in this route.**
- Trim payloads for token-friendliness: never return `coverUrl`/base64/rawMetrics; cap
  copy fields; return compact JSON.

### C3. README + docs

Add an "Use it from Claude (MCP)" README section: the config snippet
(`{"mcpServers": {"creative-strategist": {"url": "https://<prod-domain>/api/mcp"}}}`),
3 example prompts, and a note that MCP tools serve the pre-analyzed verticals (the web
app does live pulls). Also note it in `docs/ARCHITECTURE.md` if that file has a module
map section (inspect before editing).

### C4. Verify (Feature C done when…)

- Local: `npm run dev`, then `npx @modelcontextprotocol/inspector` against
  `http://localhost:3000/api/mcp` — `tools/list` shows 5 tools; `tools/call
  get_angle_briefs {vertical:"debt relief"}` returns the seed briefs. (Fallback check:
  raw JSON-RPC `initialize` + `tools/list` via curl/PowerShell `Invoke-RestMethod`.)
- All existing `/api/*` routes still respond (spot-check `/api/mine` seed vertical).
- After deploy: same inspector check against the Vercel URL, and a real end-to-end
  test from Claude Code with the README snippet.

---

## Commit sequence (push after each)

1. `feat(ai): evidence citations in angle-brief schema and generate prompt` (A1–A4)
2. `feat(seed): bake brief evidence + batch self-clustering into seed refresh` (A5 script side)
3. `chore(seed): re-bake seed verticals with evidence-cited briefs` (A7 JSON)
4. `feat(ui): evidence chips + batch integrity panel in Step 6` (A6)
5. `feat(api): pre-flight Entity-ID check route + prompt + schema` (B1–B3)
6. `feat(seed): bake pre-flight example candidates into sample sets` (B4 script + JSON)
7. `feat(ui): pre-flight check card` (B5)
8. `feat(mcp): expose seed-first MCP server at /api/mcp` (C1–C2)
9. `docs(readme): MCP usage + feature notes` (C3)
10. Update `memory/PROGRESS.md`, `memory/LOG.md`, `memory/DECISIONS.md` (`docs(memory): …`)

## Global regression checklist (run before calling the work done)

- [ ] Incognito, zero env vars: full demo button end-to-end, all six steps + evidence
      chips + integrity panel + pre-flight chips work, no console errors.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` all green.
- [ ] `/api/generate` old callers updated (request shape changed in A3) — search the
      repo for `"/api/generate"` to confirm only the two known call sites exist.
- [ ] No secrets in client bundle; no new env vars required for the seed path.
- [ ] Seed JSON diffs contain only real model/scrape output (spot-read them).
