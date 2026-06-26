# Implementation Decisions

> Coding decisions made *during* implementation that aren't in the architecture docs.
> Answers "why is it built this way?" for non-obvious choices.
> Updated via "update memory".

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

## Ad longevity (`run_days`) as the winning signal, not CTR/views

**Decision:** Ads are ranked by `run_days` (how long the ad has been running), not by raw view counts or CTR.
**Why:** In affiliate marketing, advertisers kill losing ads fast. An ad that has been running for 30+ days is almost certainly profitable — the advertiser has proven it. `run_days` is a free, public, reliable proxy for profitability. This is a key insight the README should highlight.
**Files:** `lib/sources/normalize.ts`, `app/api/mine/route.ts`
