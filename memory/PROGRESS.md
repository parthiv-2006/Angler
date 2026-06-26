# Progress

> Single source of truth for what's done, in-flight, and not started.
> Updated every session via "update memory".

---

## Infrastructure

- [x] Next.js 15 App Router scaffold (package.json, tsconfig.json, next.config.ts)
- [x] TypeScript strict mode configured
- [x] `npm run lint`, `npm run typecheck`, `npm run build` scripts in place
- [x] Provider-agnostic AI layer (`lib/ai/provider.ts` + `anthropic.ts` + `gemini.ts`)
- [x] Zod schemas for all AI outputs (`lib/ai/schemas.ts`)
- [x] Prompt templates (`lib/ai/prompts/analyze.ts`, `cluster.ts`, `generate.ts`)
- [x] Supabase schema written (`supabase/migrations/001_initial_schema.sql`)
- [x] Supabase schema **applied** to `parthiv-2006's Project` (xtigqcoogbraorwhmshw, us-west-2) via MCP
- [x] Supabase client + typed queries (`lib/db/client.ts`, `lib/db/queries.ts`, `lib/db/types.ts`)
- [x] Seed-first cache layer (`lib/cache/index.ts`, `lib/cache/seed.ts`)
- [x] `withRetry` exponential backoff utility in `lib/cache/index.ts`
- [x] Supabase env vars added to `.env.local`
- [x] `/api/score` validation fix: `dna` schema changed to `.min(0)` so seed path accepts empty array
- [ ] Supabase env vars added to Vercel project settings
- [ ] Anthropic Console API key obtained and added to `.env.local` (currently using Gemini; Gemini free tier quota exhausted — add billing or swap to Anthropic key)
- [ ] README written
- [ ] Vercel deploy

---

## Module 1 — Competitive Angle Miner ✅

- [x] TikTok Creative Center source (`lib/sources/tiktok-creative-center.ts`)
- [x] Apify source stub (`lib/sources/apify.ts`)
- [x] Ad normalizer (`lib/sources/normalize.ts`) — `normalizeTikTokAd`, `normalizeApifyAd`, `sortByRunDays`
- [x] 3 seed verticals with 15 ads each: `weight-loss-supplement`, `debt-relief`, `ed-telehealth`
- [x] `/api/mine` route — validates input, returns ranked ads + winner summary + `fromSeed` flag
- [x] Seed path works with zero credentials (seed JSON → skip Supabase → skip live fetch)
- [x] Winner summary served from seed for the 3 pre-baked verticals

**Gap:** Winner summary for *novel* (non-seed) verticals returns `null` — needs AI generation in the mine route (Day 3–4 work).

---

## Module 2 — Creative DNA Deconstructor 🔄

- [x] `/api/deconstruct` route — validates input, calls `getOrAnalyzeDNA`, returns `{ results: [{ adId, dna }] }`
- [x] Seed DNA pre-baked for all 3 verticals (15 DNA records each in seed JSON)
- [x] Live path: calls `provider.analyzeCreative()` for novel ads (requires `ANTHROPIC_API_KEY`)
- [ ] Winner summary AI generation for novel verticals in the mine route
- [ ] Filterable DNA view in `app/page.tsx` (filter by angle / format / hookType)
- [ ] "What's winning and why" AI summary panel in the UI

---

## Module 3 — Andromeda Diversity Scorer ✅ (seed path)

- [x] `/api/score` route — **seed-first** via `sampleSetId`; live clustering capped at 20 DNA
- [x] LLM concept-clustering prompt now **grounds gaps in mined market DNA** (`cluster.ts`)
- [x] Scores the **user's own** ad set (was clustering competitor DNA — fixed)
- [x] Sample ad sets loadable with one click (`/api/samples`, `data/seed/samples/*.json`)
- [x] Paste-your-own-captions flow (live path)
- [x] Diversity report rendered in UI (N ads → K concepts + amber gap callout)
- [ ] Drag-and-drop **image** upload (deferred — sample sets + paste chosen instead)

---

## Module 4 — Angle Generator ✅ (seed path)

- [x] `/api/generate` route — **seed-first** via vertical slug (`getSeedBriefs`)
- [x] Angle generation prompt (`lib/ai/prompts/generate.ts`)
- [x] 10 pre-baked briefs per seed vertical (in `data/seed/*.json`)
- [x] Copy-to-clipboard per brief (full brief)
- [x] ≥10 prioritized briefs with 3-platform variants confirmed end-to-end (seed path)
- [ ] CSV export of angle batch
- [ ] Per-field copy buttons

---

## UI — `app/page.tsx` 🔄

- [x] Stepped flow: Mine → Deconstruct → Score → Generate
- [x] Seed vertical chip buttons with active state
- [x] Enter key support on vertical input
- [x] `loadingStep` string shows current operation
- [x] Winner summary callout (indigo border)
- [x] `fromSeed` badge (green "instant" / purple "live")
- [x] DNA tags per ad (angle · format · hookType)
- [x] Diversity clusters + gap analysis callout (amber)
- [x] Angle briefs sorted by priority with "Copy" button
- [ ] Filterable DNA view (filter by angle/format/hookType)
- [ ] Drag-and-drop upload for Module 3
- [ ] Sample ad set one-click loader
- [ ] Loading / partial / empty / error states on every module

---

## Demo hardening 🔄

- [x] Seed-first path for **all four** modules (zero-credential full flow verified)
- [x] Tolerant model-JSON parsing (`lib/ai/json.ts`) so a fenced response can't 500
- [x] Graceful live-source fallback in `/api/mine` (TikTok → Apify → friendly 200)
- [x] `maxDuration = 60` on all AI routes; live score batch-capped at 20
- [x] Loading + error + `unavailable` states wired in `app/page.tsx`
- [x] Tested with zero credentials (no `.env.local`, no shell keys) end-to-end
- [ ] Concurrency guard (prefer cache under simultaneous requests)
- [ ] Empty-state polish on every module

---

## Submission ⬜

- [ ] README written (3 contest questions + cost/limits note)
- [ ] Live Vercel URL stable
- [ ] Fallback Loom recorded
- [ ] Submitted before July 4, 2026, 11:59 PM ET
