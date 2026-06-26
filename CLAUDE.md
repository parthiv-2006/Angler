# CLAUDE.md — Creative Strategist

> This file is loaded automatically by Claude Code at the start of every session.
> It is the operational hub. Read the deeper docs in `./docs/` when you need full
> context for a decision. **Start by skimming `./docs/CONTEXT.md`** — it explains
> *why* this project exists and who is judging it, which should inform judgment calls.

---

## What we are building (one line)

**Creative Strategist** — an AI tool for affiliate media buyers that reads what's
already winning in the ad market, deconstructs the *creative DNA* of those winners,
scores a user's own ad set for the "creative diversity" Meta's 2026 algorithm
demands, and generates a prioritized batch of net-new ad angles ready to feed into
a creative pipeline.

Positioning: **it tells the team _what_ creative to make**, while the tools they're
already building handle *making* and *launching* it.

This is a submission for the It's Today Media **$5,000 Build Challenge** (deadline
**July 4, 2026, 11:59 PM ET**). The win condition is not "feature complete" — it is
"a working live URL the judge can click and use with zero of his credentials, that
visibly solves a real money problem for an affiliate media-buying team." See
`./docs/CONTEXT.md` and `./docs/BUILD_PLAN.md`.

"Creative Strategist" is a working name. Renaming is trivial — it is not load-bearing.

---

## Confirmed decisions (do not re-litigate without asking)

| Decision | Choice | Why (short) |
|---|---|---|
| **Scope** | Full — all 4 modules, **including live competitor scraping** | The "reads the live market" piece is the wow factor for this judge. Reliability risk is handled by demo-mode caching (below). |
| **AI provider** | **Anthropic API** (Claude) behind a provider-agnostic interface; Gemini free tier as a one-env-var fallback | "Built on Claude — their stack" is a real pitch edge. Caching keeps cost negligible. |
| **AI auth** | **`ANTHROPIC_API_KEY` from console.anthropic.com** (pay-per-token) | **NEVER** route app traffic through a Claude Code subscription / OAuth token — that violates Anthropic's usage policy (individual-use only). See `./docs/INTEGRATIONS.md`. |
| **Diversity engine** | **LLM concept-clustering** for the MVP (embeddings + cosine is a documented fast-follow) | Explained groupings ("these 8 ads are really 3 concepts because…") beat a bare similarity number, ship faster, and keep the intelligence on Claude. |
| **Storage** | **Supabase** (already in their stack) | Persists analyzed ads, diversity reports, and generated angle batches; signals stack alignment. |
| **Stack** | **Next.js (App Router) + React 19 + TypeScript**, deployed on **Vercel** | Mirrors It's Today Media's exact frontend stack → signals day-one codebase contribution. |
| **Competitor data** | **TikTok Creative Center** (public, no login) primary; **Apify** actors (Meta Ad Library / TikTok) for breadth | Free, real performance signal, and demoable with no judge credentials. |

---

## Hard rules

1. **Demo must run on public or user-uploaded data only.** Zero of the judge's ad-account
   credentials. No OAuth into anyone's ad platform. This constraint is the whole reason
   this idea was chosen — see `./docs/CONTEXT.md` §"The Demo-ability Constraint."
2. **No fake/mocked data presented as real.** The judge explicitly called this out as a
   failure mode. Cached *real* data is fine; fabricated numbers are not.
3. **Never build anything on their existing roadmap.** Do NOT build a video generator, a
   landing-page builder, a full ad-upload MCP, or rebuild Trackly SMS. (Full "do not build"
   list in `./docs/CONTEXT.md`.)
4. **All AI/secret keys are server-side only.** Never ship an API key to the client. All
   model calls go through Next.js route handlers / server actions.
5. **The live URL must never feel flaky.** Every live external call (scrape, model call)
   needs retry/backoff and a cached fallback. See "Demo mode" below.

---

## Repo structure (proposed — adapt as needed)

```
/
├─ CLAUDE.md                  # this file
├─ docs/
│  ├─ CONTEXT.md              # the why: contest, company, judge, strategy
│  ├─ PRODUCT_SPEC.md         # what to build: the 4 modules, flows, acceptance criteria
│  ├─ ARCHITECTURE.md         # how it's built: system design, providers, data model
│  ├─ INTEGRATIONS.md         # external services + setup + gotchas
│  └─ BUILD_PLAN.md           # 9-day plan, MVP cut, README plan, submission checklist
├─ app/                       # Next.js App Router
│  ├─ page.tsx                # the single-page demo experience
│  └─ api/
│     ├─ mine/route.ts        # Module 1: pull competitor ads for a vertical
│     ├─ deconstruct/route.ts # Module 2: creative-DNA extraction (vision)
│     ├─ score/route.ts       # Module 3: diversity / concept-collapse analysis
│     └─ generate/route.ts    # Module 4: net-new angle briefs
├─ lib/
│  ├─ ai/
│  │  ├─ provider.ts          # provider-agnostic LLM interface (Anthropic default)
│  │  ├─ anthropic.ts         # Anthropic implementation
│  │  └─ gemini.ts            # Gemini fallback implementation
│  ├─ sources/
│  │  ├─ tiktok-creative-center.ts
│  │  └─ apify.ts
│  ├─ db/                     # Supabase client + typed queries
│  └─ cache/                  # demo-mode cache helpers
├─ data/seed/                 # pre-analyzed verticals for demo mode (real, cached data)
└─ .env.local                 # secrets — NOT committed, NOT exported globally
```

---

## Commands

```bash
# install
npm install

# dev
npm run dev            # http://localhost:3000

# quality gates (run before every commit)
npm run lint
npm run typecheck      # tsc --noEmit
npm run build          # must pass; Vercel will run this

# tests (if/when added)
npm run test

# deploy (Vercel)
vercel                 # preview
vercel --prod          # production
```

If a script above doesn't exist yet, create it in `package.json` rather than skipping the gate.

---

## Environment variables

Store these in `.env.local` (git-ignored) and in the Vercel project settings. **Do not
`export` them in your shell profile** — see the warning below.

```bash
# AI — Anthropic API key from console.anthropic.com (pay-per-token, NOT a subscription token)
ANTHROPIC_API_KEY=sk-ant-...

# Optional fallback provider (Gemini free tier, Google AI Studio)
GEMINI_API_KEY=...
AI_PROVIDER=anthropic            # "anthropic" | "gemini" — selects the default provider

# Embeddings (only if the embeddings-based diversity upgrade is enabled; see ARCHITECTURE.md)
# EMBEDDINGS_PROVIDER=gemini     # Anthropic has no first-party embeddings endpoint

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...    # server-side only, never exposed to the client
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Competitor data
APIFY_TOKEN=...                  # Apify free plan

# Demo
DEMO_MODE=true                   # serve cached verticals instantly; still allow live pulls
```

> ⚠️ **Gotcha that affects YOU while building.** If `ANTHROPIC_API_KEY` is exported in your
> shell (`.zshrc`, `.bashrc`, a global `.env`, etc.), **Claude Code will use that key for its
> own operation and bill your API account instead of your Pro/Max subscription.** Keep the
> app's key inside the project's `.env.local` (which Next.js loads automatically) so Claude
> Code keeps running on your subscription. Verify with `claude` → `/status` (the Auth token
> field should show your subscription, not the API key).

---

## AI Memory System

The `memory/` folder is the living state of this project. The static design docs (ARCHITECTURE.md, CONTEXT.md, etc.) describe *what* to build and *why*; the memory docs describe *what has been built*, what problems were hit, and where things stand right now.

### Read on every session start

Before writing any code, read these two files:
1. [`memory/PROGRESS.md`](memory/PROGRESS.md) — where we are in the 9-day build plan
2. [`memory/GOTCHAS.md`](memory/GOTCHAS.md) — traps already discovered, so you don't re-hit them

### When the user says "update memory"

Update all four files to reflect the current session's state:

| File | What to update |
|------|----------------|
| [`memory/PROGRESS.md`](memory/PROGRESS.md) | Check off completed items ✅, mark in-progress items 🔄, note any blockers under the relevant module |
| [`memory/GOTCHAS.md`](memory/GOTCHAS.md) | Append any new bugs, API surprises, or non-obvious behaviors encountered this session |
| [`memory/DECISIONS.md`](memory/DECISIONS.md) | Append any implementation decisions made (even small ones) that a future AI session should understand — include *why*, not just *what* |
| [`memory/LOG.md`](memory/LOG.md) | Prepend a new entry: today's date, what was accomplished, current branch state, what's next |

Keep entries concise. A future AI session needs enough to act, not a novel.

---

## Engineering Rules (non-negotiable)

1. **Commit like a senior engineer.** Write code in small, atomic batches — one concern per
   commit, never a single large dump. Always commit and push to the repo before moving to the
   next concern. The git history is part of the audition.
2. **Simplest implementation first.** Always write the simplest code that satisfies the
   requirement. No premature abstractions, no speculative generality. Add complexity only
   when the need is proven.
3. **Ask before assuming.** When a requirement is ambiguous or two valid approaches exist,
   stop and ask a clarifying question. Never silently pick one and proceed.
4. **Architecture is everything.** Maintain the module boundaries defined in
   `ARCHITECTURE.md` with the same discipline a senior engineer would on a production
   codebase. Do not let shortcuts collapse the layering (`lib/` ↔ `app/api/` ↔ `app/`).
5. **Clean, professional codebase at all times.** No dead code, no debug `console.log`
   left in, no commented-out blocks, no stray files. The repo must look production-ready
   on every commit.
6. **Seed path first, live path second.** When implementing any feature, make the
   seed/cached path work and verify it before touching the live API path. The demo judge
   clicks seed verticals first — a broken live path is recoverable; a broken seed path
   loses the contest.
7. **Route timeout budget.** Every `app/api/*` route must complete its primary path in
   under 8 seconds (Vercel default is 10s). If a route might exceed this — e.g. vision
   analysis over many ads — use streaming, reduce batch size, or move the heavy work to
   offline seed pre-computation. Never assume a serverless function can do multi-step AI
   work synchronously without checking the math.
8. **"Does it demo?" is the definition of done.** Before marking any module complete, it
   must work end-to-end on the seed path in an incognito window with zero env vars set.
   TypeScript and lint passing are necessary but not sufficient — the win condition is a
   working live URL, not clean types.

---

## Conventions

- **TypeScript strict mode on.** No `any` unless justified with a comment.
- **Server-side AI calls only.** Route handlers in `app/api/*`. Validate inputs (zod or
  equivalent) at the boundary.
- **Provider-agnostic AI.** Never import the Anthropic SDK directly in feature code — go
  through `lib/ai/provider.ts`. Swapping providers should be one env var.
- **Typed Supabase.** Generate types from the schema; don't hand-write row shapes.
- **Cache real data, never fabricate.** Demo-mode caches genuine prior results keyed by
  vertical; it does not invent ads or numbers.
- **Readable over clever.** The judge will read this code and explicitly weights "could
  another engineer extend this?" Small, named functions; clear module boundaries.
- **Commit hygiene.** Small, descriptive commits. The git history is part of the audition.

---

## Definition of done (contest)

A submission is "done" when all of the following are true. Detail in `./docs/BUILD_PLAN.md`.

- [ ] **Live Vercel URL** the judge can open and use with no login and no credentials.
- [ ] At least **2–3 pre-cached verticals** that demo instantly, plus working live pulls.
- [ ] All four modules produce real output end-to-end on at least the cached path.
- [ ] **GitHub repo** is readable, sensibly structured, and builds clean.
- [ ] **README** answers the three contest questions (what / why this one / what next).
- [ ] A **fallback Loom** recorded in case the live URL has issues during judging.
