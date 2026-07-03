# It's Today Media — Comprehensive Research Brief
> Compiled for the $5,000 Build Challenge · Last updated: June 25, 2026

---

## Table of Contents
1. [Company Overview](#company-overview)
2. [Leadership & Team](#leadership--team)
3. [Business Model Deep Dive](#business-model-deep-dive)
4. [Technology Stack & Tools They've Built](#technology-stack--tools-theyve-built)
5. [Ad Platforms & Marketing Operations](#ad-platforms--marketing-operations)
6. [Affiliate Tracking Infrastructure](#affiliate-tracking-infrastructure)
7. [What They're Actively Building](#what-theyre-actively-building)
8. [Industry Context: Pain Points in Media Buying (2026)](#industry-context-pain-points-in-media-buying-2026)
9. [Contest Strategy & Build Ideas](#contest-strategy--build-ideas)
10. [Registration Tips (Non-US Applicants)](#registration-tips-non-us-applicants)
11. [Key Dates](#key-dates)

---

## Company Overview

| Field | Details |
|---|---|
| **Legal Name** | It's Today Media, LLC |
| **Founded** | April 2017 |
| **Incorporated** | Nevada (foreign LLC) |
| **Primary Location** | Incline Village, NV (George Mecham's location); Baltimore, MD (original ops address: 12 W Madison St.) |
| **Team Size** | 1–10 employees (extremely lean) |
| **Public/Private** | Private |
| **Website (contest)** | https://www.itstoday.media |
| **Website (original)** | https://www.itstoday.org |
| **Product website** | https://tracklysms.com |
| **LinkedIn** | https://www.linkedin.com/company/its-today-media (47 followers — very low profile) |

**What they do in one sentence:** It's Today Media buys paid media at scale across Google, Meta, Taboola, and TikTok to acquire email and SMS subscribers, then monetizes those lists through affiliate offers (CPA/CPL) — and is now building internal AI tools to make that entire operation faster and smarter.

---

## Leadership & Team

### George Mecham — Co-Founder & CEO
- **Background:** Spent 5 years at Agora Publishing / Money Map Press — one of the world's largest direct-response financial newsletter publishers — as SEM Specialist (2012–2014) then Advertising Director (2014–2017). This is a critical data point: Agora runs aggressive, ROI-obsessed performance marketing at massive scale. George absorbed that culture before starting It's Today Media.
- **Education:** Towson University (Baltimore)
- **Location:** Incline Village, Nevada (Lake Tahoe area)
- **LinkedIn:** https://www.linkedin.com/in/george-mecham-9530091b/
- **Writing style (from contest page):** Direct, no-BS, opinionated, values output over process. The job posting reads like someone who has been burned by bad hires before.

### John Mecham — CTO
- Almost certainly related to George (likely brother). MS from Georgia Institute of Technology.

### Valerie Dowdle — Co-Founder & COO
- Listed as "Co-Founder and Chief Operations Officer, Digital Marketer, Wordsmith" — suggests she owns content/copy as well as ops.

### Victoria Lobosco — CFO
- Added as manager in 2022, suggesting the company was growing/formalizing around that time.

### Samuel Munk — Director, User Acquisitions
- Owns the paid media buying function — likely the person whose daily problems a winning build tool should solve.

### Sally Holton — Affiliate Manager
- Manages affiliate relationships; she was the one publicly promoting Trackly SMS on LinkedIn, describing it as "The Iterable for SMS."

---

## Business Model Deep Dive

It's Today Media is a **performance/affiliate marketing company** operating a classic direct-response loop:

```
[Paid Ads] → [Landing Page / Lead Form] → [Email/SMS List] → [Affiliate Offers] → [Revenue]
     ↑                                                                                    |
     └─────────────────────── Optimization Feedback Loop ────────────────────────────────┘
```

### Step-by-Step

1. **Media Buying:** Run paid ads across Google, Meta, Taboola, and TikTok to drive cold traffic.
2. **Lead Capture:** Traffic hits a landing page. Visitor submits email/phone → becomes a subscriber.
3. **List Monetization:** Subscribers receive email and SMS campaigns promoting affiliate offers. Each conversion generates a CPA (cost per acquisition) or CPL (cost per lead) payout.
4. **Optimization:** Analyze which ad creatives, landing pages, audiences, and offers produce the best revenue per subscriber (RPS / EPC — earnings per click). Kill what doesn't work. Scale what does.

### Revenue Model
- **Affiliate commissions:** Paid per lead or per acquisition from affiliate networks.
- **Email list monetization:** Ongoing re-monetization of acquired subscribers through email sequences.
- **SMS monetization:** Through Trackly SMS — their own platform for high-volume affiliate SMS marketing.
- **Possible SaaS revenue:** Trackly SMS appears to be offered as a paid product to external customers (not just internal use), suggesting a nascent SaaS revenue stream.

### Key Metrics They Optimize For
| Metric | What It Means |
|---|---|
| **CPL** (Cost Per Lead) | What it costs to acquire one email/phone subscriber |
| **CPA** (Cost Per Acquisition) | What it costs for a subscriber to complete an affiliate offer |
| **EPC** (Earnings Per Click) | Revenue generated per click on an affiliate link |
| **RPS** (Revenue Per Send) | Revenue generated per SMS sent — their Trackly optimization target |
| **ROAS** | Return on ad spend across paid platforms |
| **CTR** | Click-through rate on ads and emails/SMS |
| **CVR** | Conversion rate on landing pages |

---

## Technology Stack & Tools They've Built

### Internal Tech Stack (Confirmed)
- **Frontend:** Next.js, React 19 + TypeScript
- **Backend:** Python, Flask REST API
- **CMS/Original site:** WordPress + WooCommerce (itstoday.org — older site, likely not current ops)
- **Infrastructure:** Cloudflare (CDN/optimization)
- **AI Frameworks:** Unspecified; described as "various AI frameworks"

### Trackly SMS — Their Flagship Internal → External Product

Trackly SMS (tracklysms.com) started as an internal tool and is now offered to external affiliate marketers. It's the clearest window into how It's Today Media thinks and builds.

**What it is:** An SMS marketing platform purpose-built for affiliate marketers and CPA performance teams — positioned as "The Iterable for SMS."

**Key features:**
- **Spreadsheet-like sender UI** — organize creative variants in a grid; built for fast iteration
- **Thompson Sampling optimization** — Bayesian multi-armed bandit algorithm that automatically shifts traffic to highest-EPC creatives without manual A/B cycling
- **Testing modes** — Random shuffle, Thompson sampling, CTR-based — switchable per campaign
- **Smart carrier routing** — policy-driven orchestrator picks the best lane by cost, deliverability, and regional rules
- **Multi-carrier support** — Twilio, Infobip, Lime, CM, Aloware; BYOC (bring your own carrier)
- **Audience segmentation** — AND/OR logic with engagement scoring across SMS, email, and web activity
- **Affiliate attribution** — native integrations with TUNE, Everflow, and Cake; every click tracked, conversions via postback, revenue attributed to specific message/creative/offer
- **Compliance baked in** — TCPA quiet hours, 60+ STOP keyword variants, FCC DNC list sync, 10DLC registration, Blacklist Alliance integration, consent audit trails
- **Webhook + DLR** — delivery receipts update metrics in real time

**Architecture:**
- Dashboard: React 19 + TypeScript
- API: Flask REST API (v2)
- Message execution: High-throughput workers, 30-thread pool, distributed rate limiting
- Link tracking: Low-latency redirect service with bot detection

**Pricing:**
- Free: $0/month, BYO number, 500 messages/month, full feature access
- Paid: $19.99/month + $0.0045/segment (first 1M), $0.0030/segment after

**What this reveals about the team:** They are thoughtful engineers who care about real-world performance marketing constraints (deliverability, compliance, attribution accuracy, cost-per-segment economics). They didn't just build a generic texting tool — they built for their specific workflow. This is exactly the mindset the new hire needs.

---

## Ad Platforms & Marketing Operations

They run at scale across four platforms:

### Google Ads
- Search and display; likely used for high-intent lead capture (e.g., insurance, finance, health verticals common in affiliate marketing)
- Google's Performance Max campaigns now use AI to optimize across all placements

### Meta (Facebook/Instagram)
- Historically their heaviest platform for lead gen
- Meta CPMs rose ~19% YoY in 2025 — increasingly expensive but highest conversion intent
- Meta's algorithm (Andromeda, Lattice, GEM) now treats **creative as targeting** — the copy and video dictate who sees the ad more than audience selection
- Direct implication: **creative volume and diversity are now existential** — teams that can't produce and test 5+ genuinely different creatives per ad set fall behind

### Taboola
- Native advertising platform (now rebranded as "Taboola Realize" — old macros still work)
- Reaches ~600M+ users/day on publisher sites; strong for top-of-funnel reach and email list building
- Lower CPMs than Meta/Google; good for aggressive lead-gen volume

### TikTok
- Growing channel; requires platform-native creative (UGC-style, vertical video)
- Cannot repurpose Meta creative directly — TikTok's algorithm penalizes over-produced ads
- TikTok's GMV Max campaigns now automate most of the buying; affiliate-driven content is the fuel

---

## Affiliate Tracking Infrastructure

Based on Trackly SMS's integrations, It's Today Media almost certainly uses one or more of these affiliate tracking platforms:

| Platform | Role |
|---|---|
| **TUNE / HasOffers** | Enterprise affiliate tracking; server-to-server postback conversion attribution |
| **Everflow** | Modern affiliate/partner marketing platform; tracks clicks, conversions, revenue per source |
| **Cake** | Legacy but widely used affiliate tracking software |

These platforms handle the core tracking loop:
- Affiliate link click → tracked with SubIDs
- Landing page conversion (lead/sale) → conversion postback fires
- Revenue attributed back to the specific ad/creative/placement/audience that drove it

The **pain point** every media buyer on these platforms faces: the data is click-level accurate but the *analytical layer is weak*. You get raw performance data, but synthesizing it across platforms into optimization decisions requires manual work or extra tooling.

---

## What They're Actively Building

From the job posting (these are **confirmed active projects**):

### 1. End-to-End Video Creative Generator
- Likely: text prompt or brief → AI-generated video ad
- Probably targeting UGC-style video for TikTok and Meta Reels
- Tools in this space: Runway, HeyGen, Synthesia, Kling, Sora
- **Do not build this for the contest** — it's already in progress

### 2. Automated Ad Creation & Upload Workflow via MCP Server
- Goal: reduce the manual loop of creating an ad → uploading to platform → setting targeting → launching
- This is a direct pipeline from creative asset to live campaign across Google/Meta/Taboola/TikTok APIs
- **Do not build this for the contest** — it's already in progress

### 3. Landing Page Generator & CMS
- AI-assisted landing page creation; probably includes A/B variant generation
- **Do not build this for the contest** — it's already in progress

---

## Industry Context: Pain Points in Media Buying (2026)

Understanding these helps identify what problem to solve:

### Creative Fatigue Is Getting Worse
Meta's algorithm now requires **5+ genuinely different creative formats per ad set** to avoid ad fatigue. Teams that can't continuously produce diverse hooks, formats (UGC, static, founder video, user testimonial), and copy variations lose efficiency fast. Creative throughput is now a direct revenue lever.

### Cross-Platform Data Is Siloed
A media buyer running Google + Meta + Taboola + TikTok simultaneously sees their data in four separate dashboards with different attribution models, different naming conventions, and no unified view. Making an optimization decision (e.g., "should I shift budget from Taboola to TikTok this week?") requires manual aggregation. This is a significant, recurring, high-value pain point.

### Creative Performance Analysis Is Manual
Knowing *why* a creative worked (was it the hook? the offer? the CTA? the visual style?) requires manual tagging and cross-referencing. Most teams don't have structured creative intelligence — they just run things and rotate out losers.

### Ad Upload/Launch Is Still Largely Manual
Even with bulk upload tools, launching a new batch of creative variants across multiple platforms (with correct naming, targeting, bid strategy, etc.) involves a lot of repetitive human steps.

### Landing Page CRO Requires Constant Iteration
High-volume lead-gen operations need to constantly test headlines, page layouts, form designs, and offer framing. Most teams do this manually in slow cycles.

---

## Contest Strategy & Build Ideas

### What George Mecham Is Looking For
From the contest page language and his background, he wants to see:
- **Real problem selection** — not a generic tool, but something that solves a problem his team actually has today
- **Functional software** — "ugly and functional beats beautiful and broken"
- **Clear product thinking** — "Why THIS one?" and "What would you build next?" reveal how you think
- **Marketing understanding** — you don't need experience, but you need to understand why the problem matters

### Problems That Are NOT Already Covered (Good Build Targets)

#### Tier 1: Highest Signal
| Build Idea | Why It Fits |
|---|---|
| **Unified cross-platform ad performance dashboard** with AI-generated daily optimization brief | They span 4 platforms with siloed data; this is a daily operational pain. Pulls from Google Ads API, Meta Marketing API, Taboola API, TikTok Business API into one view with anomaly detection + natural language "what should I do today?" output. |
| **AI creative analyst / intelligence layer** | Ingests their ad creative (image/video + copy), tags it automatically (hook type, format, offer framing, CTA style), tracks performance by tag, surfaces patterns. Answers "what kinds of creatives are winning right now and why?" |
| **Ad creative variation generator (copy + hooks focus)** | Not the full video generator (already in progress) but a tool that takes a winning ad brief and generates 10–20 copy/hook variations, formatted for each platform's specs, ready to paste into bulk upload sheets. Narrower than what they're building, complements it. |

#### Tier 2: Solid Options
| Build Idea | Why It Fits |
|---|---|
| **Landing page CRO AI auditor** | Analyzes an existing landing page URL → scores it against conversion best practices → outputs specific, actionable recommendations. Complements (doesn't duplicate) their landing page generator. |
| **Offer-to-audience matcher** | Given a set of affiliate offers and their performance data, suggests which ad platform audiences or Taboola content categories are most likely to convert — pulls from their TUNE/Everflow data + ad platform audience data. |
| **Campaign naming & taxonomy enforcer** | A small but genuinely painful problem — inconsistent naming conventions across platforms make cross-platform analysis impossible. A tool that generates consistent, structured campaign/ad set/ad names and enforces them on upload. |

### What to Avoid
- ❌ Rebuilding Trackly SMS — they already have it
- ❌ Full video creative generator — in progress
- ❌ Generic landing page builder — in progress
- ❌ Full ad upload MCP connector — in progress
- ❌ Anything that doesn't connect to their actual tech stack or platforms
- ❌ Pretty dashboards with fake/mocked data — must work with real APIs

### The README Is the Pitch
Three questions they're asking:
1. **What does this tool do?** → Be concise. One paragraph max.
2. **Why did you build THIS one?** → Demonstrate marketing understanding. Show you know what problem costs them money.
3. **What would you build next?** → This is a product roadmap question. Show a sequence of valuable follow-on work. This tells them how you'll perform in the actual job.

---

## Registration Tips (Non-US Applicants)

The contest strongly prefers US-based applicants. If applying from Canada (Toronto):

**Strengths to emphasize:**
- Toronto → Eastern Time = **zero time zone friction**. You are already operating in East Coast business hours.
- Canadian work authorization is separate from US work authorization, but you can frame this honestly: willingness to discuss visa sponsorship, contractor arrangements, or remote-first engagement.
- Toronto has a strong tech scene with Shopify, Wealthsimple, and major ad tech presence — signal that you understand the North American performance marketing market.

**What they actually care about:** Can you build, do you understand the business, and can you show up reliably? If the answer to all three is yes, the geography question becomes secondary.

**The registration field says:** *"US-based applicants are strongly preferred. If you can make a compelling case for consideration despite not being US-based, this is where you do it. Why are you the exception?"*

Be direct, be specific, and lead with the ET overlap argument.

---

## Key Dates

| Date | Event |
|---|---|
| **Now (June 25, 2026)** | Register immediately — George reviews personally and approval unlocks the submission link |
| **July 4, 2026, 11:59 PM ET** | Submission deadline — ~9 days from today |
| **By July 10, 2026** | Finalists notified |
| **After July 10** | Finalist interviews; winner announced and offered the role |

**Deliverables required:**
1. **Working demo** — live URL on Vercel preferred; Loom walkthrough acceptable if live URL isn't possible
2. **GitHub repo** — public or private; they will read the code
3. **README** answering the three questions above

**Prize structure:**
- Finalists: $250 honorarium + guaranteed interview
- Winner: $5,000 cash (paid on accepting the full-time offer) + full-time job offer

---

## Sources & References

- https://www.itstoday.media/ — Official contest page
- https://www.itstoday.media/faq — FAQ
- https://www.itstoday.media/role — Job description
- https://www.itstoday.org/ — Original company website
- https://tracklysms.com/ — Trackly SMS product site
- https://docs.tracklysms.com/introduction — Trackly SMS documentation
- https://tracklysms.com/blog — Trackly SMS blog (active content marketing since March 2026)
- https://www.linkedin.com/company/its-today-media — LinkedIn profile
- https://www.linkedin.com/in/george-mecham-9530091b/ — George Mecham LinkedIn
- https://opencorporates.com/companies/us_nv/E0247222019-8 — Nevada corporate registration
- ZoomInfo, RocketReach, ContactOut — employee and leadership data
