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

## TypeScript

### Hook post-tool false positives ("Write operation failed")
**Symptom:** OMC hooks report "Write operation failed" / "Edit operation failed" even when the tool succeeded.
**Cause:** Hook false positive — the tool actually succeeded.
**How to confirm:** Run `npm run typecheck`. If it passes with 0 errors, ignore the hook warning.
