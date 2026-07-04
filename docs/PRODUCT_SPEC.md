# PRODUCT SPEC: Creative Strategist

> What the product does, functionally. For *how*, see `ARCHITECTURE.md` and
> `INTEGRATIONS.md`. For a file-level index, see `CODEMAP.md`.

---

## Product summary

A single-page web app for affiliate media buyers. The user types a vertical/offer; the
app pulls and analyzes the competitor ads currently winning in that space, lets the user
drop in their own ad set to see how conceptually diverse it really is (the Meta
"Entity-ID collapse" problem), and generates a prioritized batch of net-new ad angles to
run next. **It tells the team what creative to make.** No login, no ad-account
connection; runs on public and uploaded data.

---

## Primary user & jobs-to-be-done

**User:** a media buyer / creative strategist at a direct-response affiliate shop.

Jobs:
1. "Show me what's actually winning in my vertical *right now* and *why*."
2. "Tell me whether my current ad set is genuinely diverse or secretly redundant to
   Meta's algorithm."
3. "Give me a batch of new angles to test, prioritized and formatted per platform."

---

## The four modules

Each module is a discrete, independently demoable step. They also compose into one flow
(see "End-to-end demo flow" below). Each works on its own *and* hands its output to
the next.

### Module 1: Competitive Angle Miner

**Purpose:** Surface the ads the market has already validated as winners.

**Input:** A vertical or offer (free text, e.g. "weight-loss supplement," "debt relief,"
"ED telehealth"). Optionally a platform filter and a region.

**Processing:**
- Pull live competitor ads from public ad sources (Meta Ad Library via Apify; see
  `INTEGRATIONS.md`).
- Normalize each ad into a common shape: `{ id, source, advertiser, thumbnail/cover,
  caption/copy, first_seen, last_seen, run_days, raw_metrics }`.
- **Rank by run-duration** (`run_days`) as the primary winning signal; surface any
  available engagement/CTR metrics as secondary.

**Output:** A ranked gallery/list of competitor ads with the winning signal visible
("running 87 days"), each ready to feed Module 2.

**Acceptance criteria:**
- [x] Typing a vertical returns ~15 real competitor ads (cached path returns instantly).
- [x] Each ad shows a thumbnail/cover, the copy/caption, and a longevity signal.
- [x] Results are sorted by the winning signal, not arbitrary order.
- [x] A novel vertical (not pre-cached) triggers a live pull with graceful loading +
      retry/backoff, then caches the result.

### Module 2: Creative DNA Deconstructor

**Purpose:** Turn a gallery of ads into a *queryable creative database*, which generic
ad-spy tools (BigSpy, AdSpy, PiPiADS) do not do. They show you ads; this extracts the
*strategy*.

**Input:** The ads from Module 1 (and/or user-uploaded ads).

**Processing:**
- Run each ad's **cover frame + copy + metadata** through a vision+language model (Claude
  via the provider interface). For cost/latency, analyze the cover frame rather than full
  video, since it carries most of the hook/format/angle signal. (See `ARCHITECTURE.md`.)
- Extract a **structured record** per ad:
  - `hook_type` (e.g. question, bold claim, callout, pattern-interrupt, problem-agitation)
  - `angle` / `emotional_driver` (fear, greed, curiosity, status, urgency, novelty, ...)
  - `format` (UGC, testimonial, founder/talking-head, static, demo, listicle, ...)
  - `offer_framing` (discount, free trial, risk-reversal, scarcity, social proof, ...)
  - `cta_style`
  - `target_persona`
  - `one_line_summary`

**Output:** A structured, filterable view of the analyzed ads + an AI summary: *"what's
winning right now and why."*

**Acceptance criteria:**
- [x] Every analyzed ad produces all structured fields (no nulls on the core fields).
- [x] The structured view is filterable/groupable by at least `angle` and `format`.
- [x] A plain-language "what's winning and why" summary is generated from the set.
- [x] Output schema is stable and typed (consumed by Modules 3 & 4).

### Module 3: Andromeda Diversity Scorer

**Purpose:** Tell the user whether their own ad set is *semantically* diverse or secretly
redundant. This is the Entity-ID collapse problem: Meta's Andromeda system assigns each
creative an entity identity from its visual/semantic pattern, and near-duplicate ads
collapse into the same one, wasting auction entries.

**Input:** The user's current ad set (drag-and-drop images/creatives, and/or pasted
copy). Runs through Module 2 to get DNA for each.

**Processing (LLM concept-clustering):**
- Feed the structured DNA of all N ads to Claude and ask it to group them into distinct
  **concept clusters**, assigning each ad a cluster id + a one-line reason, and flagging
  near-duplicates.
- Compute the headline number: **N ads collapse to K concepts.**
- Identify **angle gaps**: proven market angles (from Modules 1-2) the user is *not*
  running.

> **Decision:** the shipped version uses LLM clustering with *explained* groupings, not
> bare embeddings cosine. Reasoning in `ARCHITECTURE.md`, "Diversity engine" section. An
> embeddings + cosine quantitative score is a documented fast-follow.

**Output:**
- A headline: *"Meta will likely see these 8 ads as 3 concepts. Here's where you're
  wasting auction entries,"* with the clusters shown.
- A gap list: market-proven angles absent from the user's set.

**Acceptance criteria:**
- [x] Uploading 3 or more creatives returns a concept-cluster breakdown with reasons.
- [x] The "N ads, K concepts" headline renders clearly.
- [x] At least one concrete, named angle gap is surfaced when one exists.
- [x] Works on uploaded creatives alone, with no live scrape required (demo safety).

### Module 4: Angle Generator

**Purpose:** Close the loop from insight to action.

**Input:** Market patterns (Modules 1-2) + diversity gaps (Module 3).

**Processing:**
- Synthesize the above into a **prioritized batch of net-new angle briefs.** Each brief:
  `{ angle_name, emotional_driver, why_now (tied to a market pattern or a gap),
  hook_line, format_recommendation, target_persona, priority }`.
- For each brief, produce **platform-formatted hook/copy variants** (Meta, TikTok, and a
  native/Taboola headline), respecting each platform's style/specs.

**Output:** ~10 ready-to-run angle briefs + copy variants, copyable / exportable
(clipboard, CSV, or production JSON), framed as "paste into a bulk sheet or hand to the
video tool."

**Acceptance criteria:**
- [x] "Generate" produces 10 or more distinct angle briefs.
- [x] Each brief is justified by *why now* (a market pattern or a diversity gap), not
      generic advice.
- [x] Each brief includes platform-formatted copy variants for at least 2 platforms.
- [x] Output is easily exportable (clipboard and/or CSV).

---

## End-to-end demo flow (zero credentials)

A complete, live, click-through demo on the deployed URL, every step on public or
uploaded data:

1. Type a vertical (e.g. "weight-loss supplement").
2. Watch it **pull and analyze real competitor ads** (cached verticals are instant).
3. See the **creative-DNA breakdown** + an AI summary of *"what's winning right now and
   why."*
4. **Drag in a few sample creatives** of your own.
5. Get the **diversity score + gap analysis** ("Meta sees 3 concepts, not 8").
6. Click **Generate** and receive **ten ready-to-run angle briefs** + copy variants.

No login, no ad-account connection, nothing the visitor has to provision.

---

## Demo-mode requirements

- Ship **pre-analyzed verticals** (real, cached data in `data/seed/`) that render
  every step instantly and never depend on a live call. Pick verticals that are obviously
  affiliate-relevant (weight-loss/supplements, financial/debt, telehealth).
- Provide a couple of **sample ad sets** that load into Module 3 with one click
  (so a visitor doesn't need to find their own creatives to see the diversity scorer).
- Live pulls for novel verticals must still work, with loading states, retry/backoff, and
  write-through caching so a repeat of the same vertical is instant.
- Every external call has a graceful failure state: never a blank screen or a spinner
  that hangs.

---

## Non-goals / out of scope

- No ad-account OAuth or live spend data. The tool is designed to be fully usable
  without anyone's credentials.
- No actual ad uploading/launching.
- No video generation.
- No landing-page building.
- No user accounts/auth, billing, or multi-tenant concerns; single shared demo.
- Exhaustive ad datasets are out of scope; sampling top performers is the design.
