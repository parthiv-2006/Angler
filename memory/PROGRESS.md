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
- [x] **Supabase `creative_dna.ad_id` uuid→text fix (2026-07-03)** — every live DNA cache write was silently failing (`22P02 invalid input syntax for type uuid`) because the app's own ad ids (`paste_*`, `upload_*`, `preflight_*`, `fb_*`, `tiktok_*`) are never real UUIDs. Migration `002` applied to the live project; see [[GOTCHAS]].
- [ ] **`.env.local` `GEMINI_MODEL` override caused a real outage (found + fixed 2026-07-03)** — it was pinned to `gemini-2.5-flash-lite`, whose 20-req/day free quota was exhausted, so every live AI call (`/api/deconstruct`, live score/generate) 429'd with `Failed to analyze creatives`. Removed the override so the provider default (`gemini-2.5-flash`, confirmed working) applies. **Not yet re-verified live after this change** — re-run the paste-your-own-ads flow to confirm before relying on it.
- [x] **Real Anthropic Console API key added (2026-07-03)** — `.env.local` now has a genuine `sk-ant-api03-...` key (replacing the `sk-ant-oat01-...` OAuth token that 401'd), and `AI_PROVIDER=anthropic`. Verified directly against `api.anthropic.com/v1/messages`: both a generic model and the app's actual `claude-sonnet-4-6` (used by `lib/ai/anthropic.ts` for all three entry points) return real `200` completions. All live (non-seed) AI calls — `analyzeCreative`, `clusterConcepts`, `generateJSON` — now genuinely run on Claude instead of silently falling back to Gemini. **Not yet re-verified through the app's own routes** (only raw API tested) — run the live paste/upload flow once end-to-end before the demo, especially the image-upload/vision path in Module 3, which has only been verified against Gemini so far, never Anthropic. $5 in credits was added; at ~$0.01–0.05/ad and a few cents per cluster/generate call, that covers 10+ full live demo runs — ample for the deadline.
- [x] README written (3 contest questions, data provenance, cost/limits, MCP usage section)
- [ ] Vercel deploy

---

## Module 1 — Competitive Angle Miner ✅

- [x] TikTok Creative Center source (`lib/sources/tiktok-creative-center.ts`)
- [x] Apify source stub (`lib/sources/apify.ts`)
- [x] Ad normalizer (`lib/sources/normalize.ts`) — `normalizeTikTokAd`, `normalizeApifyAd`, `sortByRunDays`
- [x] 4 seed verticals: `weight-loss-supplement`, `debt-relief`, `ed-telehealth`, `investing-newsletter` (15 market ads each, from real Apify scrapes)
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
- [x] Re-verified zero-cred after P4: `list_verticals` now returns **4** verticals (incl. `investing-newsletter`, adCount 15); `get_market_winners`/`get_angle_briefs` serve it
- [x] README "Use it from Claude (MCP)" section + ARCHITECTURE.md MCP note
- [ ] Post-deploy: re-run the MCP check against the live Vercel URL

---

## UI — "Angler — Final" redesign ✅ (2026-07-04)

- [x] Full visual redesign implemented from `design_handoff_creative_strategist/` (claude.ai/design
      handoff): paper theme, Source Serif 4 / IBM Plex Sans / IBM Plex Mono via next/font,
      sticky reel-in nav + scroll spy, hero with ad-wall collage, sonar status band with real
      pipeline log lines, four Nº-watermarked sections (catch ledger + sticky in-feed preview,
      DNA filter grid, entity-ID audit with ink plate + animated merge diagram + hand-drawn
      SVG marks + count-up, brief cards with platform tabs), integrity strip, footer, fishhook favicon
- [x] Markup split into `app/components/*` (Nav, Hero, Section, Catch/Dna/Audit/BriefsSection,
      theme.ts); all state/handlers stay in `app/page.tsx`
- [x] **Feature parity verified in-browser on a production build**: 15-second demo, seed chips,
      live-mine path for novel verticals, DNA filters + clear, sample scoring, paste captions,
      image upload (drag-drop, compress, remove), budget waste estimate, clusters + gaps +
      market-angle pills, pre-flight (seed chips / paste / screenshot), briefs with per-variant
      copy + COPY BRIEF, CSV + production-JSON export, brief-batch integrity self-score,
      share links (?v=&s= replay re-verified cold), error pill + empty states, Enter-to-cast
- [x] `npm run lint` now real: `.eslintrc.json` scaffolded (next/core-web-vitals + TS strict) — clean
- [x] Fixed pre-existing 400: seed ads with >10k-char copy broke `/api/deconstruct` after the
      security input caps; client now trims copy to the cap before sending (see GOTCHAS)

## UI — `app/page.tsx` (pre-redesign history) 🔄

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
- [x] **Fourth seed chip** (P4): "Investing Newsletter" added to `SEED_VERTICALS`
      (`value: "investing newsletter"` → slug `investing-newsletter`)
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

## Security audit — 2026-07-04 ✅

- [x] Path traversal closed: seed/sample loaders reject slugs outside `[a-z0-9-]`
- [x] Uploaded/pasted DNA cached by content hash (cross-user `paste_0` collision fixed)
- [x] Input size caps on all strings/arrays reaching paid model calls
- [x] Best-effort per-IP rate limiting (30/min) on the five spend routes; seed paths unmetered
- [x] Apify poll fits the 60s route budget; paid runs never retried
- [x] `withRetry`: no dead sleep after final attempt; non-retryable 4xx fail fast
- [x] DB races handled (vertical unique-slug race, duplicate DNA rows)
- [x] CSV formula-injection guard; security headers; postcss override (npm audit clean)
- [x] `npm test`: 21 unit tests (node:test via tsx); GitHub Actions CI (typecheck/test/build/audit)
- [x] Zero-credential e2e re-verified on a production build (all routes + MCP + failure paths)

---

## Submission 🔄

- [x] README written (3 contest questions + cost/limits note + MCP usage section; the live-URL placeholder still needs the real Vercel domain filled in after deploy)
- [ ] Live Vercel URL stable
- [ ] Fallback Loom recorded
- [ ] Submitted before July 4, 2026, 11:59 PM ET

**`docs/POLISH_FEATURES_PLAN.md` status:** **ALL FIVE SHIPPED.** P5 ✅, P1 ✅, P2 ✅, P3 ✅,
and **P4 ✅ (2026-07-03)** — investing-newsletter seed vertical shipped on the
`financial newsletter` query (after `investing newsletter` and `stock picks` came back too
noisy). Verified zero-cred in-browser + MCP. The remaining submission blockers are the
**Vercel deploy + fallback Loom** (§ Submission below), which outrank everything in the
polish plan.
