# CONTEXT — Why this project exists

> Read this first. It gives you the judgment context to make good calls when the
> spec is silent. The other docs tell you *what* and *how*; this tells you *why*,
> *for whom*, and *what will impress the person deciding*.

---

## 1. The opportunity

It's Today Media is running a **$5,000 Build Challenge** to hire a **Marketing
Development Engineer**. Build an AI-powered marketing tool; the best build wins
**$5,000 cash + a full-time job offer**. Finalists get a $250 honorarium + a
guaranteed interview.

- **Deadline:** July 4, 2026, 11:59 PM ET.
- **Deliverables:** (1) a working demo — **live URL on Vercel strongly preferred**;
  (2) a **GitHub repo** (they will read the code); (3) a **README** answering three
  questions — *What does it do? Why did you build THIS one? What would you build next?*
- **Judging:** (1) problem selection, (2) does it work — *"ugly and functional beats
  beautiful and broken,"* (3) code quality, (4) the README.
- **Applicant:** Toronto-based. The contest strongly prefers US-based candidates, but
  Toronto is on **Eastern Time — zero time-zone friction with an East-Coast team**,
  which is the lead argument for the non-US case. Build quality is the real
  differentiator; geography becomes secondary if the build, business understanding,
  and reliability are all there.

---

## 2. The company

**It's Today Media** — a performance / affiliate marketing company, founded 2017,
very lean team (1–10 people). The business is a classic direct-response loop:

```
[Paid Ads: Google / Meta / Taboola / TikTok]
      → [Landing Page / Lead Capture]
      → [Email & SMS Lists]
      → [Affiliate Offers (CPA / CPL)]
      → [Revenue]
      → (optimization feedback loop back to ads)
```

ROI is everything. They buy media at scale, capture email/SMS subscribers, and
monetize those lists through affiliate offers. They optimize relentlessly on metrics
like **CPL, CPA, EPC, RPS, ROAS, CTR, CVR.**

**Trackly SMS** (their flagship internal→external product) tells you who they are as
engineers: a sophisticated SMS platform with Thompson-Sampling multi-armed-bandit
optimization, smart multi-carrier routing, native affiliate attribution (TUNE,
Everflow, Cake), and baked-in compliance (TCPA, 10DLC, STOP handling). They build
**for their specific workflow**, not generic tools. The new hire is expected to do
the same. Mirror that energy: build something *specific to affiliate media buying*,
not a generic marketing gadget.

**Their confirmed tech stack:** Next.js, React 19 + TypeScript (frontend); Python +
Flask (backend); Cloudflare; **Supabase** (in their connector set); they use **Claude
and Cursor**. → This is why we build on Next.js/TS + Supabase + Claude: day-one
codebase fit.

---

## 3. The judge

**George Mecham**, co-founder & CEO. Spent ~5 years at **Agora / Money Map Press** —
one of the world's largest direct-response financial newsletter publishers — as SEM
Specialist then Advertising Director, before founding It's Today Media. That matters:
Agora runs aggressive, ROI-obsessed performance marketing at massive scale, and George
absorbed that culture.

His writing on the contest page is **direct, no-BS, output-over-process, and clearly
written by someone who has been burned by bad hires.** He repeatedly signals that he
wants someone who **sees opportunity and moves on it without being told.** The job
description even lists "who this is NOT for": people who need a ticket to act, who wait
for permission, who can't take blunt feedback, who aren't curious about the business.

**Implication for the build and the README:** speak his language — ROI, output,
"this finds and ships winning angles faster." Demonstrate that you see a money problem
he didn't explicitly hand you, and that you moved on it. The README's "what would you
build next?" is a direct audition for how you'll operate in the actual job; answer it
like a product roadmap, not a wishlist.

---

## 4. What they are ALREADY building (DO NOT duplicate)

Confirmed in-progress projects. Building any of these is an instant signal that you
didn't do the homework:

1. End-to-end **video creative generator**.
2. Automated **ad creation + upload workflow via MCP server**.
3. **Landing page generator / CMS**.

**Full "avoid" list:**
- ❌ Rebuilding **Trackly SMS** (they have it).
- ❌ The **video creative generator** (in progress).
- ❌ The **landing page builder / CMS** (in progress).
- ❌ The **full ad-upload MCP** (in progress).
- ❌ A **unified cross-platform performance dashboard** — not because it's low value
  (it's high value), but because it can only be demoed convincingly with the judge's
  real ad-account data or with fake data. It is a *demo trap*. See §6.
- ❌ Anything that only works with **fake/mocked data** or the **judge's credentials**.

---

## 5. The build: Creative Strategist

The **missing strategy / intelligence layer** that sits *upstream* of their video
generator and MCP uploader. Their tools answer "how do we make and launch ads fast?"
This tool answers the prior, higher-leverage question: **"which ads should we make at
all?"**

Map their three in-progress builds onto the creative assembly line:

| Stage | Their in-progress tool |
|---|---|
| **Strategy** (decide *what* to make) | ❌ **nothing — this is the gap we fill** |
| **Production** (make the asset) | Video creative generator |
| **Distribution** (launch the asset) | MCP-based ad upload workflow |
| **Landing** (convert the click) | Landing page generator / CMS |

So it's not a competing silo — it's the **missing first stage of the assembly line
they're already constructing**, and it *feeds* the others (angle briefs + platform-
formatted copy drop straight into the video generator; the resulting ads flow into the
MCP uploader). That also makes it a clean, credible answer to "what would you build
next?"

**The four modules** (full detail in `PRODUCT_SPEC.md`):

1. **Competitive Angle Miner** — input a vertical/offer → pull live competitor ads from
   public ad libraries → rank by run-duration (longevity = winning signal).
2. **Creative DNA Deconstructor** — vision + language model turns each ad into a
   *structured* record (hook type, angle/emotional driver, format, offer framing, CTA
   style, persona). Turns a gallery of ads into a queryable creative database.
3. **Andromeda Diversity Scorer** — user drops in their current ad set → the tool
   groups it into distinct *concepts* and flags near-duplicates → "Meta will see these
   8 ads as 3 concepts — here's where you're wasting auction entries" + the angle gaps
   they're not running.
4. **Angle Generator** — synthesizes market patterns + diversity gaps into a
   prioritized batch of net-new angle briefs + platform-formatted hook/copy variants,
   ready to paste into a bulk sheet or hand to the video tool.

---

## 6. Why this build wins (the reasoning to put in the README)

### 6.1 Creative is now THE performance lever (2026 reality)
Meta's **Andromeda** retrieval system (global rollout completed ~October 2025) changed
ad delivery: instead of routing by advertiser-defined audiences, it uses computer
vision to **read your creative and predict who should see it**. Practical effect:
**your creative is now your targeting.**
- Meta's own data science attributes **~56% of campaign performance to creative quality**
  — more than targeting, budget, placement, and timing combined.
- Top-third advertisers run **~395 live ads** at once vs ~296 bottom-third.
- 2026 cadence: **8–12 genuinely distinct concepts per campaign** (some push 20–30
  creatives/ad set), refreshed every **2–3 weeks**, because fatigue hits faster.
- → **Creative volume AND genuine diversity are now existential.**

### 6.2 The "Entity ID" trap (the sharp, buildable wedge)
Andromeda assigns each creative an **"Entity ID"** from its visual pattern. Upload many
ads that are too similar and **they collapse into the same Entity ID** — you *think*
you're running 10 diverse ads, but Meta effectively sees 3, and the other 7 auction
entries are wasted. Almost nobody checks whether creative is *semantically* diverse vs
merely *cosmetically* diverse (new headline, same everything). Module 3 measures exactly
this. Concrete, money-losing, specific to 2026.

### 6.3 For an affiliate shop, the angle is the whole game
The **angle** — the psychological hook (fear, greed, curiosity, status, urgency,
novelty) — is where the outsized ROI lives. A free signal: **in affiliate land, an ad
running for a long time is a winner** (advertisers kill losers fast), so **ad longevity
is the cleanest public proxy for profitability.** A tool that sources and generates
angles is **closer to revenue than any reporting dashboard** — dashboards describe the
past; an angle engine creates future winners. This is George's native language.

### 6.4 Fit with this specific judge
George did exactly this at Agora — aggressive, ROI-obsessed direct response. "This
finds and ships winning angles faster across all four platforms by reading what's
already winning" is the most viscerally compelling pitch you can make to him, and
building it demonstrates the exact trait he's hiring for: seeing the opportunity he
hasn't articulated yet, and moving on it.

---

## 7. The demo-ability constraint (the strategic crux — internalize this)

This is the single most important strategic insight, and the thing most applicants will
get wrong.

The judging explicitly forbids **"pretty dashboards with fake/mocked data."** That
quietly eliminates the most *obvious* "big" idea — a unified cross-platform performance
dashboard — because:
- It's only meaningful populated with **real ad-account data**.
- The judge will **not** hand over OAuth into his live ad accounts to test your demo.
- You **cannot** generate meaningful 4-platform spend data yourself in nine days.

So most people chasing the theoretically "biggest" problem submit something visibly
empty or visibly faked — the exact failure mode George called out.

**The winning move (and the reason Creative Strategist was chosen):** pick a high-value
problem whose tool runs on **public data or user-supplied input**, so you ship a **live
URL the judge clicks and uses immediately, with none of his credentials.** That property
is worth more than chasing the "biggest" problem on paper. Every build decision should
protect it.

---

## 8. The honesty edges (put these in the README — they read as maturity)

- **Free-tier data caps.** Public scrapers return *samples, not exhaustive datasets*
  (~50 ads/run on a Meta actor, ~20–40 per TikTok filter without login). Fine — the use
  case is analyzing *top performers*, not every ad. Production path: Apify paid plan or
  ScrapeCreators (~$0.40/1k ads).
- **Unit economics.** The demo runs cheap by design (cached heavy analysis + a small
  Anthropic API key). Documenting the cost/privacy path from demo → production is itself
  a signal an ROI-minded operator rewards. Detail in `INTEGRATIONS.md`.

---

## 9. Sources this context is distilled from
- It's Today Media contest page, FAQ, and role description (provided).
- `its_today_media_research.md` (company research brief, provided).
- `creative-strategist-background.md` (full strategy rationale, provided).
- 2026 platform reality (Andromeda, creative-as-targeting) and free-tier tooling notes
  therein. Free-tier limits drift — verify current numbers before relying on them.
