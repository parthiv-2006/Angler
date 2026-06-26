# INTEGRATIONS — Creative Strategist

> The practical wiring for each external service: how to set it up, what it costs, its
> free-tier caps, and its gotchas. Pairs with `ARCHITECTURE.md` (the system design).
>
> **Caveat on numbers:** free-tier limits and prices drift fast and were accurate as of
> late June 2026. Verify current figures before relying on them — especially Gemini quotas,
> Apify caps, scraper output limits, and Anthropic pricing.

---

## 1. Anthropic API (primary AI provider)

**Used for:** Module 2 (multimodal creative-DNA extraction), Module 3 (concept clustering),
Module 2 summary + Module 4 (angle generation). All behind `lib/ai/provider.ts`.

### Setup
1. Create an API key at **console.anthropic.com** (this is the **Console/API** product —
   pay-per-token — *not* your Claude Pro/Max subscription).
2. Put it in `.env.local` as `ANTHROPIC_API_KEY` and in Vercel project env vars.
3. Use the official SDK (`@anthropic-ai/sdk`) **inside `lib/ai/anthropic.ts` only**.

### Models
- Default: `claude-sonnet-4-6` (multimodal + reasoning, sensible cost).
- Cheap/fast: `claude-haiku-4-5-20251001` (light formatting calls).
- Heaviest reasoning (rarely needed here): `claude-opus-4-8`.
- **Verify current model strings, context windows, and rate limits** at
  `https://docs.claude.com/en/api/overview` and the docs map
  `https://docs.claude.com/en/docs_site_map.md`. Model availability changes; don't trust
  a hardcoded string from memory.

### Multimodal (Module 2)
- Send the ad's **cover frame** (base64 or URL) + the **copy** + **metadata** in one
  message; ask for the structured DNA schema as JSON. Analyzing the cover frame (not the
  full video) keeps tokens and latency down while preserving the hook/format/angle signal.
- Validate the returned JSON with zod before use.

### Cost (and why it's negligible here)
- Billing is **pay-per-token at standard API rates**; see current pricing via
  `https://docs.claude.com` (don't quote a number from memory).
- The demo is cheap **by design**: the expensive multimodal pass runs **once** while you
  build the seed verticals and is then **cached in Supabase**. During judging, the cached
  path costs ~nothing; only a novel vertical triggers fresh analysis (and it's cached after
  the first run). Realistic spend over the whole contest is single-digit dollars.
- To trim further: cap live batch size, use Haiku for reformatting, and lean on the cache.

### ⛔ Usage-policy rule (important)
**Do not route the deployed app's traffic through a Claude Code subscription / OAuth
token.** Anthropic's usage policy: OAuth on Free/Pro/Max/Team/Enterprise is for *individual
use of Claude Code and first-party apps only*; developers building products/services that
use Claude's capabilities **(including via the Agent SDK)** must use **API-key
authentication through the Console.** Routing other people's requests (the judge's clicks)
through your seat can get the account banned — the exact subscription you need to build
this. The app uses a Console API key; full stop.

### ⚠️ Build-time gotcha (affects Claude Code billing)
If `ANTHROPIC_API_KEY` is exported in your **shell** (`.zshrc`, `.bashrc`, a global `.env`),
**Claude Code itself will use that key and bill your API account instead of your
subscription.** Keep the app key in the project's **`.env.local`** (loaded by Next.js, not
exported to the shell). Check with `claude` → `/status` — the Auth token field should show
your subscription. To reset: `unset ANTHROPIC_API_KEY`, `claude logout`, `claude login`.

### Reliability
- Wrap calls in retry with exponential backoff + jitter; cap attempts; fall back to cached
  results. Handle 429s (rate limit) and transient 5xx without surfacing errors to the judge.

---

## 2. Embeddings (only for the diversity *fast-follow*)

The MVP diversity scorer uses **LLM clustering** and needs **no embeddings** (see
`ARCHITECTURE.md`). If/when you add the quantitative diversity score:

- **Anthropic has no first-party embeddings endpoint.** Options:
  - **Gemini embeddings** (Google AI Studio) — free tier, generous TPM; good for embedding
    the structured DNA text.
  - **Voyage AI** — Anthropic-aligned, supports multimodal embeddings; small free allotment
    then cheap. Nicer pitch ("Anthropic-recommended embeddings").
- Embed the **structured DNA text** (not raw images) → compute **cosine similarity in
  memory** → cluster by threshold. Scale is tiny; no vector DB.

---

## 3. Competitor ad data (Module 1)

### Primary: TikTok Creative Center
- **Public, no login.** Returns *real* performance signal (CTR ranking, engagement,
  industry, objective, budget tier) — the best free source for this use case.
- Caps without login are roughly **~20–40 ads per filter combination**. Fine — you want top
  performers, not everything.
- Build a thin client in `lib/sources/tiktok-creative-center.ts` and normalize via
  `lib/sources/normalize.ts` into the common `Ad` shape (see `ARCHITECTURE.md`).

### Breadth: Apify actors
- **Apify free plan:** permanent, no credit card, **~$5 of prepaid platform usage per
  billing cycle**, full access to the Store of ready-made scrapers.
- Use ready-made **Meta Ad Library** and **TikTok** actors. Meta Ad Library actor returns
  roughly **~50 ads per run** on free — again, sampling top performers is the design.
- Put `APIFY_TOKEN` in env; call actors server-side from `lib/sources/apify.ts`.

### Official libraries (reference / not sufficient alone)
- **Meta Ad Library API** returns **only political/issue ads** (EU) + some US special
  categories — **not** general commercial ads. So commercial competitor data needs the
  public web library (via a scraper/actor), not the official API.
- **Google Ads Transparency Center** — free to browse for advertiser-level ad visibility.

### Production path (name it in the README)
- **Apify paid plan** or **ScrapeCreators** (~$0.40 per 1,000 ads) for larger sweeps. The
  demo intentionally runs on samples + cache.

### ⚠️ ToS / scraping note (be honest in the README)
Pulling from ad libraries via third-party actors lives in a gray area of each platform's
ToS. For the demo: prefer the **public, no-login** sources (TikTok Creative Center, Google
Transparency Center) and ready-made Apify actors; keep volume to samples; cache results.
Documenting the compliant production path (official partnerships / paid data providers) is
a maturity signal, not a weakness.

---

## 4. Supabase (persistence + cache)

**Used for:** caching competitor ads + DNA, storing uploaded sets, diversity reports, and
angle batches. Schema in `ARCHITECTURE.md` §"Data model."

### Setup
1. Create a project; grab the URL and keys.
2. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` (**server-side only**).
3. Apply the schema (SQL migration). **Generate typed bindings** from the schema into
   `lib/db/types.ts`; don't hand-write row shapes.
4. Server client in `lib/db/client.ts` uses the **service-role** key for writes; the
   browser only ever uses the anon key (and ideally only reads).

### Notes
- Single shared demo, no user auth. Keep all writes server-side. If you enable RLS, add
  permissive **read** policies for the demo and keep writes behind the service role.
- Treat `competitor_ads` + `creative_dna` as the cache: check before any live work, write
  through after.
- Seed verticals (`is_seed = true`) are loaded from `data/seed/` so they never need a live
  call.

---

## 5. Vercel (hosting)

### Setup
1. Connect the GitHub repo; framework auto-detected (Next.js).
2. Add **all env vars** in the Vercel project settings (mirror `.env.local`, plus
   `DEMO_MODE`).
3. Deploy: `vercel` (preview) / `vercel --prod` (production). Free `*.vercel.app` URL.
4. Optional: connect a cheap real domain — the contest notes real domains are "way cooler"
   and cheap. Small touch, nonzero pitch value.

### Serverless limits to design around
- **Function timeout / payload size:** vision analysis over many ads and live scraping can
  exceed default limits. Mitigate by: (a) analyzing **cover frames only**, (b) **limiting
  live batch size**, (c) **streaming partial results** to the UI as each ad is analyzed,
  and/or (d) doing the heavy pre-analysis **offline** into `data/seed/` so the live path is
  light. Check current limits for your plan in Vercel's docs.
- Keep the seed/cached path the default experience; live pulls are the enhancement.

---

## 6. Gemini fallback (optional, one env var)

If you ever want pure-$0 operation, flip `AI_PROVIDER=gemini`:
- **Google AI Studio**, free tier, **multimodal (incl. images) free, no card, no expiry**;
  roughly **~15 RPM / ~1,000 RPD** on the Flash-Lite tier. Implementation lives in
  `lib/ai/gemini.ts` behind the same interface.
- **⚠️ Gotcha:** **enabling billing on a Gemini project deletes the free tier on that
  project.** Keep any free-tier Gemini usage on a **separate, billing-disabled** project.
- **Privacy:** on the free tier, Google's terms allow using prompts/outputs to improve
  their models. Irrelevant for the demo (you're feeding *public* competitor ads). For
  production on proprietary creative, use paid Gemini or — better for this pitch — Claude.

---

## 7. Free-tier facts (quick reference — verify before relying)

- **Anthropic:** pay-per-token; no free app tier. Cost stays tiny here via caching.
- **Gemini free tier:** multimodal free, no card, ~15 RPM / ~1,000 RPD (Flash-Lite); free
  embeddings; free-tier prompts may be used for training; enabling billing removes the free
  tier on that project.
- **Apify free plan:** ~$5 prepaid usage/cycle, no card; ready-made Meta/TikTok/Google
  actors; ~50 ads/run (Meta), ~20–40/filter (TikTok).
- **TikTok Creative Center:** public, no login; real CTR/engagement/industry/objective/
  budget signal.
- **ScrapeCreators:** ~$0.40 / 1,000 ads for production-scale pulls.
