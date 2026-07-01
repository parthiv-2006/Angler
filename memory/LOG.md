# Session Log

> Running log of what was accomplished each session. Newest entry first.
> One block per session. Prepend new entries via "update memory".

---

## 2026-07-01 — Concurrency guard + empty/error state polish

**What:** Closed two items from the demo-hardening checklist.
- **Concurrency guard:** `lib/cache/index.ts` now single-flight dedupes `getOrFetchAds`/`getOrAnalyzeDNA` live calls by key (`ads:${verticalId}`, `dna:${adId}`) so simultaneous requests for the same vertical/ad prefer the in-flight promise over a redundant live call.
- **Empty/error states:** `app/page.tsx` — DNA extraction returning zero results, angle generation returning zero briefs, an empty sample-set list, and a clustering response with zero concepts all now surface an explicit message instead of silently rendering nothing.

**Verified:** `npm run typecheck` clean.

**Branch state:** `main`. **What's next:** README + Vercel deploy + Loom are still the open submission items.

---

## 2026-06-30 — Live AI path fixed (Gemini model swap)

**Problem:** Live AI calls all 429'd with `limit: 0, model: gemini-2.0-flash`. The standing
assumption (recorded as a gotcha) was "free tier daily quota exhausted, resets daily." That
was wrong: `limit: 0` means this project has **zero** free-tier allocation for that model —
Google retired free-tier `gemini-2.0-flash` for new keys. No amount of waiting fixes it.

**Diagnosis:** Direct `generateContent` probes on the same key: `gemini-2.5-flash` → 200,
`gemini-2.5-flash-lite` → 503, `gemini-1.5-flash` → 404 (retired).

**Fix:** `lib/ai/gemini.ts` — `MODEL_DEFAULT` now `process.env.GEMINI_MODEL ?? "gemini-2.5-flash"`.

**Verified on the live path (port 3002, `AI_PROVIDER=gemini`):**
- `/api/deconstruct` novel vertical "nootropic focus supplement" + `generateSummary:true` →
  real per-ad DNA (both `analyzeCreative` calls) **and** a synthesized `winnerSummary`
  (`generateJSON`). 200.
- `/api/score` with no `sampleSetId` → live `clusterConcepts` correctly collapsed 3 ads → 2
  concepts with grounded gap `authority`. 200.
- `npm run typecheck` clean. Gotcha rewritten; PROGRESS updated.

**Branch state:** `main` (uncommitted: gemini.ts + memory). **What's next:** commit; deploy
(user-owned) — set `AI_PROVIDER=gemini` + `GEMINI_API_KEY` in Vercel for the live path.

---

## 2026-06-30 — High-ROI demo features (collapse viz, waste $, coverage, guided demo, novel summary)

**What was done (5 atomic commits, all pushed to `main`):**
- **A — Visual Entity-ID collapse + $ waste** (`23aee41`): Step 5 now renders color-coded
  concept buckets with the real ad copy stacked inside each + `N× collapsed` badges; a waste
  headline (`N ads → K concepts`, redundant count, `~X%`) and an optional budget input that
  yields a labelled `$` estimate. Pure client-side from existing `clustering` + `userAds`.
- **D — Market-vs-you coverage** (`109e78c`): replaced the flat gaps list with a side-by-side
  panel — proven market angles by frequency (from `marketDna`) next to the gap list.
- **B1 — Filterable DNA** (`5e7ba32`): toggle filter chips for angle/format/hookType + "showing
  X of Y" + clear, in Step 3. Closes the Module 2 "filterable/groupable" acceptance criterion.
- **C — One-click guided demo** (`5e22888`): "Run the full demo" button; `handleRunFullDemo()`
  threads mine→deconstruct→score→generate inline (locals, not state) with smooth scroll between
  the six `id`-tagged sections. Seed path → ~2s, no timeout risk.
- **B2 — Novel-vertical "what's winning" summary** (`973ab4b`): gated `generateSummary` flag in
  `/api/deconstruct` (+ `lib/ai/prompts/summary.ts`, `winnerSummarySchema`). Client sends `true`
  only when no seed summary exists; seed verticals send `false` → **zero AI call on the seed path**.
  Live generation wrapped in try/catch (returns null, never 500).

**Verified:** `npm run typecheck` + `npm run build` clean. Playwright on the live dev server:
guided demo populates all 6 steps in one click; collapse buckets show real copy + `4×/3×`
badges; waste headline = `8 ads / 3 concepts / 5 redundant / ~63%`; budget `$10k → $6,300/mo
(estimated)`; coverage panel shows curiosity ×7 / social_proof ×5 / fear ×2 / novelty ×1; DNA
filter `curiosity` → "Showing 7 of 15"; deconstruct on the seed sent `generateSummary:false`
(confirmed in the request body). Console clean except a benign favicon 404.

**Gotcha hit & recorded:** running `npm run build` while `npm run dev` was live corrupted the
dev server's `.next` chunks (MODULE_NOT_FOUND 500s). Fix: stop dev → `rm -rf .next` → restart.

**Branch state:** `main`, all 5 commits pushed. **What's next:** deploy (user-owned) — seed path
needs no env; then README live-URL update + fallback Loom. The live AI path (novel-vertical
summary generation, paste-your-own scoring) still needs a working `ANTHROPIC_API_KEY`.

---

## 2026-06-29 — Per-field copy buttons on angle brief variants

**What was done:**
- Added per-field `Copy` button to each `CopyVariant` row (Meta / TikTok / Native) in `app/page.tsx`.
- Button flashes green "✓" for 1.5 s after click using local `useState`. Previously only a whole-brief Copy existed.
- `npm run typecheck` exits 0. Commit `6355ece` pushed to `main`.

**Branch state:** `main`. **What's next:** Vercel deploy (live URL is the win condition) → README Vercel URL update → Loom.

---

## 2026-06-27 — CSV export for angle briefs

**What was done:**
- Added `handleExportCSV()` to `app/page.tsx`: builds a properly-quoted 10-column CSV (Priority → Native Copy), sorted by priority, filename keyed to the active vertical slug.
- Added "Export CSV" button in the Step 6 section header next to the Label, using the existing `secondaryBtnStyle`.
- `npm run typecheck` + `npm run build` both exit 0. Commit `29e8712` pushed to `main`.

**Branch state:** `main`. **What's next:** README (25% of score) → Vercel env vars → deploy → Loom.

---

## 2026-06-26 — Supabase setup + env verification

**What was done:**
- Applied Supabase schema (7 tables + RLS) to `parthiv-2006's Project` (xtigqcoogbraorwhmshw, us-west-2) via MCP
- Added all Supabase env vars to `.env.local`
- Fixed `/api/score` validation bug: `dna: z.array(...).min(1)` → `.min(0)` so seed path works with empty array
- Verified full seed path (mine/samples/score/generate) — all return `fromSeed: true` correctly
- Diagnosed AI key issues: `sk-ant-oat` OAuth tokens cannot authenticate to api.anthropic.com; Gemini free tier daily quota exhausted from retry burns

**Current AI provider state:** `AI_PROVIDER=gemini` in `.env.local` but Gemini quota exhausted. Seed path unaffected. Live path needs either Gemini quota reset (daily) or Anthropic Console key (`sk-ant-api03-...`).

**Branch state:** `main`. **What's next:** Anthropic Console API key → README → Vercel deploy → Loom.

---

## 2026-06-26 — Plan audit + seed-path hardening (Modules 3 & 4)

**What was done (correction + hardening pass after a full plan audit):**
- **C1 — closed the biggest hole:** Modules 3 & 4 had no seed/cached path (routes always
  called live AI; seed JSON had no clustering/briefs). Pre-baked 10 angle briefs into each
  of the 3 vertical seeds, added 2 redundant sample ad sets under `data/seed/samples/`
  (with pre-baked clustering), and added seed-first lookup to `/api/score` (by `sampleSetId`)
  and `/api/generate` (by vertical slug).
- **C2 — Module 3 now scores the USER's own ad set**, not the competitor ads. New
  `/api/samples` route + sample-set picker + paste box in `app/page.tsx`. Step renumbered:
  1 mine → 2 winners → 3 market DNA → 4 score your set → 5 N→K + gaps → 6 briefs.
- **C3 — gaps grounded in market DNA:** `clusterConcepts(dna, marketDNA?)` + prompt now
  receive the mined winners so gaps are real, not hallucinated.
- **H1 — graceful source fallback:** `/api/mine` tries TikTok → Apify → returns 200 with
  `unavailable:true` + friendly message (never a 500). UI renders the nudge.
- **H2 — tolerant JSON parsing:** new `lib/ai/json.ts` `parseModelJSON()` strips fences /
  slices to outer braces; both providers use it.
- **H3 — `export const maxDuration = 60`** on mine/deconstruct/score/generate; live score
  capped at 20 DNA records.
- **M1 — moved the 5 design docs into `docs/`** so CLAUDE.md's `./docs/*` refs resolve.

**Verified:** `npm run typecheck` + `npm run build` clean. Full 5-step flow exercised on
the **zero-credential** production server (port 3100, no `.env.local`, no shell keys):
mine→deconstruct→samples→score→generate all returned `fromSeed:true` with real data.
Novel vertical returned the friendly `unavailable` fallback (HTTP 200), not an error.

**Branch state:** `main`. **What's next:** README (25% of score), Supabase apply + Vercel
deploy, optional normalize/seed unit tests, fallback Loom.

---

## 2026-06-26 — Memory system

**What was done:**
- Designed and created the `memory/` folder AI context system
- Created `PROGRESS.md`, `GOTCHAS.md`, `DECISIONS.md`, `LOG.md`
- Updated `CLAUDE.md` with the `## AI Memory System` section and "update memory" protocol

**Branch state:** `main`, all committed and pushed
**What's next:** Day 3–4 — Module 2 (Creative DNA Deconstructor):
- Generate winner summary via AI for novel verticals (in the mine or deconstruct route)
- Build filterable DNA view in `app/page.tsx` (filter chips for angle/format/hookType)
- "What's winning and why" summary panel

---

## 2026-06-25 — Day 1–2 complete (Module 1 + scaffold)

**What was done:**
- Scaffolded full Next.js 15 App Router project (package.json, tsconfig, next.config.ts)
- Provider-agnostic AI layer: `lib/ai/provider.ts`, `anthropic.ts`, `gemini.ts`, `schemas.ts`
- Prompt templates: `analyze.ts`, `cluster.ts`, `generate.ts`
- Supabase schema: `supabase/migrations/001_initial_schema.sql` (7 tables, RLS, indexes)
- Supabase client + typed queries: `lib/db/client.ts`, `lib/db/queries.ts`, `lib/db/types.ts`
- Competitor sources: `tiktok-creative-center.ts`, `apify.ts`, `normalize.ts`
- Seed-first cache layer: `lib/cache/index.ts`, `lib/cache/seed.ts`
- 3 seed verticals (15 ads + 15 DNA records + winner summary each): `weight-loss-supplement`, `debt-relief`, `ed-telehealth`
- All 4 API routes wired: `/api/mine`, `/api/deconstruct`, `/api/score`, `/api/generate`
- Full stepped UI in `app/page.tsx`: Mine → DNA → Score → Generate with all visual states
- TypeScript clean (`npm run typecheck` exits 0)
- 12 commits pushed to GitHub

**Key fixes during session:**
- Supabase `createClient<Database>` generic → `never` → removed generic, explicit casts
- Self-referential `Omit<>` → `never` → named row interfaces
- `getOrAnalyzeDNA` refactored from 4 to 5 args (added `slug`)

**Branch state:** `main`, all committed and pushed to `https://github.com/parthiv-2006/Angler.git`
**What's next:** Day 3–4 — Module 2 complete, winner summary AI generation, filterable DNA view
