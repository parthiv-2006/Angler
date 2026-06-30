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

---

## TikTok Creative Center

### Requests rejected without realistic browser headers
**Symptom:** `fetch` to the TikTok CC API returns 403 or malformed JSON.
**Fix:** Set `User-Agent`, `Referer`, and `Accept` headers to realistic browser values.
**File:** `lib/sources/tiktok-creative-center.ts`

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

### `next build` rewrites `tsconfig.json`
**Symptom:** After `npm run build`, `tsconfig.json` shows a diff (reformatted arrays + added
`"target": "ES2017"`). This is Next.js auto-reconfiguring TS; it's benign — keep it.

## TypeScript

### Hook post-tool false positives ("Write operation failed")
**Symptom:** OMC hooks report "Write operation failed" / "Edit operation failed" even when the tool succeeded.
**Cause:** Hook false positive — the tool actually succeeded.
**How to confirm:** Run `npm run typecheck`. If it passes with 0 errors, ignore the hook warning.
