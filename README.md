# Creative Strategist

**Reads what's winning in your vertical, scores your own ad set for hidden redundancy, and generates a prioritized batch of new angles to run next.**

Live demo: **[angler-delta.vercel.app](https://angler-delta.vercel.app)** (no login, no credentials, works in incognito)

---

## What does it do?

Creative Strategist is a four-module AI tool for affiliate media buyers that answers the question teams almost never ask systematically: **which ads should we make at all?**

1. **Competitive Angle Miner.** Enter a vertical or offer and pull the top competitor ads from public ad libraries, ranked by run-duration. An ad running 30+ days in affiliate land is almost certainly profitable, because the advertiser proved it with real spend. Longevity is a free, public proxy for ROI.

2. **Creative DNA Deconstructor.** A vision + language model turns each ad into a structured record: hook type, emotional driver, format, offer framing, CTA style, and target persona. A gallery of competitor ads becomes a queryable creative intelligence database.

3. **Andromeda Diversity Scorer.** Drop in your current ad set (one click for a sample, or paste your own captions). The tool groups your ads into the distinct *concepts* Meta's algorithm actually sees, and flags where near-duplicates are collapsing into the same Entity ID. You think you're running 8 ads. Meta sees 3. Here's where you're wasting auction entries, and here are the proven angles you're not running.

4. **Angle Generator.** Synthesizes market patterns and diversity gaps into 10+ prioritized angle briefs with platform-formatted copy variants for Meta, TikTok, and native. Ready to paste into a bulk sheet or hand directly to a video creative tool.

Runs entirely on **public data and user-uploaded ad copy**. No ad-account credentials required: anyone can open the URL and use the full tool in under 60 seconds.

Two extras layered on top: a **pre-flight check** that scores a single planned ad against your set *before* you spend on production ("this collapses into Concept 2, and here's what to change"), and an **MCP server** so the whole intelligence layer is callable from Claude (see [Use it from Claude](#use-it-from-claude-mcp)).

---

## Why did you build this one?

Three reasons, in order of leverage.

**1. Creative is now the dominant performance lever, and most teams don't know it yet.**

Meta's Andromeda retrieval system (global rollout completed around October 2025) changed ad delivery: instead of routing by advertiser-defined audiences, it uses computer vision to read your creative and predict who should see it. Your creative *is* your targeting now. Meta's own data attributes roughly 56% of campaign performance to creative quality, more than targeting, budget, placement, and timing combined. Top-third advertisers run ~395 live ads vs ~296 for bottom-third, and the new cadence is 8-12 genuinely distinct concepts per campaign, refreshed every 2-3 weeks. Creative volume and real diversity are now existential for performance.

**2. The Entity ID trap is a specific, money-losing problem almost nobody checks.**

Andromeda assigns each creative an Entity ID from its visual and semantic pattern. Upload ads that are too similar and they collapse into the same ID: you think you're running 10 diverse ads, but Meta sees 3, and 7 auction entries are wasted. Teams optimize for cosmetic diversity (new headline, same hook, same format, same angle) without realizing they're adding no real signal. Module 3 measures *semantic* diversity, the thing that actually matters to the algorithm, and names the gaps in terms of proven market angles.

**3. For a direct-response affiliate shop, the angle is the highest-ROI lever, and this fills the gap in the assembly line you're already building.**

A reporting dashboard describes the past. An angle engine creates future winners. More concretely: the video generator handles *making* the asset, the MCP uploader handles *launching* it, and the landing page generator handles *converting* the click. Nothing decides *what to make*. Creative Strategist is the missing upstream strategy layer that feeds all three: angle briefs drop straight into the video tool, and the resulting ads flow into the MCP uploader. Not a competing silo, but the first stage of the pipeline that makes the other stages worthwhile.

---

## What would you build next?

In priority order, as I'd actually sequence it for a lean affiliate team:

**1. Close the performance feedback loop.**
Wire the angle briefs to actual CPA/ROAS outcomes: after a campaign runs, tag which generated angles converted and at what cost. The tool learns which creative patterns predict winners in this specific vertical, for this specific audience, and the strategy layer becomes self-improving rather than just sourcing from the market.

**2. Extend the MCP server to the live path.**
A first MCP server already ships. The deployed app exposes the pre-analyzed verticals as five tools at `/api/mcp` (see [Use it from Claude](#use-it-from-claude-mcp)). Next: add live-pull and scoring tools so the full chain, strategy to generation to upload, becomes callable as a single agent pipeline from Claude, alongside the MCP-based ad creation and upload workflow the team is already building. New vertical in, live campaign brief out, with no manual handoffs.

**3. Quantitative diversity scoring + broader data.**
Layer embeddings-based cosine similarity alongside the explained clusters, so teams get a concrete diversity score per ad set instead of only a narrative. Add a paid Apify tier for deeper coverage (~$0.40/1k ads via ScrapeCreators) and Meta Ad Library access for first-party brand data. The free-tier demo gives a sample; production gives the full picture.

---

## Data provenance (no fabricated data)

Everything the demo shows is **real**. The competitor ads are genuine, currently or recently running ads pulled from public ad libraries, not invented examples.

- **Seed verticals** (weight-loss supplement, debt relief, ED telehealth, investing newsletter) are **real ads scraped from the Meta (Facebook) Ad Library** via the public Apify actor [`curious_coder/facebook-ads-library-scraper`](https://apify.com/curious_coder/facebook-ads-library-scraper), then **cached** so the demo runs instantly with zero credentials. Each ad's run-duration is derived from its real Ad Library delivery start date. Advertiser names are real entities you can look up in the [Meta Ad Library](https://www.facebook.com/ads/library/). Cached real data is the standard approach here; nothing is mocked or hand-written. Refresh the cache anytime with `npm run refresh-seed`.
- **Novel verticals** (anything you type that isn't pre-seeded) attempt a **best-effort live Apify pull** of the Meta Ad Library. If it returns nothing in time, the app **degrades honestly**: it tells you to try a seeded vertical rather than showing a fabricated result.
- **TikTok Creative Center** is wired as a documented production integration, but its public endpoint now requires a signed anonymous-user token and returns `40101` for anonymous traffic, so it is **not** used as a zero-credential demo path. Meta Ad Library (via Apify) is the live source.

**Data limits:** Public scrapers return samples of top performers, not exhaustive datasets (~20-50 ads/run). That's intentional. The use case is analyzing what's winning, not cataloguing everything. Production path: Apify's paid plan or ScrapeCreators (~$0.40/1k ads). Because results are cached per vertical, the steady-state scraping cost is near zero.

## Cost & limits

**AI cost:** Seed verticals are pre-analyzed and served from cache, so the demo path makes zero API calls. A full live run on a novel vertical (15 ads through DNA, clustering, and 10 briefs) costs roughly $0.03-0.05 at Anthropic's Sonnet pricing. Gemini Flash is a one-env-var fallback at effectively $0 on free tier.

**Stack:** Next.js 15 App Router + TypeScript + Supabase + Anthropic API (Claude Sonnet), deployed on Vercel. Mirrors the It's Today Media frontend stack exactly.

---

## Use it from Claude (MCP)

The deployed app doubles as an **MCP server** at `/api/mcp`. Add it to Claude Code, Claude Desktop, or any MCP client that supports streamable HTTP:

```json
{
  "mcpServers": {
    "creative-strategist": {
      "url": "https://angler-delta.vercel.app/api/mcp"
    }
  }
}
```

Five tools are exposed: `list_verticals`, `get_market_winners`, `get_market_dna`, `get_diversity_report`, and `get_angle_briefs`. Then ask Claude things like:

- *"What angles should I test for debt relief?"*
- *"Which ads in the weight-loss sample set collapse into the same concept, and what's missing?"*
- *"Show me the creative DNA of the longest-running ED telehealth ads."*

The MCP tools serve the **pre-analyzed seed verticals**: instant, zero credentials, zero AI spend. Live pulls on novel verticals stay in the web app. For local development, point the client at `http://localhost:3000/api/mcp`.

---

## Running locally

```bash
npm install
cp .env.local.example .env.local  # add ANTHROPIC_API_KEY + Supabase keys
npm run dev
```

The seed path (4 pre-analyzed verticals + 2 sample ad sets) works with no API keys at all. The live path requires `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com).

```bash
npm run typecheck   # tsc --noEmit
npm run test        # unit tests
npm run build       # must pass before deploy
```

---

Built for the It's Today Media $5,000 Build Challenge · June 2026
