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
- [x] **Live AI path working** via Gemini `gemini-2.5-flash` (free tier). The earlier "quota exhausted" was actually a dead model (`gemini-2.0-flash` → 429 `limit:0`); switching `MODEL_DEFAULT` fixed it. All three entry points verified on a novel vertical.
- [ ] (Optional) Anthropic Console API key (`sk-ant-api03-...`) for a non-Gemini provider — current `ANTHROPIC_API_KEY` is an unusable `sk-ant-oat` token; not needed while Gemini works
- [x] README written (3 contest questions, data provenance, cost/limits, MCP usage section)
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
- [x] Live path: calls `provider.analyzeCreative()` for novel ads — **verified working on Gemini `gemini-2.5-flash`**
- [x] Winner summary AI generation for novel verticals — gated `generateSummary` flag in `/api/deconstruct` (`lib/ai/prompts/summary.ts`, `winnerSummarySchema`); seed path sends `false` → no AI call
- [x] Filterable DNA view in `app/page.tsx` (filter chips by angle / format / hookType + "showing X of Y")
- [x] "What's winning and why" summary panel in the UI (seed verticals from mine; novel verticals from deconstruct)

---

## Module 3 — Andromeda Diversity Scorer ✅ (seed path)

- [x] `/api/score` route — **seed-first** via `sampleSetId`; live clustering capped at 20 DNA
- [x] LLM concept-clustering prompt now **grounds gaps in mined market DNA** (`cluster.ts`)
- [x] Scores the **user's own** ad set (was clustering competitor DNA — fixed)
- [x] Sample ad sets loadable with one click (`/api/samples`, `data/seed/samples/*.json`)
- [x] Paste-your-own-captions flow (live path)
- [x] Diversity report rendered in UI (N ads → K concepts + amber gap callout)
- [x] Drag-and-drop **image** upload — 3–10 real ad screenshots → client-side compressed → `/api/deconstruct` (`adKind:"uploaded"`, `imageBase64`) → `/api/score`, rendering as real thumbnails in "YOUR AD SET" and inside Step 5's collapsed concept buckets

---

## Module 4 — Angle Generator ✅ (seed path)

- [x] `/api/generate` route — **seed-first** via vertical slug (`getSeedBriefs`)
- [x] Angle generation prompt (`lib/ai/prompts/generate.ts`)
- [x] 10 pre-baked briefs per seed vertical (in `data/seed/*.json`)
- [x] Copy-to-clipboard per brief (full brief)
- [x] ≥10 prioritized briefs with 3-platform variants confirmed end-to-end (seed path)
- [x] CSV export of angle batch
- [x] Per-field copy buttons

---

## MCP server — `/api/mcp` ✅ (Feature C, DEMO_FEATURES_PLAN.md)

- [x] `app/api/[transport]/route.ts` via `mcp-handler` — stateless streamable HTTP only (`disableSse: true`, no Redis)
- [x] 5 seed-first tools: `list_verticals`, `get_market_winners`, `get_market_dna`, `get_diversity_report`, `get_angle_briefs` — zero AI calls, zero credentials
- [x] Token-trimmed payloads (no coverUrl/rawMetrics, copy capped at 200 chars); friendly unknown-slug responses listing valid slugs
- [x] `listSeedVerticals()` added to `lib/cache/seed.ts` (display names + ad counts for the listing tool)
- [x] Verified via raw JSON-RPC on a production build: initialize + tools/list + all 5 tools/call; existing `/api/*` routes unaffected
- [x] README "Use it from Claude (MCP)" section + ARCHITECTURE.md MCP note
- [ ] Post-deploy: re-run the MCP check against the live Vercel URL

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
- [x] Filterable DNA view (filter chips by angle/format/hookType + count) — Step 3
- [x] **Visual Entity-ID collapse** in Step 5: color-coded concept buckets with real ad copy stacked inside + `N× collapsed` badges
- [x] **Waste quantification**: headline (`N ads → K concepts`, redundant count, `~X%`) + optional budget input → labelled `$` estimate
- [x] **Market-vs-you coverage panel**: proven market angles (by frequency) beside the gap list
- [x] **One-click "Run the full demo"** button (orchestrates mine→DNA→score→generate on the weight-loss seed with smooth scroll)
- [x] Drag-and-drop upload for Module 3
- [x] **Judge tour strip** (P1): "NEW HERE? 60-SECOND TOUR" callout under the header with
      the 3-step happy path + one-click demo button; hidden once `hasAds`
- [x] **Shareable seed-report links** (P2): full-demo runner extracted to
      `runSeedDemo(vertical, sampleSlug)`; successful seed runs encode `?v=&s=` via
      `history.replaceState`; mount effect validates + replays; garbage params ignored;
      "Copy share link" button in Step 5 (seed path only)
- [x] **Production-handoff JSON export** (P3): "Export for production (JSON)" button in
      Step 6 beside CSV — sorted briefs, evidence as `{advertiser, runDays}`, optional
      `batchIntegrity`
- [ ] Loading / partial / empty / error states on every module

---

## Demo hardening 🔄

- [x] Seed-first path for **all four** modules (zero-credential full flow verified)
- [x] Tolerant model-JSON parsing (`lib/ai/json.ts`) so a fenced response can't 500
- [x] Graceful live-source fallback in `/api/mine` (TikTok → Apify → friendly 200)
- [x] `maxDuration = 60` on all AI routes; live score batch-capped at 20
- [x] Loading + error + `unavailable` states wired in `app/page.tsx`
- [x] Tested with zero credentials (no `.env.local`, no shell keys) end-to-end
- [x] Concurrency guard — single-flight dedup on live ad-fetch and DNA-analysis calls (`lib/cache/index.ts`)
- [x] Empty-state polish — empty DNA extraction, empty briefs, empty sample list, empty clustering all surface a message instead of a silent no-op (`app/page.tsx`)

---

## Submission 🔄

- [x] README written (3 contest questions + cost/limits note + MCP usage section; the live-URL placeholder still needs the real Vercel domain filled in after deploy)
- [ ] Live Vercel URL stable
- [ ] Fallback Loom recorded
- [ ] Submitted before July 4, 2026, 11:59 PM ET

**`docs/POLISH_FEATURES_PLAN.md` status:** P5 ✅ (verified in a prior session), P1 ✅, P2 ✅,
P3 ✅ (all this session). P4 (investing-newsletter seed vertical) is **not started** — it's
the plan's explicitly cuttable, quota-spending item; only attempt it once the Vercel deploy
and Loom are done and time/quota allow.
