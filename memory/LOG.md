# Session Log

> Running log of what was accomplished each session. Newest entry first.
> One block per session. Prepend new entries via "update memory".

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
