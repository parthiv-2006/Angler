# POLISH FEATURES PLAN — 5 pre-submission improvements

> Execution plan for a delegated agent. Deadline context: contest submission is
> **July 4, 2026, 11:59 PM ET**.
>
> **PRIORITY GATE — read first:** the Vercel deploy, README URL fill-in, and fallback
> Loom (memory/PROGRESS.md § Submission) outrank EVERYTHING in this document. Do not
> start this plan until those are done or explicitly deprioritized by the user.
>
> **Execution order: P5 → P1 → P2 → P3 → P4.** P5 is a possible demo bug (fix before
> the Loom is recorded). P1–P3 are zero-AI-cost UI polish. P4 is the only feature that
> spends money/quota and is the only cuttable item — skip it without hesitation if
> time or quota is tight.

## Status (as of 2026-07-03)

| Feature | Status | Notes |
|---|---|---|
| P5 — sample-set adId integrity | ✅ Done | Verified mismatched, re-baked both sample files (see memory/GOTCHAS.md "Clustering pipeline"). Prior session. |
| P1 — judge tour strip | ✅ Done | `feat(ui): 60-second guided tour strip`. Verified in browser: renders, hides once `hasAds`, no console errors. |
| P2 — shareable seed-report URL | ✅ Done | `feat(ui): shareable seed-report links`. Verified: full round-trip replay, garbage-param safety, share-link copy content, CSV/build regressions all clean. |
| P3 — production-handoff JSON export | ✅ Done | `feat(ui): production-handoff JSON export for angle briefs`. Verified: downloaded file inspected — sorted, evidence redacted to advertiser+runDays, matches `batchIntegrity`. |
| P4 — investing-newsletter seed vertical | ⬜ Not started | Explicitly cuttable/quota-spending item. Only attempt once Vercel deploy + Loom are locked in and `.env.local` has working `APIFY_TOKEN` + `GEMINI_API_KEY`. |

`npm run typecheck` and `npm run build` both clean on the final state; global regression
checklist below fully passed via Playwright against a running dev server plus a clean
production build with zero env vars. See memory/LOG.md (2026-07-03 entry) for full
verification detail.

## Model routing (per CLAUDE.md Engineering Rule 1)

| Features | Recommended executor | Why |
|---|---|---|
| P5, P4 | **Opus-class** (e.g. `oh-my-claudecode:executor` with `model=opus`, or Claude Opus 4.8 directly) | Both touch the seed-bake pipeline and committed real-data JSON. A data-integrity mistake here (fabricated-looking data, broken seed path) loses the contest. Quota judgment calls required. |
| P1, P2, P3 | **Sonnet-class** (e.g. `claude-sonnet-5`) | Mechanical, single-file UI work inside `app/page.tsx` following existing conventions. P2 is the trickiest of the three; if only one model is used for everything, use Opus. |

Run features **sequentially, one commit each, pushed after each** — never in parallel
agents (they all touch `app/page.tsx` or the seed data).

## 0. Ground rules (non-negotiable, from CLAUDE.md)

- **Seed path first.** Every change must work end-to-end with ZERO env vars set. If a
  feature can't work without keys, it must degrade invisibly (hide, never error).
- **No fabricated data.** Seed/sample JSON is only ever produced by
  `scripts/refresh-seed.ts` from real scraped ads + real model output. Never hand-edit
  result JSON. Never invent ads, metrics, or verdicts.
- **TypeScript strict, no `any`.** UI style: inline style objects, helper components at
  the bottom of `app/page.tsx`, existing `chipStyle`/`calloutStyle`/`cardStyle` helpers.
- **Quality gates per commit:** `npm run typecheck` && `npm run build`.
  **`npm run lint` is NOT runnable** (no ESLint config exists; `next lint` opens an
  interactive wizard and hangs — memory/GOTCHAS.md). Do not attempt to add an ESLint
  config; a `config-protection` hook blocks it.
- **NEVER run `npm run build` while `npm run dev` is running** — they share `.next/`
  and the dev server gets poisoned (MODULE_NOT_FOUND 500s). Stop dev first; recover
  with `rm -rf .next` if it happens. (memory/GOTCHAS.md)
- Route budget: any `app/api/*` primary path < 8s. (No new routes are needed by this
  plan; P1–P3 are client-only.)
- Commits: small, atomic, one concern, pushed to `main` after each. Suggested messages
  are given per feature.

## Key existing pieces to REUSE (do not reinvent)

| Piece | Location |
|---|---|
| `AppState`, `INITIAL`, `slugify`, `handleRunFullDemo`, `handleMine`, `handleScoreSample`, `handleGenerate`, `scoreBriefBatch`, `evidenceAdvertisers`, `handleExportCSV`, `handleCopyBrief` | `app/page.tsx` |
| Style helpers: `chipStyle(active)`, `primaryBtnStyle`, `secondaryBtnStyle`, `cardStyle`, `calloutStyle`, `Label`, `SEED_VERTICALS` | `app/page.tsx` (bottom) |
| Seed loaders: `listSeedSlugs`, `listSeedVerticals`, `getSeedAds`, `getSampleSet`, `listSampleSets` | `lib/cache/seed.ts` |
| Seed baker: `VERTICALS` config, resumable `state-<slug>.json` cache, `robustAI`, per-stage `saveState` | `scripts/refresh-seed.ts` |
| Domain types (`Ad`, `CreativeDNA`, `ConceptClustering`, `AngleBrief`) | `lib/types.ts` |
| Sample-set API (list + `?slug=` detail) | `app/api/samples/route.ts` |

Seed data shapes (must not change except where P4/P5 say so):
- `data/seed/<slug>.json` = `{ vertical: {slug, display_name, is_seed}, ads: Ad[], dna: {adId,dna}[], winnerSummary, briefs, briefClustering }`
- `data/seed/samples/<slug>.json` = `{ slug, label, vertical, ads, dna, clustering, preflightExamples }`
- Current seed verticals: `weight-loss-supplement`, `debt-relief`, `ed-telehealth`.
  Sample sets: `weight-loss-redundant`, `debt-relief-redundant`.

---

## P5 — Sample-set adId integrity check & fix (bug risk; do FIRST) ✅ DONE

**Why:** memory/GOTCHAS.md ("Clustering pipeline") records that `data/seed/samples/*.json`
may still contain `clustering.clusters[].adIds` baked before the id-threading fix — ids
that don't match `ads[].id` (`own_wls_01` style vs whatever the model invented). If so,
Step 5's concept buckets render raw id strings instead of real ad copy on the seed path
— visible in the judge demo and the Loom. However, a later re-bake may have already
fixed this. **Verify before touching anything.**

### P5.1 Verify (read-only, do this exactly)

Run a node one-liner against BOTH sample files, e.g.:

```bash
node -e "
for (const f of ['weight-loss-redundant','debt-relief-redundant']) {
  const s = require('./data/seed/samples/' + f + '.json');
  const adIds = new Set(s.ads.map(a => a.id));
  const clusterIds = s.clustering.clusters.flatMap(c => c.adIds);
  const bad = clusterIds.filter(id => !adIds.has(id));
  const dnaBad = s.dna.filter(d => !adIds.has(d.adId)).map(d => d.adId);
  console.log(f, '| cluster ids:', clusterIds.length, '| mismatched:', bad, '| dna mismatched:', dnaBad);
}"
```

Also verify each `preflightExamples[].verdict.collidesWith` (when non-null) equals one
of `clustering.clusters[].concept` in the same file.

**If everything matches: P5 is a no-op.** Record the verification in
`memory/GOTCHAS.md` (update the "Not fixed" note to "verified fixed on <date>") and move
to P1. Do NOT re-bake for fun — it costs Gemini quota.

### P5.2 Fix (only if mismatched; needs `.env.local` with `GEMINI_API_KEY`, `AI_PROVIDER=gemini`, `APIFY_TOKEN`)

The stale ids live in the resumable cache, not just the output files, so a plain re-run
would reuse them. Procedure:

1. In `scripts/.cache/state-weight-loss-supplement.json` and
   `scripts/.cache/state-debt-relief.json`, delete ONLY the keys `sampleClustering`
   and `preflightVerdicts` (leave `dna`, `summary`, `briefs`, `briefClustering` — they
   are unaffected and reusing them saves ~10 AI calls).
2. Run `npm run refresh-seed weight-loss-supplement`, then
   `npm run refresh-seed debt-relief`. Raw Apify data is cached
   (`scripts/.cache/raw-*.json`) → **zero Apify spend**. AI spend: 1 sample-cluster +
   2 preflight calls per vertical ≈ **6 Gemini calls total** (free-tier budget: ~10 RPM,
   ~20/day per model; the script self-throttles 6s between calls; `GEMINI_MODEL` env var
   picks the quota bucket — see memory/GOTCHAS.md "limit: 0" note: a 429 with `limit: 0`
   means dead model, switch buckets, don't wait).
3. Re-run the P5.1 verification — all ids must now match, and each verdict's
   `collidesWith` must name a real cluster concept.
4. Zero-credential check (no `.env.local` — temporarily rename it): `npm run build`,
   start the prod server, load a sample set in the UI → Step 5 buckets show real ad
   copy, both pre-flight chips return verdicts. Restore `.env.local`.
5. Commit: `fix(seed): re-bake sample clusterings with real ad ids` (JSON + the two
   state-cache files if they're tracked; check `git status` — `scripts/.cache/` may be
   untracked, commit only what git already tracks).

**Abort rule:** if quota dies mid-bake, the script's per-stage cache means a later
re-run only spends what's missing — do NOT commit a partially re-baked sample file;
`git checkout -- data/seed/samples/` and leave P5 documented as blocked.

---

## P1 — "How to judge this" strip (zero AI, `app/page.tsx` only) ✅ DONE

**What the judge sees:** directly under the header, a slim callout that removes all
friction from the first 60 seconds: three numbered micro-steps and the one button that
does everything.

### Implementation

- In `app/page.tsx`, between `<header>` and the Step 1 `<section>`, add a callout
  (`calloutStyle` base) containing:
  - Small caps label: `NEW HERE? 60-SECOND TOUR` (match the 12px/600 label pattern used
    for "WHAT'S WINNING & WHY").
  - One line of muted 13px text: `1. Pick a vertical → 2. Load a sample ad set → 3. See
    what Meta really thinks of it — then generate the angles you're missing.`
  - A primary button `▶ Run the full demo (~15 s)` that calls the EXISTING
    `handleRunFullDemo` (do not duplicate its logic), disabled on `state.loading`.
- Optionally hide the strip once a run exists (`hasAds`) so it doesn't nag: render only
  when `!hasAds`. Keep the existing full-demo button in Step 1 untouched.
- No `AppState` changes. No new components unless the JSX exceeds ~25 lines — then a
  `JudgeTour` helper component at the bottom of the file next to `Label`.

### Verify
- `npm run typecheck` + `npm run build` (dev server stopped).
- Zero-credential browser check: strip renders, button runs the full demo, strip
  disappears after ads load, no console errors.
- Commit: `feat(ui): 60-second guided tour strip`

---

## P2 — Shareable report URL (zero AI, `app/page.tsx` only) ✅ DONE

**What the judge sees:** after a seed-path run, a "Copy share link" button; opening that
link on another machine replays the same report instantly. Signals "team tool", costs
nothing.

### Design constraints (read carefully — this is where builds break)

- **Do NOT use `next/navigation`'s `useSearchParams`** — in Next 15 it forces a
  `<Suspense>` boundary around the page and fails the build otherwise. Read
  `window.location.search` inside a `useEffect` (client component, safe) and write with
  `history.replaceState` (no router, no re-render).
- **Only seed-path state is encodable.** Params: `v` (seed vertical slug), `s` (sample
  set slug, optional). Pasted captions / uploaded images are NOT encodable — when the
  current report came from paste/upload, do not offer the share button.
- **Whitelist-guard the replay.** Never let a URL param trigger a live scrape: on mount,
  validate `v` against the slugs derivable from the existing `SEED_VERTICALS` constant
  (`slugify(v.value)`), and validate `s` against the fetched `/api/samples` list before
  using it. Unknown values → ignore params entirely (render the normal empty page).

### Implementation

1. **Generalize the demo runner.** Extract the body of `handleRunFullDemo` into
   `async function runSeedDemo(verticalValue: string, sampleSlug: string | null)`:
   - identical logic, but the vertical and sample slug are parameters;
   - it must NOT depend on `state.sampleSets` being populated (the mount-replay race):
     fetch `/api/samples` inside `runSeedDemo` when it needs the sample list (or accept
     the already-validated `sampleSlug` and skip the lookup);
   - `handleRunFullDemo` becomes a one-liner:
     `runSeedDemo("weight-loss supplement", null)` preserving today's behavior of
     resolving the sample by vertical (`state.sampleSets.find(...)` fallback
     `"weight-loss-redundant"` — keep that resolution inside `runSeedDemo`).
   - Preserve the existing scroll/sleep choreography and all state threading exactly —
     this function is the heart of the judge demo; a regression here is catastrophic.
     Diff carefully against the original.
2. **Replay on mount.** In the existing mount `useEffect` (the one fetching
   `/api/samples`), after the samples land: parse `new URLSearchParams(window.location.search)`;
   if `v` is a valid seed slug, map it back to its `SEED_VERTICALS` display value and
   call `runSeedDemo(value, validatedSampleSlug)`.
3. **Write the URL.** At the successful end of `runSeedDemo`, call
   `history.replaceState(null, "", "?v=" + slug + (sampleSlug ? "&s=" + sampleSlug : ""))`.
   Also clear params (`history.replaceState(null, "", location.pathname)`) when the user
   starts a non-seed flow (paste/upload score) so stale links aren't copied.
4. **Copy button.** In the Step 5 section header (next to "Generate Angles →" or below
   it), when `state.fromSeed && state.selectedSample`, render a small secondary button
   `Copy share link` that writes `location.origin + location.pathname + "?v=…&s=…"` to
   the clipboard with the same copied-checkmark pattern as `CopyVariant`.

### Verify
- `npm run typecheck` + `npm run build` — specifically confirm the build does NOT
  complain about `useSearchParams`/Suspense (it shouldn't, since neither is used).
- Browser, zero credentials: run full demo → URL gains `?v=…&s=…` → hard-refresh the
  URL → the full report replays instantly with no interaction. Open in a fresh
  incognito window too. `?v=garbage` → normal empty page, no error, no fetch to
  `/api/mine` with garbage (check the network tab).
- Regression: plain `/` with no params behaves exactly as before; paste-path scoring
  clears/never sets params.
- Commit: `feat(ui): shareable seed-report links`

---

## P3 — Production-handoff export (zero AI, `app/page.tsx` only) ✅ DONE

**What the judge sees:** next to "Export CSV" in Step 6, an "Export for production
(JSON)" button producing a machine-readable brief package — the literal input format
for the video-generator/MCP-uploader pipeline their team is building. Completes the
assembly-line story told in the README.

### Implementation

- Add `handleExportJSON` beside `handleExportCSV` in `app/page.tsx`, reusing the same
  Blob/anchor download pattern (`application/json`, filename
  `angle-briefs-${slugify(state.vertical) || "export"}.json`).
- Payload shape (assemble inline; resolve evidence via the existing `marketAdById` map):

```jsonc
{
  "tool": "creative-strategist",
  "vertical": "<state.vertical>",
  "generatedAt": "<new Date().toISOString()>",
  "briefs": [ // sorted by priority asc, same as CSV
    {
      "priority": 1,
      "angleName": "…", "emotionalDriver": "…", "whyNow": "…",
      "hookLine": "…", "formatRecommendation": "…", "targetPersona": "…",
      "variants": { "meta": "…", "tiktok": "…", "native": "…" },
      "evidence": [ { "advertiser": "…", "runDays": 123 } ] // resolved; unknown ids skipped
    }
  ],
  "batchIntegrity": { "briefs": 12, "distinctConcepts": 10 } // from state.briefClustering, omit if null
}
```

- Do NOT ship `evidenceAdIds` raw or any `coverUrl`/base64 — advertiser + runDays only.
- Button copy: `Export for production (JSON)`; add a muted 11px caption under the two
  export buttons: `CSV for bulk sheets · JSON for the video-generation pipeline`.

### Verify
- Typecheck + build; browser: run seed demo → export → file downloads, `JSON.parse`s,
  priorities sorted, evidence advertisers match the on-screen chips, no `adId`s or
  image data in the payload. CSV export unchanged.
- Commit: `feat(ui): production-handoff JSON export for angle briefs`

---

## P4 — Fourth seed vertical: investing/financial newsletter (OPTIONAL — cut first) ⬜ NOT STARTED

**Why:** the judge spent ~5 years at Agora/Money Map Press (financial newsletters).
Seeing his own market pre-analyzed lands personally. **Only attempt if: deploy + Loom
are done, P5/P1–P3 are shipped, and `.env.local` has working `APIFY_TOKEN` +
`GEMINI_API_KEY`.** This spends one Apify actor run (~real money on PAY_PER_EVENT) and
~5 Gemini calls.

### Implementation

1. **Config.** In `scripts/refresh-seed.ts`, append to `VERTICALS`:
   `{ slug: "investing-newsletter", display: "Investing Newsletter", query: "investing newsletter" }`
   — NO `sampleSlug` (sample sets require a pre-existing file; `buildSampleSet` skips
   without one; do not create one — 2 sample sets are enough for the demo).
   Note the slug MUST equal `slugify("investing newsletter")` = `investing-newsletter`,
   because `/api/mine` resolves seeds by slugified user input.
2. **Bake.** `npm run refresh-seed investing-newsletter`. Watch the log:
   - `[filter] N usable ads` — if `N < 15` (MARKET_SIZE), the vertical is thin: delete
     `scripts/.cache/raw-investing-newsletter.json`, try ONE alternate query
     (`"stock picks"` or `"financial newsletter"`), then give up and abandon P4 cleanly
     (revert the config edit). Each retry is another paid Apify run — max 2 total.
   - Gemini budget: batch-DNA + summary + market-cluster + briefs + brief-cluster =
     **5 calls**. If a 429 has `limit: 0` → switch `GEMINI_MODEL` bucket
     (memory/GOTCHAS.md); if daily-exhausted → stop, the state cache resumes tomorrow.
3. **Eyeball the output** (`data/seed/investing-newsletter.json`): 15 ads with real
   advertisers/copy, every `dna[].adId` ∈ `ads[].id`, ≥10 briefs each citing 1–3
   `evidenceAdIds` that exist in `ads`, `briefClustering.kConcepts ≥ 9`. If briefs are
   weak, delete the `briefs`+`briefClustering` keys from
   `scripts/.cache/state-investing-newsletter.json` and re-run once. Never hand-edit.
4. **UI.** Add `{ label: "Investing Newsletter", value: "investing newsletter" }` to
   `SEED_VERTICALS` in `app/page.tsx`. Nothing else — `/api/mine`, `/api/generate`, and
   the MCP `list_verticals` tool all discover seed files by scanning `data/seed/`.
5. **Zero-credential check:** rename `.env.local` away, `npm run build` + prod server →
   click the new chip → ads, DNA, and briefs all serve instantly with the green
   `instant` badge; MCP `list_verticals` (raw JSON-RPC POST to `/api/mcp`, remember the
   SSE-framed response per memory/GOTCHAS.md) lists 4 verticals. Restore `.env.local`.
6. Commits (two): `feat(seed): investing-newsletter seed vertical` (script config +
   JSON), then `feat(ui): investing-newsletter seed chip`.

**Abort rule:** any failure that would leave a partial/thin seed file → revert
everything (`git checkout -- .`), delete the new seed JSON, and record the attempt in
`memory/GOTCHAS.md`. A missing 4th vertical costs nothing; a broken one costs the demo.

---

## Global regression checklist (run once, after the last shipped feature)

- [ ] Zero env vars, production build: "Run the full demo" end-to-end — Steps 1–6 +
      pre-flight chips + evidence chips + integrity panel, no console errors
      (fbcdn.net thumbnail failures in a sandbox are environment-only, ignore per
      memory/GOTCHAS.md).
- [ ] Share link round-trips in incognito (P2).
- [ ] Both exports download and open (P3).
- [ ] Every seed vertical chip serves instantly with the `instant` badge.
- [ ] `npm run typecheck` and `npm run build` green (dev server stopped; `lint` is
      known-unusable).
- [ ] `git log` shows one concern per commit, all pushed.
- [ ] Update `memory/PROGRESS.md` (new items under UI/Submission), `memory/LOG.md`
      (prepend session entry), `memory/GOTCHAS.md` (anything new), and
      `memory/DECISIONS.md` (P4 query choice, P5 verify outcome) —
      `docs(memory): record polish-feature session`.
