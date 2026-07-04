# Gotchas

> Non-obvious bugs, API quirks, env traps, and workarounds discovered during
> implementation. Read this before debugging anything — the answer may already be here.
> Updated via "update memory".

---

## Supabase

### `createClient<Database>` generic causes query results to be `never`
**Symptom:** `.from("verticals").select(...)` returns `never`, TypeScript errors cascade.
**Cause:** Passing the `Database` generic to `createClient` breaks Supabase's query builder type inference.
**Fix:** Use `createClient(url, key)` with **no generic**. Cast results explicitly with `as RowType` in `lib/db/queries.ts`.
**File:** `lib/db/client.ts`

### Self-referential `Omit<>` in the `Database` type resolves as `never`
**Symptom:** Defining `Database["public"]["Tables"]["x"]["Insert"]` as `Omit<Database[...]["Row"], "id">` causes TypeScript to infer the type as `never`.
**Cause:** Circular self-reference in the type definition.
**Fix:** Define named row interfaces (`VerticalRow`, `CompetitorAdRow`, etc.) and use those in the `Database` type.
**File:** `lib/db/types.ts`

### Supabase crash when env vars are absent
**Symptom:** App throws on import of `lib/db/client.ts` if `NEXT_PUBLIC_SUPABASE_URL` is not set.
**Fix:** Use dynamic imports (`await import("@/lib/db/queries")`) inside `lib/cache/index.ts` and guard with `hasSupabase()` check. The seed path works with zero credentials as a result.
**File:** `lib/cache/index.ts`

### `creative_dna.ad_id` was `uuid` but the app never generates real UUIDs (fixed 2026-07-03)
**Symptom:** Every live (non-seed) `/api/deconstruct` call spammed the server log with
`{ code: '22P02', message: 'invalid input syntax for type uuid: "paste_1"' }` and the equivalent
for `paste_0`, `upload_0`, `preflight_<timestamp>`, and even live-mined `fb_<archiveId>` /
`tiktok_<id>` ads.
**Cause:** `supabase/migrations/001_initial_schema.sql` typed `creative_dna.ad_id` as `uuid`, but
`cacheDNA()` in `lib/db/queries.ts` always writes the app's own string id, none of which are
UUIDs. Because that write is wrapped in `.catch(console.error)` in `lib/cache/index.ts`, the
failure was **silent** to the end user — the request itself succeeded or failed based on the AI
call, not this write — but it meant Supabase never actually persisted a single live-analyzed DNA
record, and the "write-through cache" claim in ARCHITECTURE.md didn't hold for anything but seed
data.
**Fix:** Migration `002_creative_dna_ad_id_text.sql` — `alter table creative_dna alter column
ad_id type text using ad_id::text` (table was empty, zero data loss) — applied directly to the
live project (`xtigqcoogbraorwhmshw`) via the Supabase MCP `apply_migration` tool. `ARCHITECTURE.md`
and `lib/db/queries.ts` updated to reflect `ad_id text`. **Note:** `competitor_ads` was not
affected — its `id` is a DB-generated `uuid` PK the app never supplies directly, so that table was
never at risk.
**Files:** `supabase/migrations/002_creative_dna_ad_id_text.sql`, `lib/db/queries.ts`,
`docs/ARCHITECTURE.md`

---

## Anthropic / AI Keys

### Shell-exported `ANTHROPIC_API_KEY` bills the API account, not the Pro subscription
**Symptom:** Claude Code starts consuming API credits instead of running on the Max subscription.
**Cause:** If `ANTHROPIC_API_KEY` is exported in `.zshrc` / `.bashrc` / a global `.env`, Claude Code picks it up and uses it for its own calls.
**Fix:** Keep the app's key **only** in `.env.local` (git-ignored). Never export it globally. Verify with `claude` → `/status` — the Auth field should show subscription, not the API key.

### Claude Code OAuth token (`sk-ant-oat...`) cannot be used as `ANTHROPIC_API_KEY`
**Symptom:** 401 `invalid x-api-key` even though the key looks valid.
**Cause:** `sk-ant-oat` tokens are Claude Code's internal OAuth credentials. They authenticate against Anthropic's internal services, not `api.anthropic.com`. The SDK's `authToken` option also fails — it uses `Authorization: Bearer` which the public API does not accept for these tokens.
**Fix:** Only a Console API key (`sk-ant-api03-...`) from console.anthropic.com works for app traffic.

### Gemini 429 `limit: 0` is a dead model, not exhausted quota
**Symptom:** Every live call 429s with `You exceeded your current quota ... limit: 0, model: gemini-2.0-flash`.
**Cause (the real one):** `limit: 0` means this project has **no free-tier allocation for that model at all** — it is *not* daily exhaustion (which shows a non-zero limit you've used up). Google has stopped granting free-tier requests for `gemini-2.0-flash` on new API keys. Retrying or waiting for a "daily reset" never helps.
**Fix:** Point the provider at a model that still has a free tier. Verified 2026-06-30: `gemini-2.5-flash` → HTTP 200; `gemini-2.0-flash` → 429 limit:0; `gemini-1.5-flash` → 404 (retired). `lib/ai/gemini.ts` `MODEL_DEFAULT` now defaults to `gemini-2.5-flash` (override with `GEMINI_MODEL`). All three live entry points (analyzeCreative, clusterConcepts, generateJSON) confirmed working on a novel vertical after the switch.
**Diagnose which model works:** `curl -s -o /dev/null -w "%{http_code}" -X POST "https://generativelanguage.googleapis.com/v1beta/models/<MODEL>:generateContent?key=$GEMINI_API_KEY" -H "Content-Type: application/json" -d '{"contents":[{"parts":[{"text":"ok"}]}]}'`
**Note:** `withRetry` still amplifies a genuine per-minute throttle 3×, but that is unrelated to the `limit: 0` case above.

### Gemini `503 high demand` is transient load — switch model buckets, don't just wait
**Symptom:** During a `refresh-seed` bake, the batch-DNA call 503s repeatedly and `robustAI`
exhausts all 7 retries (backoff to ~60s each) and the whole run throws `503 Service
Unavailable: This model is currently experiencing high demand`.
**Cause:** Distinct from `limit: 0` (dead model / no free allocation). A `503` is a
server-side capacity spike on that specific model bucket. A trivial probe (`curl ...
:generateContent`) can return 200 at the same moment the big batched call 503s, because load
is per-model and per-moment.
**Fix:** Re-run with a different bucket via `GEMINI_MODEL`. Verified 2026-07-03:
`gemini-2.5-flash-lite` sustained 503s through 7 retries; immediately re-running with
`GEMINI_MODEL=gemini-2.5-flash` completed clean with **zero** retries. The per-stage state
cache + cached raw scrape mean the re-run re-spends nothing already done (the failed
batch-DNA had saved nothing, and Apify raw was cached → zero Apify spend).

### `npm run ... | tee logfile` masks a script failure — `tee`'s exit 0 hides it
**Symptom:** A background `npm run refresh-seed ... | tee bake.log` reports **exit code 0**
even though the script threw and printed `refresh-seed FAILED:` in the log.
**Cause:** In a pipeline, `$?` is the **last** command's exit — `tee` almost always exits 0,
so the failing `npm`/`tsx` exit is discarded. The `completed (exit code 0)` notification is
therefore meaningless for piped commands.
**Fix:** Don't pipe a command whose exit code you care about through `tee`. Redirect instead
(`> bake.log 2>&1; echo "EXIT=$?"`) so `$?` reflects the real process, or check
`${PIPESTATUS[0]}`. Always grep the log for `FAILED`/`Error` regardless of the reported code.

### Ad Library keyword search matches ad COPY TEXT — broad terms return heavy noise
**Symptom:** Seed-baking a new vertical from an obvious keyword returns a market full of
off-topic "winners". `investing newsletter` surfaced a ministry / a shoe factory / AARP
grants; `stock picks` was worse — it matched "in **stock**" and "**picks**" across
e-commerce (BBQ, car dealers, home decor, audiobooks).
**Cause:** Apify's Meta Ad Library actor keyword-matches against the ad's body copy, not a
curated category. Generic multi-sense words ("stock", "picks", "investing", "newsletter")
pull in every advertiser who happens to use them.
**Fix:** Prefer a specific, single-sense phrase that appears in the target niche's copy but
not elsewhere. For the finance-newsletter vertical, `financial newsletter` won (~11/15
on-topic incl. Timothy Sykes / Junkbondinvest / Money Machine) over both alternatives. Always
eyeball `data/seed/<slug>.json` advertisers before shipping — count genuinely on-topic
winners, don't trust the ad count alone (see [[decisions]] "P4 investing vertical ships on
the `financial newsletter` query"). Each retry is a paid Apify run, so budget them.

### Pasted/uploaded ad ids repeat across users — never use them as cache keys
**Symptom:** With Supabase configured, pasting captions returned DNA that didn't match the
pasted text.
**Cause:** The client always ids pasted ads `paste_0..n` (uploads `upload_0..n`), and
`getOrAnalyzeDNA` cached by that id — so the *first* user's analysis was served for every
later user's `paste_0`, whatever their caption said.
**Fix (2026-07-04):** `/api/deconstruct` caches uploaded-kind ads under
`upl_<sha256(content) prefix>` instead (see `cacheKeyFor`). Competitor ads keep their stable
library ids. Bonus: identical captions now share one cached analysis.
**File:** `app/api/deconstruct/route.ts`

---

## TikTok Creative Center

### Requests rejected without realistic browser headers
**Symptom:** `fetch` to the TikTok CC API returns 403 or malformed JSON.
**Fix:** Set `User-Agent`, `Referer`, and `Accept` headers to realistic browser values.
**File:** `lib/sources/tiktok-creative-center.ts`

### Apify polling must fit the route's `maxDuration` — and never retry a paid run
**Symptom:** A live `/api/mine` on a novel vertical could be killed by Vercel at 60s
mid-poll, surfacing a raw function timeout instead of the friendly "try a seed vertical"
response.
**Cause:** `pollRunDataset` waited up to 24×5s = 120s, and `fetchLiveAds` wrapped it in
`withRetry(3)` — which also started a **new paid actor run** per retry.
**Fix (2026-07-04):** default poll budget is 9×5s ≈ 45s (routes); the offline
`refresh-seed` baker passes `pollAttempts=60` (5 min). No retry wrapper around Apify runs.
**Files:** `lib/sources/apify.ts`, `app/api/mine/route.ts`, `scripts/refresh-seed.ts`

---

## Dependencies

### `npm audit` flags postcss via next — fix with an override, not `audit fix --force`
**Symptom:** 3 moderate advisories: `postcss <8.5.10` (GHSA-qx2v-qp2m-jg93) pulled in by
`next` (which pins 8.4.31); `npm audit fix --force` wants to downgrade to `next@9` (!).
**Fix:** `"overrides": { "postcss": "^8.5.10" }` in package.json. Build verified clean on
postcss 8.5.16. Audit reports 0 vulnerabilities.

---

## Cache Layer

### `getOrAnalyzeDNA` signature: 5 args, not 4
**History:** Was originally 4 args; `slug` was added as the 2nd parameter during session 1 to support the seed DNA map lookup.
**Current signature:**
```ts
getOrAnalyzeDNA(adId, slug, adKind, analyzer, model): Promise<CreativeDNA>
```
All callers must pass all 5 args. Check `app/api/deconstruct/route.ts` if you see TS errors here.

---

## Clustering pipeline

### `clusterConcepts` DNA had no ad ID — the model invented `adIds` from nothing
**Symptom:** After scoring an ad set, Step 5's collapsed concept buckets showed raw
placeholder text (`ad_1`, `ad_2`, `own_wls_01`-style strings that didn't match any real
`Ad.id`) instead of the real ad copy/thumbnail — `adById.get(id)` always missed.
**Cause:** `app/page.tsx` sent `dna: dnaData.results.map(r => r.dna)` to `/api/score`,
stripping the real `adId` before it ever reached the model. `creativeDNASchema` (and
`CreativeDNA` itself) has no id field, so `clusterConcepts`'s prompt had nothing to anchor
`adIds` to — the model hallucinated its own labels every time. This affected **both** the
live paste path and `scripts/refresh-seed.ts`'s sample-set generation (which is why the
pre-baked `data/seed/samples/*.json` files also ship with `adIds` that don't match `ads[].id`).
**Fix:** `clusterConcepts` now takes `{ adId: string; dna: CreativeDNA }[]` instead of
`CreativeDNA[]`; the cluster prompt embeds each real `adId` and instructs the model to copy
it verbatim into `adIds`. `/api/score`'s `dna` field is now `{adId, dna}[]`. All 4 call
sites in `app/page.tsx` (paste, sample, upload, full-demo) and both call sites in
`scripts/refresh-seed.ts` now pass the id-ful shape through instead of `.map(r => r.dna)`.
**Files:** `lib/ai/provider.ts`, `lib/ai/prompts/cluster.ts`, `lib/ai/anthropic.ts`,
`lib/ai/gemini.ts`, `app/api/score/route.ts`, `app/page.tsx`, `scripts/refresh-seed.ts`
**Fixed (verified 2026-07-03):** the two `data/seed/samples/*.json` files were re-baked
(P5). Deleted only the `sampleClustering` + `preflightVerdicts` keys from
`scripts/.cache/state-weight-loss-supplement.json` and `state-debt-relief.json` (leaving
`dna`/`summary`/`briefs`/`briefClustering` cached → zero re-spend), then re-ran
`npm run refresh-seed <slug>` for both — 6 Gemini calls, zero Apify spend (raw cached).
Every `clustering.clusters[].adId` now ∈ `ads[].id`, every preflight `collidesWith` is
null-or-real-concept. Confirmed on the running app: `POST /api/score {sampleSetId}` returns
`fromSeed:true` with matching ids, so Step 5 buckets render real ad copy on the seed path.
(The seed path routes the baked clustering through `/api/score`'s `getSampleClustering`
short-circuit — [app/api/score/route.ts:47](../app/api/score/route.ts) — so these ids DO
reach the UI; they are not dead data.)

---

## MCP server (`app/api/[transport]/route.ts`)

### mcp-handler ships a default server name — pass `serverInfo` explicitly
**Symptom:** MCP `initialize` reports `serverInfo.name: "mcp-typescript server on vercel"`.
**Fix:** `createMcpHandler`'s **second** argument takes `{ serverInfo: { name, version } }`
(it's `ServerOptions` from the SDK plus a `serverInfo` extension). The route passes
`{ serverInfo: { name: "creative-strategist", version: "0.1.0" } }`.

### Curling the streamable-HTTP endpoint: responses are SSE-framed
**Behavior:** `POST /api/mcp` answers with `event: message\ndata: {...jsonrpc...}` framing,
not bare JSON — send `Accept: application/json, text/event-stream` and parse the `data:`
line. `registerTool` (not the older `server.tool`) is the current mcp-handler@1.1.0 API;
`inputSchema` is a bare zod raw shape (`{ vertical: z.string() }`), not `z.object(...)`.

---

## Remote sandbox (Claude Code on the web)

### Playwright npm install expects a newer browser than the pre-installed one
**Symptom:** `browserType.launch` fails: `Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1228/...`.
**Fix:** Don't run `playwright install`; launch with
`chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })` (symlink to the
pre-installed build).

### fbcdn.net thumbnails are blocked by the sandbox egress proxy
**Symptom:** Browser console shows `net::ERR_TUNNEL_CONNECTION_FAILED` for
`scontent*.fbcdn.net` image loads during Playwright verification — looks like an app bug.
**Cause:** The remote sandbox's HTTPS proxy blocks those hosts. The UI already hides broken
thumbnails via `onError`, so this is cosmetic and environment-only; ignore it when judging
"no console errors".

---

## Tooling

### `npm run lint` (`next lint`) prompts interactively and hangs
**Symptom:** `next lint` asks "How would you like to configure ESLint? (Strict/Base/Cancel)"
and blocks — ESLint was never configured in this project.
**Workaround:** Don't rely on `npm run lint` in non-interactive runs. `npm run typecheck`
and `npm run build` are the real gates. `next lint` is also deprecated in Next 16; migrate to
the ESLint CLI later if a lint gate is wanted.

### Running `npm run build` while `npm run dev` is live corrupts the dev server
**Symptom:** The running dev server starts 500ing on routes with `Error: Cannot find
module './XXX.js'` (MODULE_NOT_FOUND) from `.next/server/...`. Looks like a code bug but isn't.
**Cause:** `next build` and `next dev` share the `.next/` directory. Building while dev is
running overwrites dev's webpack chunks, so dev can no longer resolve them at runtime.
**Fix:** Stop the dev server before building, or build in a separate checkout. To recover a
poisoned server: stop it, `rm -rf .next`, restart `npm run dev`. (During Playwright/Preview
verification, don't run `npm run build` against the same tree — typecheck is enough mid-session.)

### `git checkout` makes a plain `diff` against a pre-checkout backup show every line as changed
**Symptom:** Backed up a file, `git checkout -- <file>` to revert it, reapplied edits, then
`diff` against the backup shows the entire file as different even though the content is
identical.
**Cause:** This repo's `core.autocrlf` normalizes line endings on checkout (LF → CRLF), so
the checked-out file's line endings differ from a backup made before the checkout even when
every character of content is the same.
**Fix:** Use `diff --strip-trailing-cr` (or compare with `dos2unix`/normalize both sides)
before concluding content actually diverged. Useful when splitting a multi-feature edit pass
into separate atomic commits by reverting to HEAD and reapplying each feature's edits in
stages — see [[decisions]] "Reconstructing atomic commits from a single edit pass".

### `next build` rewrites `tsconfig.json`
**Symptom:** After `npm run build`, `tsconfig.json` shows a diff (reformatted arrays + added
`"target": "ES2017"`). This is Next.js auto-reconfiguring TS; it's benign — keep it.

## TypeScript

### Hook post-tool false positives ("Write operation failed")
**Symptom:** OMC hooks report "Write operation failed" / "Edit operation failed" even when the tool succeeded.
**Cause:** Hook false positive — the tool actually succeeded.
**How to confirm:** Run `npm run typecheck`. If it passes with 0 errors, ignore the hook warning.
