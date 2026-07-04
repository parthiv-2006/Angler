# CODEMAP: fast codebase orientation

> A terse, current index of every source file: where to change common things, the
> core data shapes, and the request/response flow. If this file and the code
> disagree, the code wins and this file is a bug. Fix it (see the update rule at
> the bottom).
>
> For *why* the system is shaped this way, read `docs/ARCHITECTURE.md`.

Last verified against the tree: **2026-07-04**.

---

## The 30-second model

Single-page Next.js (App Router) demo in the "Angler" design: sticky reel-in nav,
hero plus sonar band, four numbered sections No.1 to No.4. Four modules run
top-to-bottom, each backed by one API route. Every route is **seed-first**: it
serves real cached data with zero credentials, and only calls the live AI/scrape
path when seed data is absent. All AI goes through one provider interface;
feature code never imports a vendor SDK.

```
UI (app/page.tsx = state/handlers, app/components/* = presentation)
  └─ POST /api/{mine,deconstruct,score,generate,preflight}
       └─ lib/cache  ── seed hit? ──► return cached (no creds needed)
       └─ miss ──► lib/sources (scrape) + lib/ai/provider (Claude/Gemini)
                      └─ lib/db (Supabase persist)
```

There is also an **MCP surface** at `/api/mcp` (`app/api/[transport]/route.ts`)
that exposes the seed verticals as read-only tools, with no AI calls.

---

## Where do I change...?

| I want to... | Go to |
|---|---|
| Change app state / API wiring / demo flow | `app/page.tsx` (all state + handlers live here) |
| Change a section's look (nav, hero, No.1 to No.4) | `app/components/<Section>.tsx` |
| Change colors / fonts / shared style fragments | `app/components/theme.ts` + `app/globals.css` |
| Add/adjust a module's API behavior | `app/api/<module>/route.ts` |
| Change an AI prompt | `lib/ai/prompts/<name>.ts` |
| Change the shape the model must return | `lib/ai/schemas.ts` (zod) + `lib/types.ts` (TS) |
| Swap/tune the LLM provider | `lib/ai/provider.ts`, `lib/ai/anthropic.ts`, `lib/ai/gemini.ts` |
| Add/fix a competitor data source | `lib/sources/*` + `lib/sources/normalize.ts` |
| Touch seed-loading / demo-mode | `lib/cache/seed.ts`, `lib/cache/index.ts` |
| Touch Supabase reads/writes | `lib/db/queries.ts` (client in `client.ts`, row types in `types.ts`) |
| Change the DB schema | `supabase/migrations/*.sql` (new numbered file; never edit an applied one) |
| Add/refresh a seed vertical | `data/seed/*.json` via `scripts/refresh-seed.ts` |
| Adjust rate limiting | `lib/rate-limit.ts` |
| Change MCP tools | `app/api/[transport]/route.ts` |

---

## File index

### `app/`: UI + API routes
| File | Responsibility |
|---|---|
| `page.tsx` | Orchestrator: all app state, API handlers, scroll spy, sonar log, audit-reveal animation. Hot path. Keep business logic in `lib/`, markup in `components/`. |
| `layout.tsx` / `globals.css` | Root layout (next/font: Source Serif 4, IBM Plex Sans/Mono) + paper-theme CSS vars, keyframes, hover classes, reduced-motion. |
| `icon.svg` | Fishhook favicon (Next serves it automatically). |
| `components/theme.ts` | Design tokens (colors, font helpers, avatar palette, shared style fragments). |
| `components/Nav.tsx` | Sticky nav + reel-in scroll-progress bar with hook icon. |
| `components/Hero.tsx` | Hero (input, chips, CTA), simulated ad-card collage, sonar status band (`LogLine`). |
| `components/Section.tsx` | Shared numbered-watermark section shell with header rule. |
| `components/CatchSection.tsx` | No.1: ranked ledger, desk note, sticky in-feed preview. |
| `components/DnaSection.tsx` | No.2: filter pills + 3-col DNA card grid (4th tag = offerFraming). |
| `components/AuditSection.tsx` | No.3: load-your-set controls (samples/paste/upload), marginalia + SVG marks, ink plate + merge diagram, clusters + gaps, pre-flight, generate CTA. |
| `components/BriefsSection.tsx` | No.4: brief cards (platform tabs, copy, evidence chips), integrity strip, footer. |
| `api/mine/route.ts` | **Module 1** Competitive Angle Miner. Ranked market ads + winner summary. `fromSeed` flag. |
| `api/deconstruct/route.ts` | **Module 2** Creative-DNA extraction (vision). Hot path. |
| `api/score/route.ts` | **Module 3** Diversity / concept-collapse scoring. |
| `api/generate/route.ts` | **Module 4** Net-new angle briefs. |
| `api/preflight/route.ts` | Pre-flight verdict on a user's ad set. |
| `api/samples/route.ts` | `GET`: lists bundled sample ad sets for the UI. |
| `api/[transport]/route.ts` | MCP server (`mcp-handler`, streamable HTTP) at `/api/mcp`. Seed data only, no AI. |

### `lib/ai/`: provider-agnostic AI layer
| File | Responsibility |
|---|---|
| `provider.ts` | The interface + factory. Selects impl by `AI_PROVIDER`. **Feature code imports only this.** |
| `anthropic.ts` | Anthropic impl (`claude-sonnet-4-6`). |
| `gemini.ts` | Gemini fallback impl (`gemini-2.5-flash`). |
| `schemas.ts` | Zod schemas for every AI input/output (DNA, clustering, briefs, winner summary, preflight). |
| `json.ts` | `parseModelJSON`: tolerant JSON extraction from model text. |
| `briefs.ts` | `briefToDNA`: adapts a generated brief into a DNA shape for re-scoring. |
| `prompts/analyze.ts` | Module-2 DNA extraction prompt. |
| `prompts/cluster.ts` | Module-3 concept-clustering prompt. |
| `prompts/generate.ts` | Module-4 angle-generation prompt. |
| `prompts/preflight.ts` | Preflight-verdict prompt. |
| `prompts/summary.ts` | Winner-summary prompt. |

### `lib/sources/`: competitor data ingestion
| File | Responsibility |
|---|---|
| `tiktok-creative-center.ts` | TikTok Creative Center client (documented production integration). |
| `apify.ts` | Apify actors (Meta Ad Library / TikTok). |
| `normalize.ts` | `normalizeTikTokAd`, `normalizeApifyAd`, `sortByRunDays`, all into the common `Ad` shape. |

### `lib/cache/`: demo-mode / seed-first
| File | Responsibility |
|---|---|
| `seed.ts` | Reads `data/seed/*`: `getSeedAds/DNA/WinnerSummary/Briefs`, `listSeedVerticals`, sample-set + preflight-example getters. |
| `index.ts` | Cache orchestration + `withRetry` exponential backoff. |

### `lib/db/`: Supabase
| File | Responsibility |
|---|---|
| `client.ts` | Server-side Supabase client (service role, never client-exposed). |
| `queries.ts` | Typed reads/writes: `findOrCreateVertical`, `getCachedAds`/`cacheAds`, `getCachedDNA`/`cacheDNA`. |
| `types.ts` | Row types generated from the schema. |

### `lib/`: shared
| File | Responsibility |
|---|---|
| `types.ts` | Domain types: `Ad`, `CreativeDNA`, `ConceptCluster(ing)`, `AngleBrief`, `PreflightVerdict`. |
| `rate-limit.ts` | `rateLimited(req)`: per-IP limiter returning a 429 `NextResponse` or `null`. |

### `data/seed/`: real cached data (never fabricated)
| Path | Contents |
|---|---|
| `weight-loss-supplement.json`, `debt-relief.json`, `ed-telehealth.json`, `investing-newsletter.json` | 4 pre-analyzed verticals (15 real market ads each). |
| `samples/*-redundant.json` | Deliberately low-diversity sample ad sets for the score demo. |

### `supabase/migrations/`
| File | Contents |
|---|---|
| `001_initial_schema.sql` | Initial schema. |
| `002_creative_dna_ad_id_text.sql` | Retype `creative_dna.ad_id` uuid to text (app ad ids like `fb_*` and `upl_*` are not UUIDs). |

### `scripts/` & `tests/`
| Path | Purpose |
|---|---|
| `scripts/refresh-seed.ts` | Regenerate seed verticals from live scrapes (offline pre-compute). |
| `scripts/.cache/` | Local scratch from seed refreshes, not part of the app. |
| `tests/*.test.ts` | Unit tests: `json`, `normalize`, `rate-limit`, `retry`, `seed`. |

### Repo root
| Path | Purpose |
|---|---|
| `.eslintrc.json` | Strict Next.js ESLint config (`next lint` scaffold). |
| `.github/workflows/ci.yml` | CI: typecheck, tests, build, audit. |

---

## Core data shapes (`lib/types.ts`)

The whole pipeline passes these five around. Skim before touching AI/route code.

- **`Ad`**: a normalized market or user ad (source-agnostic).
- **`CreativeDNA`**: deconstructed creative attributes of one ad (Module 2 output).
- **`ConceptCluster` / `ConceptClustering`**: grouped DNA showing concept collapse (Module 3).
- **`AngleBrief`**: one net-new generated angle (Module 4).
- **`PreflightVerdict`**: go/no-go assessment of a user's ad set.

Zod validators for these live in `lib/ai/schemas.ts`. **Keep the two in sync.**

---

## Commands

```bash
npm run dev        # localhost:3000
npm run lint
npm run typecheck  # tsc --noEmit
npm run build      # must pass; Vercel runs it
npm run test
```

---

## Keeping this file honest

This map is only worth reading if it's current. Whenever you add, remove,
rename, or repurpose a file, or change a core type or the request flow, update
this file in the same change and bump the "Last verified" date. A stale codemap
is worse than none: it sends the next reader to the wrong file.
