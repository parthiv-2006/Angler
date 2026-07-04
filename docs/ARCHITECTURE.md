# ARCHITECTURE: Creative Strategist

> How it's built. Pairs with `INTEGRATIONS.md` (the practical wiring of each external
> service) and `CODEMAP.md` (the file-level index).

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
                         │   ├─ /mine        ── lib/sources/*            │──► Apify actors
                         │   ├─ /deconstruct ── lib/ai/provider (vision) │    (Meta Ad Library)
                         │   ├─ /score       ── lib/ai/provider          │──► Anthropic API
                         │   └─ /generate    ── lib/ai/provider          │    (Gemini fallback)
                         │       │                  │                    │
                         │       ▼                  ▼                    │
                         │  lib/cache/   ◄────► lib/db (Supabase)        │──► Supabase
                         │  (demo mode)        (typed queries)           │
                         └──────────────────────────────────────────────┘
```

**Request lifecycle (typical):** UI calls a route handler; the handler checks
Supabase/cache for this vertical; on miss, it pulls from a public source and/or calls
the LLM provider, writes results back to Supabase (cache), and returns typed JSON for
the UI to render.

**Data flow across modules:** `mine` produces ads; `deconstruct` turns them into
structured DNA; `score` (with user uploads) produces clusters + gaps; `generate`
produces angle briefs. Each module's output is a stable typed contract consumed by the
next.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js (App Router) + React 19 + TypeScript** |
| Hosting | **Vercel** |
| AI (vision + reasoning + generation) | **Anthropic API** via a provider-agnostic interface; **Gemini free tier** fallback |
| Diversity engine | **LLM concept-clustering**; embeddings + cosine is a documented fast-follow |
| Persistence / cache | **Supabase** (Postgres) |
| Competitor data | **Apify actors** (Meta Ad Library); TikTok Creative Center wired as a documented integration |
| Input validation | zod at every route boundary |

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
   ├─ generate/route.ts     # Module 4
   └─ [transport]/route.ts  # MCP server (streamable HTTP at /api/mcp)
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

`app/page.tsx` stays thin; logic lives in `lib/` so module boundaries are obvious to
anyone reading the code.

**MCP surface:** `app/api/[transport]/route.ts` (via `mcp-handler`) exposes the seed
data as five MCP tools at `/api/mcp`. Stateless streamable HTTP only (no SSE/Redis),
no AI calls, payloads trimmed for tokens. Next.js static API routes take precedence
over the dynamic `[transport]` segment, so the four module routes are unaffected.
Live pulls stay in the web app; MCP serves the pre-analyzed verticals.

---

## The LLM provider abstraction

**Rule:** feature code never imports a vendor SDK directly. It depends on one interface.
Swapping providers is one env var (`AI_PROVIDER`).

```ts
// lib/ai/provider.ts  (shape, not final code)
export interface AIProvider {
  // Module 2: multimodal. Analyze a creative's cover frame + copy into structured DNA.
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
- **Default workhorse:** `claude-sonnet-4-6`. Strong multimodal + reasoning at sensible
  cost; used for `analyzeCreative`, `clusterConcepts`, and `generateJSON`.
- **Cheap/fast path:** `claude-haiku-4-5-20251001` for lighter formatting calls
  (e.g. platform copy reformatting) if cost/latency needs trimming.
- Model availability changes; confirm current model strings and limits at
  `https://docs.claude.com/en/api/overview`.

**Structured output:** prompt the model to return JSON only and validate with zod before
use. Never parse free-form prose into app state.

---

## Diversity engine (the one non-obvious decision)

**Shipped: LLM concept-clustering.** Feed the structured DNA of the user's ad set to
Claude; it returns concept clusters, each ad's cluster assignment, a one-line reason per
ad, and near-duplicate flags. The UI renders **"N ads collapse to K concepts."**

**Why this over embeddings + cosine:**
- An *explained* grouping ("these 4 share a fear-of-missing-out hook + testimonial
  format") is more useful to a buyer than a bare similarity number.
- No extra dependency, and the visible intelligence stays on Claude.
- Avoids running heavy embedding/CLIP models on Vercel serverless (cold starts, bundle
  size). Anthropic also has no first-party embeddings endpoint, so an all-Anthropic
  embeddings pipeline isn't an option anyway.
- Ships faster and is more robust under a deadline.

**Documented fast-follow:** an embeddings-based **quantitative diversity score** (cosine
similarity over the structured DNA text) for a defensible numeric metric alongside the
explained clusters. Embeddings provider would be Gemini's free embeddings or Voyage AI
(Anthropic-aligned, multimodal); see `INTEGRATIONS.md`. Compute similarity **in memory**;
no vector DB needed at this scale.

---

## Data model (Supabase / Postgres)

Tables (columns are indicative; generate types from the live schema):

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
  ad_id text,                  -- cache key: a competitor ad's stable library id (fb_*/
                                -- tiktok_*), or for uploaded/pasted ads a content hash
                                -- (upl_<sha256 prefix>). Client ids like paste_0 repeat
                                -- across users, so they are never used as cache keys.
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
`data/seed/` so they never depend on a live call.

**RLS:** this is a single shared demo with no user accounts. All writes stay server-side
via the service-role key; no write paths are exposed to the client. If RLS is enabled,
add permissive read policies for the demo and keep service-role for writes.

---

## Caching, rate limiting, reliability

The live URL must never feel flaky. Required:

- **Demo mode (`DEMO_MODE=true`):** seed verticals + sample ad sets render instantly from
  cache. First clicks should be sub-second.
- **Write-through cache:** any live pull or analysis is persisted to Supabase keyed by
  vertical so a repeat is instant.
- **Retry with exponential backoff + jitter** on every external call (scrapers and model
  calls); cap attempts, then fall back to a cached/sample result rather than erroring.
- **Concurrency guard:** if multiple visitors click simultaneously, prefer cache and
  serialize/limit live model calls to avoid tripping provider rate limits.
- **Serverless limits:** vision analysis over many ads + scraping can exceed default
  Vercel function timeouts. Mitigations: (a) analyze cover frames only, (b) limit
  live batch size, (c) stream partial results to the UI, and (d) do the heavy
  pre-analysis offline into `data/seed/`. See `INTEGRATIONS.md` for limits.
- **Graceful UI states** everywhere: loading, partial, empty, and error. Never a hung
  spinner or blank screen.

---

## Security

- **All secrets server-side.** API keys live in route handlers / server code only, never
  in client bundles or `NEXT_PUBLIC_*` (except the Supabase anon key, which is designed to
  be public).
- **Never use a Claude Code subscription / OAuth token to serve app traffic.** It
  violates Anthropic's usage policy and risks the account. The app uses an
  `ANTHROPIC_API_KEY` from the Console. (See `INTEGRATIONS.md`.)
- Validate and sanitize all user input (vertical strings, uploaded files) at the boundary.
- Treat uploaded creatives as untrusted: size/type limits, no execution.

Implemented protections (2026-07-04 security audit):

- **Slug validation:** every seed/sample file loader rejects slugs outside
  `[a-z0-9-]` before touching the filesystem, closing path traversal via
  `/api/samples?slug=`, `/api/score` `sampleSetId`, and `/api/preflight` `sampleSetId`.
- **Bounded inputs:** request-side schema variants cap every client-supplied string
  and array (`creativeDNAInputSchema`, `conceptClusteringInputSchema`, per-ad caps in
  `/api/deconstruct`) so a crafted request can't feed megabytes into a paid model call.
- **Rate limiting:** `lib/rate-limit.ts` applies a best-effort in-memory
  30 req/min/IP window to the five spend routes, after the seed short-circuits so
  the zero-credential demo is never metered.
- **Cache keying:** uploaded/pasted ad DNA is cached by content hash, never by the
  client's reused `paste_0`-style ids (prevents cross-user cache poisoning).
- **Response headers:** `nosniff`, `X-Frame-Options: DENY`, and a strict referrer
  policy on all responses (`next.config.ts`).
- **CSV export** neutralizes spreadsheet formula injection (`=`, `+`, `-`, `@` prefixes).

---

## Key technical decisions

| Decision | Choice | Why |
|---|---|---|
| AI provider | Anthropic API, abstracted; Gemini fallback | Provider abstraction keeps a $0 escape hatch and makes swapping one env var |
| AI auth | Console API key | Subscription tokens can't legally serve app traffic |
| Diversity method | LLM clustering | Explained beats numeric for buyers; no serverless ML; ships fast |
| Video analysis | Cover frame + copy + metadata, not full video | Similar hook/angle signal at a fraction of cost/latency |
| Storage | Supabase | Doubles as the cache |
| Similarity compute (when added) | In-memory cosine | Scale is tiny; no vector DB needed |
| Demo reliability | Seed cache + retry/backoff | The live URL must work first try, every time |
| Data sourcing | Apify (Meta Ad Library) | Public, real signal, zero visitor credentials |
