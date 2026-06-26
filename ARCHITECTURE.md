# ARCHITECTURE — Creative Strategist

> How it's built. Pairs with `INTEGRATIONS.md` (the practical wiring of each external
> service). Decisions here are confirmed; flag before deviating.

---

## System overview

```
                         ┌──────────────────────────────────────────────┐
                         │  Next.js (App Router) on Vercel               │
                         │                                               │
  Browser ──────────────►  app/page.tsx  (single-page demo UI)          │
   (no login)            │       │                                       │
                         │       ▼  fetch                                │
                         │  app/api/* route handlers (server-only)       │
                         │   ├─ /mine        ── lib/sources/*            │──► TikTok Creative
                         │   ├─ /deconstruct ── lib/ai/provider (vision) │──► Center (public)
                         │   ├─ /score       ── lib/ai/provider          │──► Apify actors
                         │   └─ /generate    ── lib/ai/provider          │──► Anthropic API
                         │       │                  │                    │    (Gemini fallback)
                         │       ▼                  ▼                    │
                         │  lib/cache/   ◄────► lib/db (Supabase)        │──► Supabase
                         │  (demo mode)        (typed queries)           │
                         └──────────────────────────────────────────────┘
```

**Request lifecycle (typical):** UI calls a route handler → handler checks
Supabase/cache for this vertical → on miss, pulls from a public source and/or calls the
LLM provider → writes results back to Supabase (cache) → returns typed JSON → UI renders.

**Data flow across modules:** `mine` → ads → `deconstruct` → structured DNA → `score`
(with user uploads) → clusters + gaps → `generate` → angle briefs. Each module's output
is a stable typed contract consumed by the next.

---

## Tech stack (confirmed)

| Layer | Choice |
|---|---|
| Framework | **Next.js (App Router) + React 19 + TypeScript** (mirrors their stack) |
| Hosting | **Vercel** (free `*.vercel.app`; real domain optional and "cooler") |
| AI (vision + reasoning + generation) | **Anthropic API** via a provider-agnostic interface; **Gemini free tier** fallback |
| Diversity engine | **LLM concept-clustering** (MVP); embeddings + cosine = fast-follow |
| Persistence / cache | **Supabase** (Postgres) |
| Competitor data | **TikTok Creative Center** (primary) + **Apify** actors |
| Input validation | zod (or equivalent) at every route boundary |

---

## App structure

```
app/
├─ page.tsx                 # the whole demo experience (stepped UI: mine → DNA → score → generate)
├─ layout.tsx
└─ api/
   ├─ mine/route.ts         # Module 1
   ├─ deconstruct/route.ts  # Module 2 (vision)
   ├─ score/route.ts        # Module 3
   └─ generate/route.ts     # Module 4
lib/
├─ ai/
│  ├─ provider.ts           # interface + factory (selects impl by AI_PROVIDER)
│  ├─ anthropic.ts          # Anthropic implementation
│  ├─ gemini.ts             # Gemini fallback implementation
│  └─ prompts/              # versioned prompt templates per module
├─ sources/
│  ├─ tiktok-creative-center.ts
│  ├─ apify.ts
│  └─ normalize.ts          # → common Ad shape
├─ db/
│  ├─ client.ts             # Supabase server client (service role)
│  ├─ queries.ts            # typed reads/writes
│  └─ types.ts              # generated from schema
└─ cache/
   └─ index.ts              # demo-mode cache (Supabase-backed + seed files)
data/seed/                  # pre-analyzed verticals + sample ad sets (real cached data)
```

Keep `app/page.tsx` thin — push logic into `lib/`. The judge reads this code; module
boundaries should be obvious.

---

## The LLM provider abstraction

**Rule:** feature code never imports a vendor SDK directly. It depends on one interface.
Swapping providers is one env var (`AI_PROVIDER`).

```ts
// lib/ai/provider.ts  (shape, not final code)
export interface AIProvider {
  // Module 2: multimodal — analyze a creative's cover frame + copy → structured DNA
  analyzeCreative(input: {
    imageBase64?: string;
    imageUrl?: string;
    copy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CreativeDNA>;

  // Module 3: cluster DNA records into concepts with reasons
  clusterConcepts(dna: CreativeDNA[]): Promise<ConceptClustering>;

  // Module 2 summary + Module 4: text generation against a typed schema
  generateJSON<T>(args: { system: string; prompt: string; schema: ZodType<T> }): Promise<T>;
}

export function getProvider(): AIProvider { /* anthropic | gemini by env */ }
```

**Model selection (Anthropic):**
- **Default workhorse:** `claude-sonnet-4-6` — strong multimodal + reasoning at sensible
  cost; use for `analyzeCreative`, `clusterConcepts`, and `generateJSON`.
- **Cheap/fast path:** `claude-haiku-4-5-20251001` — fine for lighter formatting calls
  (e.g. platform copy reformatting) if you want to trim cost/latency.
- **Heaviest reasoning (optional):** `claude-opus-4-8` — only if a step clearly needs it;
  usually unnecessary here.
- Confirm current model strings/limits via `https://docs.claude.com/en/api/overview`
  (per the product-self-knowledge guidance — model availability changes).

**Structured output:** prompt the model to return JSON only and validate with zod before
use. Never parse free-form prose into app state.

---

## Diversity engine (the one non-obvious decision)

**MVP = LLM concept-clustering.** Feed the structured DNA of the user's ad set to Claude;
it returns concept clusters, each ad's cluster assignment, a one-line reason per ad, and
near-duplicate flags. The UI renders **"N ads → K concepts."**

**Why this over embeddings + cosine for the MVP:**
- An *explained* grouping ("these 4 share a fear-of-missing-out hook + testimonial
  format") is more useful to a buyer than a bare similarity number — and more impressive
  in a demo.
- Keeps the visible intelligence on Claude (their stack) with no extra dependency.
- Avoids running heavy embedding/CLIP models on Vercel serverless (cold starts, bundle
  size). Anthropic also has **no first-party embeddings endpoint**, so "all-Anthropic
  embeddings" isn't even an option.
- Ships faster and is more robust in nine days.

**Documented fast-follow (put it in the README's "what's next"):** add an
embeddings-based **quantitative diversity score** (cosine similarity over the structured
DNA text) for a defensible numeric metric alongside the explained clusters. Embeddings
provider would be Gemini's free embeddings or Voyage AI (Anthropic-aligned, multimodal) —
see `INTEGRATIONS.md`. Compute similarity **in memory**; no vector DB needed at this
scale.

---

## Data model (Supabase / Postgres)

Tables (columns are indicative — generate types from the live schema):

```sql
-- a searched vertical/offer
verticals (
  id uuid pk,
  slug text unique,            -- "weight-loss-supplement"
  display_name text,
  is_seed boolean default false,  -- true for demo-mode pre-analyzed verticals
  created_at timestamptz default now()
)

-- a competitor ad pulled from a public source (Module 1), cached
competitor_ads (
  id uuid pk,
  vertical_id uuid fk -> verticals,
  source text,                 -- "tiktok_creative_center" | "apify_meta" | ...
  advertiser text,
  cover_url text,
  copy text,
  first_seen date,
  last_seen date,
  run_days int,                -- the winning signal
  raw_metrics jsonb,
  fetched_at timestamptz default now()
)

-- structured DNA for an ad (Module 2). Works for competitor AND uploaded ads.
creative_dna (
  id uuid pk,
  ad_id uuid,                  -- competitor_ads.id OR an uploaded_ads.id
  ad_kind text,                -- "competitor" | "uploaded"
  hook_type text,
  angle text,
  format text,
  offer_framing text,
  cta_style text,
  target_persona text,
  one_line_summary text,
  model text,                  -- which model produced this (provenance)
  created_at timestamptz default now()
)

-- a user-uploaded ad set for the diversity scorer (Module 3)
uploaded_sets ( id uuid pk, label text, created_at timestamptz default now() )
uploaded_ads  ( id uuid pk, set_id uuid fk -> uploaded_sets, cover_url text, copy text )

-- a diversity report (Module 3 output)
diversity_reports (
  id uuid pk,
  set_id uuid fk -> uploaded_sets,
  vertical_id uuid fk -> verticals null,
  n_ads int,
  k_concepts int,
  clusters jsonb,              -- [{ concept, ad_ids[], reason }]
  gaps jsonb,                  -- market angles absent from the set
  created_at timestamptz default now()
)

-- a generated angle batch (Module 4 output)
angle_batches (
  id uuid pk,
  vertical_id uuid fk -> verticals,
  set_id uuid fk -> uploaded_sets null,
  briefs jsonb,               -- [{ angle_name, emotional_driver, why_now, hook_line,
                              --     format_recommendation, target_persona, priority,
                              --     variants: { meta, tiktok, native } }]
  created_at timestamptz default now()
)
```

**Cache semantics:** `competitor_ads` + `creative_dna` are the cache. A `mine`/`deconstruct`
request first checks for a fresh row set for the vertical; on hit, return it; on miss, do
the live work and write through. Seed verticals (`is_seed = true`) are populated from
`data/seed/` at build/first-run so they never depend on a live call.

**RLS:** this is a single shared demo with no user accounts. Keep writes server-side via
the service-role key; do not expose write paths to the client. If you enable RLS, add
permissive read policies for the demo and keep service-role for writes.

---

## Caching, rate limiting, reliability

The live URL must never feel flaky (it's a judging criterion by proxy). Required:

- **Demo mode (`DEMO_MODE=true`):** seed verticals + sample ad sets render instantly from
  cache. The judge's first clicks should be sub-second.
- **Write-through cache:** any live pull or analysis is persisted to Supabase keyed by
  vertical so a repeat is instant.
- **Retry with exponential backoff + jitter** on every external call (scrapers and model
  calls); cap attempts, then fall back to a cached/sample result rather than erroring.
- **Concurrency guard:** if multiple judges click simultaneously, prefer cache and
  serialize/limit live model calls so you don't trip provider rate limits.
- **Serverless limits:** vision analysis over many ads + scraping can exceed default
  Vercel function timeouts. Mitigate by (a) analyzing cover frames only, (b) limiting
  live batch size, (c) streaming partial results to the UI, and/or (d) doing the heavy
  pre-analysis offline into `data/seed/`. See `INTEGRATIONS.md` for limits.
- **Graceful UI states** everywhere: loading, partial, empty, and error — never a hung
  spinner or blank screen.

---

## Security

- **All secrets server-side.** API keys live in route handlers / server code only, never
  in client bundles or `NEXT_PUBLIC_*` (except the Supabase anon key, which is designed to
  be public).
- **Never use a Claude Code subscription / OAuth token to serve app traffic** — it
  violates Anthropic's usage policy and risks the account. App uses an
  `ANTHROPIC_API_KEY` from the Console. (See `INTEGRATIONS.md` and the warning in
  `CLAUDE.md`.)
- Validate and sanitize all user input (vertical strings, uploaded files) at the boundary.
- Treat uploaded creatives as untrusted: size/type limits, no execution.

---

## Key technical decisions

| Decision | Choice | Why |
|---|---|---|
| AI provider | Anthropic API, abstracted; Gemini fallback | Their stack + pitch; abstraction keeps $0 escape hatch |
| AI auth | Console API key | Subscription tokens can't legally serve app traffic |
| Diversity method | LLM clustering (MVP) | Explained > numeric; no serverless ML; ships fast |
| Video analysis | Cover frame + copy + metadata, not full video | ~Same hook/angle signal at a fraction of cost/latency |
| Storage | Supabase | Their stack; doubles as the cache |
| Similarity compute (when added) | In-memory cosine | Scale is tiny; no vector DB needed |
| Demo reliability | Seed cache + retry/backoff | Bulletproof live URL is effectively a judging criterion |
| Data sourcing | TikTok Creative Center + Apify | Free, public, real signal, zero judge credentials |
