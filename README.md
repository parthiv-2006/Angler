# Creative Strategist

**Reads what's winning in your vertical → scores your own ad set for hidden redundancy → generates a prioritized batch of new angles to run next.**

Live demo: _[Vercel URL — coming soon]_

---

## What does it do?

Creative Strategist is a four-module AI tool for affiliate media buyers that answers the question teams almost never ask systematically: **which ads should we make at all?**

1. **Competitive Angle Miner** — enter a vertical or offer, pull the top competitor ads from public ad libraries, ranked by run-duration. An ad running 30+ days in affiliate land is almost certainly profitable — the advertiser proved it with real spend. Longevity is a free, public proxy for ROI.

2. **Creative DNA Deconstructor** — a vision + language model turns each ad into a structured record: hook type, emotional driver, format, offer framing, CTA style, and target persona. A gallery of competitor ads becomes a queryable creative intelligence database.

3. **Andromeda Diversity Scorer** — drop in your current ad set (one click for a sample, or paste your own captions). The tool groups your ads into the distinct *concepts* Meta's algorithm actually sees, and flags where near-duplicates are collapsing into the same Entity ID. "You think you're running 8 ads. Meta sees 3. Here's where you're wasting auction entries — and here are the proven angles you're not running."

4. **Angle Generator** — synthesizes market patterns and diversity gaps into ≥10 prioritized angle briefs with platform-formatted copy variants for Meta, TikTok, and native. Ready to paste into a bulk sheet or hand directly to a video creative tool.

Runs entirely on **public data and user-uploaded ad copy** — no ad-account credentials required. The judge (or anyone else) can open the URL and use the full tool in under 60 seconds.

---

## Why did you build this one?

Three reasons, in order of leverage:

**1. Creative is now the dominant performance lever — and most teams don't know it yet.**

Meta's Andromeda retrieval system (global rollout completed ~October 2025) changed ad delivery: instead of routing by advertiser-defined audiences, it uses computer vision to read your creative and predict who should see it. Your creative *is* your targeting now. Meta's own data attributes ~56% of campaign performance to creative quality — more than targeting, budget, placement, and timing combined. Top-third advertisers run ~395 live ads vs ~296 for bottom-third. The new cadence is 8–12 genuinely distinct concepts per campaign, refreshed every 2–3 weeks. **Creative volume AND genuine diversity are now existential for performance.**

**2. The Entity ID trap is a specific, money-losing problem almost nobody checks.**

Andromeda assigns each creative an Entity ID from its visual/semantic pattern. Upload ads that are too similar and they collapse into the same ID — you think you're running 10 diverse ads, but Meta sees 3, and 7 auction entries are wasted. Teams optimize for cosmetic diversity (new headline, same hook, same format, same angle) without realizing they're not adding real signal. Module 3 measures *semantic* diversity — the thing that actually matters to the algorithm — and names the gaps in terms of proven market angles.

**3. For a direct-response affiliate shop, the angle is the highest-ROI lever — and this fills the gap in the assembly line you're already building.**

A reporting dashboard describes the past. An angle engine creates future winners. More concretely: the video generator handles *making* the asset; the MCP uploader handles *launching* it; the landing page generator handles *converting* the click. Nothing decides *what to make*. Creative Strategist is the missing upstream strategy layer that feeds all three — angle briefs drop straight into the video tool, the resulting ads flow into the MCP uploader. It's not a competing silo; it's the first stage of the pipeline that makes the other stages worthwhile.

---

## What would you build next?

In priority order, as I'd actually sequence it for a lean affiliate team:

**1. Close the performance feedback loop.**
Wire the angle briefs to actual CPA/ROAS outcomes — after a campaign runs, tag which generated angles converted and at what cost. The tool learns which creative patterns predict winners in this specific vertical, for this specific audience. The strategy layer becomes self-improving rather than just sourcing from the market.

**2. Expose it as an MCP server.**
The team is already building an MCP-based ad creation and upload workflow. Exposing Creative Strategist as an MCP server means the full chain — strategy → generation → upload — becomes callable as a single agent pipeline from Claude. New vertical in, live campaign brief out, with no manual handoffs.

**3. Quantitative diversity scoring + broader data.**
Layer embeddings-based cosine similarity alongside the explained clusters, so teams get a concrete diversity score per ad set (not just a narrative). Add a paid Apify tier for deeper coverage (~$0.40/1k ads via ScrapeCreators) and Meta Ad Library access for first-party brand data. The free-tier demo gives a sample; production gives the full picture.

---

## Data provenance (no fabricated data)

Everything the demo shows is **real**. The competitor ads are genuine, currently/recently running ads pulled from public ad libraries — not invented examples.

- **Seed verticals** (weight-loss supplement, debt relief, ED telehealth) are **real ads scraped from the Meta (Facebook) Ad Library** via the public Apify actor [`curious_coder/facebook-ads-library-scraper`](https://apify.com/curious_coder/facebook-ads-library-scraper), then **cached** so the demo runs instantly with zero credentials. Each ad's run-duration is derived from its real Ad Library delivery start date. Advertiser names are real entities you can look up in the [Meta Ad Library](https://www.facebook.com/ads/library/). Cached real data is the standard approach here — nothing is mocked or hand-written. Refresh the cache anytime with `npm run refresh-seed`.
- **Novel verticals** (anything you type that isn't pre-seeded) attempt a **best-effort live Apify pull** of the Meta Ad Library. If it returns nothing in time, the app **degrades honestly** — it tells you to try a seeded vertical rather than showing a fabricated result.
- **TikTok Creative Center** is wired as a documented production integration, but its public endpoint now requires a signed/anonymous-user token and returns `40101` for anonymous traffic, so it is **not** used as a zero-credential demo path. Meta Ad Library (via Apify) is the live source.

**Data limits:** Public scrapers return samples of top performers, not exhaustive datasets (~20–50 ads/run). That's intentional — the use case is analyzing what's winning, not cataloguing everything. Production path: Apify's paid plan or ScrapeCreators (~$0.40/1k ads). Because results are cached per vertical, the steady-state scraping cost is near-zero.

## Cost & limits

**AI cost:** Seed verticals (weight-loss supplement, debt relief, ED telehealth) are pre-analyzed and served from cache — zero API calls for the demo path. A full live run on a novel vertical (15 ads → DNA → clustering → 10 briefs) costs roughly $0.03–0.05 at Anthropic's Sonnet pricing. Gemini Flash is a one-env-var fallback at effectively $0 on free tier.

**Stack:** Next.js 15 App Router + TypeScript + Supabase + Anthropic API (Claude Sonnet), deployed on Vercel. Mirrors the It's Today Media frontend stack exactly.

---

## Running locally

```bash
npm install
cp .env.local.example .env.local  # add ANTHROPIC_API_KEY + Supabase keys
npm run dev
```

The seed path (3 pre-analyzed verticals + 2 sample ad sets) works with no API keys at all. The live path requires `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com).

```bash
npm run typecheck   # tsc --noEmit
npm run build       # must pass before deploy
```

---

Built for the It's Today Media $5,000 Build Challenge · June 2026
