# BUILD PLAN — Creative Strategist

> In what order to build, what the minimum winning cut is, how to make the demo
> bulletproof, and how to write the README (which is 25% of the score). Deadline:
> **July 4, 2026, 11:59 PM ET.** Submit early to leave room to polish.

---

## Build order (≈9 days, directional)

| Day | Focus | Done when |
|---|---|---|
| 1–2 | **Scaffold + Module 1.** Next.js on Vercel; Supabase schema + typed client; provider interface stubbed; competitor-ad pull working end-to-end on **one** vertical via TikTok Creative Center, normalized + cached. | Typing one vertical returns real, ranked competitor ads on a live URL. |
| 3–4 | **Module 2 (Creative DNA).** Wire Anthropic via the provider interface; multimodal cover-frame analysis → structured DNA (zod-validated); build the filterable view + the "what's winning and why" summary. | Each ad yields full structured DNA; the view filters by angle/format. |
| 5 | **Module 3 (Diversity Scorer).** Drag-and-drop upload → DNA → **LLM concept clustering** → "N ads → K concepts" + gap analysis. Works on uploads alone (no live scrape). | Uploading ≥3 creatives returns explained clusters + ≥1 gap. |
| 6 | **Module 4 (Angle Generator).** Patterns + gaps → ≥10 prioritized angle briefs + platform-formatted copy variants; copy-to-clipboard / CSV export. | "Generate" produces ≥10 justified briefs with ≥2-platform variants. |
| 7 | **Harden the demo.** Build 2–3 **seed verticals** (real, pre-analyzed, cached) + 1–2 sample ad sets; add retry/backoff, loading/empty/error states, concurrency guard. | Seed path is sub-second and never errors; live path degrades gracefully. |
| 8 | **README + deploy + Loom.** Write the three answers; final deploy; record a fallback Loom of the full flow. | README done; live URL stable; Loom backup exists. |
| 9 | **Buffer.** Test on a fresh machine/incognito (no creds), fix rough edges, optional real domain. | A stranger can run the whole flow from the URL with zero setup. |

If time slips, protect the **seed/cached path** above everything — that's what the judge
clicks first.

---

## MVP vs stretch

**MVP (must ship — this is the winning cut):**
- All four modules working **on at least the cached/seed path**.
- A live Vercel URL, no login, 2–3 instant seed verticals + sample ad sets.
- Clean structured DNA, explained diversity clusters, ≥10 generated angle briefs.
- Readable repo + README answering the three questions.

**Stretch (only after MVP is solid):**
- Live pulls for arbitrary novel verticals (beyond seeds) feeling fast.
- Embeddings-based **quantitative** diversity score alongside the explained clusters.
- Real custom domain.
- Export polish (formatted CSV ready for a bulk-upload sheet).

**Cut first if behind:** breadth of live verticals and the quantitative score. **Never
cut:** the seed-path full flow, error handling, or the README.

---

## Demo-hardening checklist

- [ ] 2–3 **seed verticals** render every step instantly from cache (real data).
- [ ] 1–2 **sample ad sets** loadable into Module 3 with one click.
- [ ] Every external call has **retry/backoff** and a **cached fallback** — no hung
      spinners, no blank screens.
- [ ] **Concurrency guard** so simultaneous judge clicks prefer cache and don't trip rate
      limits.
- [ ] Loading / partial / empty / error states exist on every module.
- [ ] Tested in **incognito on a fresh machine** with **zero credentials**.
- [ ] No secret keys in the client bundle; `/status` confirms Claude Code is on the
      subscription, app key is in `.env.local` + Vercel.
- [ ] Fallback **Loom** recorded.

---

## The README is the pitch (25% of the score)

Keep it tight and lead with money. Three questions, three jobs:

### "What does it do?" (one tight paragraph)
Lead with the outcome: *finds the angles already winning in your vertical, shows whether
your own ad set is secretly redundant to Meta's algorithm, and generates a prioritized
batch of new angles to run next — so the team knows **what creative to make.*** Note it
runs on public + uploaded data with no ad-account access.

### "Why did you build THIS one?" (prove business understanding)
Hit these beats (full reasoning in `CONTEXT.md` §6):
- **Creative is now the dominant performance lever** — Andromeda made creative the
  targeting; ~56% of Meta performance is attributed to creative quality.
- **The Entity-ID diversity trap** — near-duplicate creatives collapse to one Entity ID,
  so teams waste auction entries thinking they're diverse when they're not. Almost nobody
  checks *semantic* vs *cosmetic* diversity. This tool does.
- **For a direct-response affiliate shop, the angle is the highest-ROI lever**, and **ad
  longevity is a free public proxy for what's winning** — so a tool that *sources and
  generates angles* is closer to revenue than any reporting dashboard.
- **It fills the gap in the assembly line they're already building** — their video
  generator and MCP uploader handle *making* and *launching*; nothing decides *what to
  make*. This is the missing upstream strategy layer that *feeds* those tools.

### "What would you build next?" (a real roadmap = a job audition)
Show a sequence that proves you'd thrive in the actual role:
1. **Close the loop on their own data:** wire it to their performance data so it learns
   which generated angles actually *converted* — turning a strategy tool into a
   self-improving one.
2. **Expose it as an MCP server** their team can call from Claude — slotting directly into
   the MCP pipeline they're already building (strategy → generation → upload as one chain).
3. **Quantitative diversity scoring** (embeddings + cosine) alongside the explained
   clusters, and broader/live data via a paid scraper tier.

**Bonus maturity move:** a short "Cost & limits" section documenting the free-tier caps
and the demo→production cost/privacy path (Anthropic API economics, scraper tiers). An
ROI-minded operator rewards unit-economics thinking.

---

## Risk register (the two sharp edges + mitigations)

| Risk | Mitigation |
|---|---|
| **Free-tier data caps** (samples, not full datasets) | Use case is *top performers*, not everything. Cache seed verticals. Name the paid production path (Apify paid / ScrapeCreators ~$0.40/1k) in the README. |
| **Live-call flakiness under judging** (rate limits, scraper hiccups, serverless timeouts) | Seed cache as the default path; retry/backoff + cached fallback; cover-frame-only analysis; limited live batch size; streaming; fallback Loom. |
| **Provider cost surprise** | Caching makes live judging ~free; cap batch size; Haiku for light calls; `AI_PROVIDER=gemini` is a one-env-var $0 escape hatch. |
| **ToS gray area on scraping** | Prefer public/no-login sources + ready-made actors; sample only; document the compliant production path honestly. |
| **Account-ban risk from misusing subscription auth** | App uses a Console API key, never the subscription token. Keep app key in `.env.local`, not the shell. |

---

## Submission checklist (final)

- [ ] **Live Vercel URL** — opens with no login, full flow works on the seed path.
- [ ] **GitHub repo** — readable, sensibly structured, `npm run build` passes, history is
      clean (the code is part of the audition).
- [ ] **README** — the three questions answered, lead-with-money, plus the cost/limits note.
- [ ] **Fallback Loom** — full click-through, in case the live URL stumbles during judging.
- [ ] **Submitted before** July 4, 2026, 11:59 PM ET (aim for a day early to polish).
