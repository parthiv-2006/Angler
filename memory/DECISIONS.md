# Implementation Decisions

> Coding decisions made *during* implementation that aren't in the architecture docs.
> Answers "why is it built this way?" for non-obvious choices.
> Updated via "update memory".

---

## Shareable seed-report links resolve `window.location.search` in an effect, never `useSearchParams`

**Decision:** `app/page.tsx`'s replay logic reads `new URLSearchParams(window.location.search)`
inside the existing mount `useEffect` and writes with `history.replaceState` — it never
imports `useSearchParams` from `next/navigation`.
**Why:** In Next 15, any component that calls `useSearchParams` must be wrapped in a
`<Suspense>` boundary or the production build fails. The page is a single client component
with no existing Suspense boundary, so introducing `useSearchParams` would require
restructuring the tree just to read two query params. Plain `window.location` access inside
a `"use client"` effect avoids that entirely and was verified to build clean.
**Files:** `app/page.tsx`

---

## `runSeedDemo` resolves the sample slug via a fresh fetch, not `state.sampleSets`

**Decision:** When `runSeedDemo(vertical, sampleSlugParam)` is called with `sampleSlugParam
=== null`, it fetches `/api/samples` itself to resolve the fallback slug, instead of reading
the component's `state.sampleSets`.
**Why:** The mount-time replay path calls `runSeedDemo` from inside the same effect that
populates `state.sampleSets` — reading component state there would race the `setState` call
and could resolve against an empty array. A fresh fetch makes `runSeedDemo` correct
regardless of caller (button click after mount, or replay during mount).
**Files:** `app/page.tsx`

---

## Reconstructing atomic commits from a single edit pass: diff with `--strip-trailing-cr`

**Decision:** When splitting a multi-feature edit session (P1–P3, all in `app/page.tsx`)
into separate commits, the file was reverted to HEAD and each feature's edits reapplied in
stages. To confirm the reconstructed final state matched the originally-verified version
byte-for-byte, `diff --strip-trailing-cr` was used instead of plain `diff`.
**Why:** `git checkout` re-normalizes line endings per `core.autocrlf` (this repo converts
LF → CRLF on checkout), so a plain `diff` against a pre-checkout backup shows every line as
changed even when content is identical — a false positive that would otherwise force an
unnecessary re-verification (rebuild + re-test in browser) of already-verified code.
**Files:** N/A (workflow note, not a code change)

---

## Single-flight in-memory dedup for concurrent live calls

**Decision:** `getOrFetchAds` and `getOrAnalyzeDNA` in `lib/cache/index.ts` wrap their live-call step in a `Map<string, Promise>`-based dedupe keyed by `ads:${verticalId}` / `dna:${adId}`. A second concurrent request for the same key awaits the first's in-flight promise instead of firing its own live fetch/analysis.
**Why:** A double-click, React re-render, or two near-simultaneous requests for the same novel vertical would otherwise both miss cache and both pay for a live call — wasted AI/API spend and a race on the Supabase write-through. This is process-local (only dedupes within one warm serverless instance), which is sufficient for the demo's traffic pattern and avoids adding external coordination (Redis, etc.) for a scope that doesn't need it.
**Files:** `lib/cache/index.ts`

---

## Cache hierarchy: seed-first, not Supabase-first

**Decision:** Cache lookup order is seed JSON → Supabase → live fetch, not Supabase → seed → live.
**Why:** The seed path must work with zero credentials. If Supabase is checked first, the app throws when env vars are absent. Putting seed first means the 3 demo verticals always work instantly regardless of infrastructure state.
**Files:** `lib/cache/index.ts`, `lib/cache/seed.ts`

---

## Supabase imports are dynamic

**Decision:** All `lib/db/queries` imports inside `lib/cache/index.ts` use `await import(...)`.
**Why:** Static imports would cause the app to crash at startup if `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are absent. Dynamic imports defer the crash to the call site, where `hasSupabase()` guards them.
**File:** `lib/cache/index.ts`

---

## No Supabase generic on `createClient`

**Decision:** `lib/db/client.ts` uses `createClient(url, key)` with no `Database` generic.
**Why:** The generic causes Supabase's query builder to infer result types as `never`, breaking all typed queries. Using explicit `as RowType` casts in `queries.ts` achieves the same type safety without the inference bug.
**Files:** `lib/db/client.ts`, `lib/db/queries.ts`

---

## Winner summary for novel verticals returns `null` (not generated)

**Decision:** For verticals not in `data/seed/`, `getSeedWinnerSummary()` returns `null` and the `mine` route passes `null` to the UI. No AI generation happens in Module 1.
**Why:** Simplest implementation for Day 1–2. The "what's winning and why" summary for novel verticals is Day 3–4 work — it belongs in the deconstruct flow after DNA is extracted, not in the mine route.
**Planned fix:** After `/api/deconstruct` returns DNA for all ads, call `provider.generateJSON()` to synthesize a winner summary from the DNA batch.

---

## `withRetry` jitter formula

**Decision:** Delay = `min(1000 * 2^attempt + random(0..200)ms, 10_000ms)`.
**Why:** Pure exponential backoff causes thundering herd under concurrent retries (e.g. multiple judge clicks simultaneously). The `+random(0..200)` jitter spreads retries across time. 10s cap prevents unbounded waits.
**File:** `lib/cache/index.ts`

---

## Supabase RLS: public permissive read, service role for writes

**Decision:** RLS policies allow public read (no auth). All writes go through the service role key (server-side only).
**Why:** The demo has no user accounts. Public read lets the judge see the same cached data everyone else does. Service role for writes prevents client-side cache poisoning.
**File:** `supabase/migrations/001_initial_schema.sql`

---

## Module 3 scores the user's OWN ad set; sample sets are pre-baked

**Decision:** Module 3 (Diversity Scorer) clusters a *user-supplied* ad set (a one-click
sample set from `data/seed/samples/`, or pasted captions), not the mined competitor ads.
Sample sets ship with pre-baked `clustering` so the seed demo is instant and deterministic.
**Why:** The product's whole wedge (Entity-ID collapse) is about the user's *own* redundancy.
The earlier UI mistakenly clustered competitor DNA. Sample sets are deliberately redundant
(8→3, 6→2) so the "N ads → K concepts" headline lands. Paste is the live (key-required)
path; sample sets are the zero-credential path.
**Files:** `data/seed/samples/*.json`, `app/api/samples/route.ts`, `app/api/score/route.ts`, `app/page.tsx`

## Modules 3 & 4 are seed-first, like Modules 1 & 2

**Decision:** `/api/score` returns a pre-baked sample clustering when `sampleSetId` matches a
seed sample; `/api/generate` returns pre-baked `briefs` when the vertical is a seed vertical.
Live AI runs only for novel verticals / pasted sets.
**Why:** Hard Rule #6 (seed-first) + #5 (every live call needs a cached fallback) + the
Vercel timeout budget. A live `generate` (~10 briefs × variants) can take 20–35s and would
time out; pre-baking removes that from the judging path entirely.
**Files:** `app/api/score/route.ts`, `app/api/generate/route.ts`, `lib/cache/seed.ts`

## Diversity gaps are grounded in mined market DNA

**Decision:** `clusterConcepts(dna, marketDNA?)` passes the Module 1–2 winners into the
clustering call; gaps = proven market angles absent from the user's set.
**Why:** Without market context the model hallucinated gaps from general knowledge, breaking
the "grounded in what's actually winning in THIS vertical" promise.
**Files:** `lib/ai/provider.ts`, `lib/ai/prompts/cluster.ts`, both provider impls

## Design docs live in `docs/`

**Decision:** The 5 design docs were moved from repo root into `docs/` (via `git mv`).
**Why:** `CLAUDE.md` referenced `./docs/CONTEXT.md` etc., but the files were at root —
broken links in a repo the judge reads. Cross-doc references between them are bare filenames,
so they still resolve now that all 5 share `docs/`.

## Image upload reuses `/api/deconstruct` → `/api/score`; no new endpoints

**Decision:** The Module 3 image-upload feature adds one optional field
(`imageBase64` on `adInputSchema`) and one optional field (`adKind` on the top-level
request) to the existing `/api/deconstruct` route, plus a `handleScoreUpload` client
handler that mirrors `handleScorePaste`. No new API route, no new AI-provider methods —
both providers already accepted `imageBase64` in `analyzeCreative()`.
**Why:** The vision pipeline (image → `CreativeDNA`) already existed for competitor ads;
the only gap was that the user's *own* ad set could only be scored via typed captions.
Minimum-diff additive change over a parallel code path.
**Files:** `app/api/deconstruct/route.ts`, `app/page.tsx`

## Client-side image compression, not a server body-size workaround

**Decision:** Uploaded images are resized to ≤1024px longest edge and re-encoded as
JPEG quality 0.8 via an off-screen `<canvas>` in the browser before upload, capped at 10
images per batch.
**Why:** Vercel's Route Handler body limit (~4.5MB) isn't configurable in the App Router
(no `bodyParser.sizeLimit` equivalent). Compressing client-side keeps every request well
under that limit by construction, regardless of the source photo's size, with no server
config needed.
**Files:** `app/page.tsx` (`compressImage`)

## `clusterConcepts` takes `{adId, dna}[]`, not bare `CreativeDNA[]`

**Decision:** Changed the clustering call's DNA parameter from `CreativeDNA[]` to
`{ adId: string; dna: CreativeDNA }[]` across `AIProvider`, both provider implementations,
`/api/score`, the cluster prompt, and every caller (`app/page.tsx`, `scripts/refresh-seed.ts`).
**Why:** Discovered while verifying the image-upload feature end-to-end: without a real id
in the prompt payload, the model had nothing to anchor `adIds` to and fabricated its own
labels, so Step 5's ad-thumbnail/copy lookup (`adById.get(id)`) silently failed on every
non-seed clustering call. See [[gotchas#clustering-pipeline]] for the full symptom.
**Files:** `lib/ai/provider.ts`, `lib/ai/prompts/cluster.ts`, `lib/ai/anthropic.ts`,
`lib/ai/gemini.ts`, `app/api/score/route.ts`, `app/page.tsx`, `scripts/refresh-seed.ts`

## Ad longevity (`run_days`) as the winning signal, not CTR/views

**Decision:** Ads are ranked by `run_days` (how long the ad has been running), not by raw view counts or CTR.
**Why:** In affiliate marketing, advertisers kill losing ads fast. An ad that has been running for 30+ days is almost certainly profitable — the advertiser has proven it. `run_days` is a free, public, reliable proxy for profitability. This is a key insight the README should highlight.
**Files:** `lib/sources/normalize.ts`, `app/api/mine/route.ts`

## MCP server: seed-only tools, no AI calls, streamable HTTP without SSE

**Decision:** The MCP endpoint (`app/api/[transport]/route.ts`, Feature C) exposes only the
pre-baked seed data — five read-only tools, zero provider calls — over mcp-handler's
stateless streamable-HTTP transport with `disableSse: true`.
**Why:** (1) SSE transport requires Redis for resumability; the demo has no such
infrastructure and doesn't need server-initiated streams. (2) Keeping AI calls out means the
endpoint can never rack up spend, rate-limit, or hang from anonymous public traffic — the
same "seed path first" reliability rule as the web UI. Live pulls stay in the web app.
(3) Payloads are trimmed (no `coverUrl`/`rawMetrics`, ad copy capped at 200 chars) because
tool results land in an LLM context window — full fidelity is the web UI's job.
Unknown verticals/sample sets return a helpful text listing of valid slugs instead of a
JSON-RPC error, so an agent can self-correct in one turn.
**Files:** `app/api/[transport]/route.ts`, `lib/cache/seed.ts` (`listSeedVerticals`)
