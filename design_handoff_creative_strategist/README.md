# Handoff: Angler — Creative Strategist Redesign

## Overview
Angler is a tool for performance marketers deciding which ad creative to produce next. It reads the longest-running (i.e. proven-winning) ads in a given vertical from public ad-library data, deconstructs their creative DNA (hook, angle, format, emotion), audits the marketer's own ad set against Meta's Entity ID system to surface hidden duplicate creatives wasting auction entries, and generates prioritized "next angle" briefs with evidence and ready-to-use copy variants per platform.

## About the Design Files
The files in this bundle are **design references built as an interactive HTML prototype** — they demonstrate intended visual design, layout, states, and behavior, but are not production code to copy verbatim. The task is to **recreate this design in the target codebase's existing environment** (React, Vue, native, etc.) using its established components, data-fetching patterns, and conventions. If no frontend environment exists yet, choose the framework best suited to the project and implement the design there.

The prototype uses a lightweight custom templating runtime (`support.js`, `<x-dc>`, `<sc-for>`/`<sc-if>` loops/conditionals) that is specific to this design tool — do not port that runtime. Treat `Angler - Final.dc.html`'s inline `class Component extends DCLogic { ... }` logic as **pseudocode for the intended state machine and derived-data logic**, not literal code to paste in.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and interaction timing shown here are final — recreate pixel-perfectly using the codebase's own component library and styling approach (rather than copying inline styles 1:1).

## Screens / Views
The design is a single scrolling page with a sticky nav and four numbered sections that reveal after a "run demo" action. There is no separate "page navigation" — it's one continuous flow with anchored sections.

### Sticky nav + reel-in progress bar
- **Purpose**: Persistent wayfinding + a playful "reel in" scroll-progress indicator (fishing rod line + hook icon) themed to the "Angler" name.
- **Layout**: Sticky header, `max-width: 1200px` centered, `13px 32px` padding, flex row: logo mark + wordmark, 4 nav links, a right-aligned mono-caps disclaimer ("REAL AD-LIBRARY EVIDENCE · NO LOGIN"), and a primary "▶ 15-second demo" button. Below it, a 3px progress track fills left-to-right with scroll position; a small hook icon rides the fill's leading edge.
- **Components**: Nav links are disabled/greyed (`#C9C2B2`) until results exist; the active section (by scroll position, 45% viewport threshold) highlights in accent orange with a bottom underline.

### Hero / landing
- **Purpose**: Entry point — pick a vertical, kick off the demo.
- **Layout**: Two-column grid (`1fr / 360px`) on a soft radial-gradient background (cool violet + warm terracotta washes over cream). Left: eyebrow label, two-line serif headline ("Which ads should you make *at all?*"), supporting paragraph, a vertical text input + primary CTA button, and 4 quick-select vertical chips. Right: a collage of 5 rotated, overlapping fake ad-creative cards (simulated Meta/TikTok in-feed ads) at varied depths/blur to suggest a wall of competitor ads; two cards have a subtle vertical drift animation (7–8s ease loops).
- **States**: Below the hero, a "sonar" status band appears once the demo starts: a pulsing double-ring loader (ripple keyframe, 1.6s) while loading, log lines typing in one at a time (~520ms cadence, 5 steps) in mono font, then a green checkmark ring + "done" line on completion.

### Nº1 — The Catch (market winners)
- **Purpose**: Show the real, longest-running competitor ads as evidence.
- **Layout**: Large translucent "Nº1" numeral watermark top-right. Header rule: mono-caps section title + ad count/source metadata + "Extract DNA ↓" jump link. Below: two-column layout — left is a ranked ledger (rank · advertiser · hook line · a dashed "duration gauge" bar + days-live count, top 3 in green), rows animate in staggered (~0.05s stagger); a pull-quote "desk note" below the ledger explains why the top ads win. Right column is a **sticky** simulated in-feed ad preview card (avatar, advertiser, sponsored/days-live, copy, colored creative panel with kicker + headline, domain/CTA footer) that updates to match whichever ledger row is clicked, plus 3 small tag pills (angle/format/hook) and a "click a row to preview" hint.

### Nº2 — Creative DNA
- **Purpose**: Let the user explore the deconstructed pattern (hook/angle/format/emotion) behind every winning ad, filterable.
- **Layout**: "Nº2" watermark. Header rule with title + "showing X of Y" counter + a "clear ×" link when filters are active. Below: 3 filter rows (ANGLE / FORMAT / HOOK), each a horizontal list of toggle-pill chips (active = orange border/tint). Below that: a responsive 3-column grid of small cards, one per ad — advertiser name + days-live (right-aligned, mono), and 4 small colored tag pills (angle in orange tint, format/hook in neutral tint, emotion in blue tint).

### Nº3 — The Entity-ID Audit
- **Purpose**: The core "aha" — show the user their own ad set collapses into fewer unique concepts than they think, per Meta's Entity ID system, and quantify the wasted spend.
- **Layout**: "Nº3" watermark. Header rule with sample-set label + "paste your own ↓" link (non-functional stub in the prototype — flag for real upload/paste flow).
  - **Marginalia headline**: large serif sentence — "You run **N ads**. Meta sees **K concepts**." — with the two numbers hand-circled/underlined via animated SVG squiggle strokes (draws in once, staggered ~0.5s/0.9s delay) the first time this section scrolls into view (≥18% visible via IntersectionObserver, with a 9s fallback timer).
  - **User ad-set strip**: wrapped row of small cards, one per ad in the sample set, flagged with an amber "⚠ COLLAPSES" tag if it's part of a duplicate cluster.
  - **"Ink plate" panel**: a dark violet gradient card (`16px` radius, deep shadow) with two giant numbers — N ads (white) "in" → K concepts (violet gradient text) "out" — plus an amber "WASTED ENTRY · X%" pill, an explanatory line, a "MONTHLY TEST BUDGET $" input, and a live-computed "≈ $X/mo babysits a duplicate" estimate. To its right, an SVG "merge diagram": dots for each user ad on the left, curved bezier lines converging into fewer slots on the right (amber lines/slots for ads that collapse), animating in with staggered stroke-draw.
  - **Clusters + gaps row**: left column lists each concept cluster (bordered card, left accent bar) with a "N× COLLAPSED" badge when duplicated and a one-line reason; right column is a **sticky** "PROVEN ANGLES YOU'RE NOT RUNNING" card — a numbered gap list plus a wrapped row of pills showing market-wide angle frequency counts.
  - **Pre-flight check**: a dashed-border card — pick or paste a planned ad, and see a verdict card (green "✓ genuinely new" vs amber "⚠ collapses into X") with a reason and, if it collapses, a short list of concrete fixes to earn a new Entity ID.

### Nº4 — Next Angles to Run
- **Purpose**: Deliver the prioritized, evidence-backed creative briefs — the tool's output artifact.
- **Layout**: "Nº4" watermark. Header rule with brief count + "Export CSV" / "Production JSON" buttons (top-right). Below: 2-column grid of brief cards (offset "brutalist" drop-shadow style: `3px 3px 0 #E5E0D5`, deepens on hover). Each card: priority badge (P1–P3 in accent orange, lower priority in neutral) + angle name + "COPY BRIEF" button; a "why now" line; an italic serif proposed hook line; a platform tab row (Meta/TikTok/Native) switching the copy variant shown below; a per-variant "COPY ⧉" button; an evidence row of small avatar chips (advertiser + days-live) citing the real ads that justify the angle, plus format/persona metadata.
  - **Integrity check strip**: a pale-green banner restating the brief count → distinct-concept count by the tool's own clustering scorer, holding the tool to the same duplication test it applies to the user.
  - **Footer**: small mono-caps credits/sources line.

## Interactions & Behavior
- **Demo flow (state machine)**: `idle → loading → results`.
  - Idle: hero only, nav links disabled, no status band.
  - Loading: triggered by the nav "▶ 15-second demo" button, the hero CTA, or typing + clicking "Cast the line →". Status band appears; 5 log lines print one at a time on a ~520ms interval with a blinking mono cursor; on the 6th tick, transitions to results.
  - Results: sections Nº1–Nº4 render; page auto-scrolls (smooth) to Nº1; nav links become active/clickable; a final green "✓ done" log line appends.
  - If already in `results` and the demo button is clicked again, it just scrolls back to Nº1 instead of re-running.
- **Scroll spy**: nav link + progress-bar fill + hook-icon position update continuously off scroll position (rAF-throttled); the "active" section is whichever of the four `ref`-anchored sections has crossed 45% of viewport height.
- **Row selection (Nº1)**: clicking a ledger row updates the sticky in-feed preview card to that ad's content and re-derives its DNA-based kicker/tags.
- **DNA filters (Nº2)**: each dimension (angle/format/hook) is an independent toggle; multiple dimensions AND together; clicking an active chip again clears just that dimension; "clear ×" resets all three.
- **Audit reveal (Nº3)**: circle/underline SVG annotations and the merge diagram only animate in the *first* time the section is scrolled into view (18% visibility threshold, IntersectionObserver, 9s fallback safety timer) — not on every scroll pass. The N→K numbers count up with a cubic ease-out over 1.2s.
- **Budget input (Nº3)**: live-recomputes the estimated monthly wasted spend as `budget × wastePct`; hides the estimate line if the input isn't a valid positive number.
- **Pre-flight (Nº3)**: selecting an example chip (or, in the real product, pasting custom ad copy) swaps in a precomputed verdict — collapses-into vs. genuinely-new — with supporting reason and fix suggestions.
- **Briefs (Nº4)**: platform tabs are per-card independent state (switching one card's tab doesn't affect others); "COPY ⧉" and "COPY BRIEF" write to clipboard and show a green "COPIED ✓" label for 1.4s before reverting; "Export CSV"/"Production JSON" trigger client-side file downloads of all briefs.
- **Motion**: entrance animations (fade/rise, ~0.4–0.6s ease, staggered on lists) and two subtle infinite drift loops on hero cards. A `motion: "full" | "reduced"` flag in the prototype disables list stagger delays — carry forward an equivalent reduced-motion affordance.

## State Management
State needed to reproduce this experience:
- `view`: `"idle" | "loading" | "results"` — drives which sections render.
- `logStep`: current index into the loading log lines (0–5).
- `vertical`: free-text string bound to the hero input (also settable via quick chips).
- `selectedAd`: index into the ranked ads ledger, drives the Nº1 sticky preview.
- `filter: { angle, format, hookType }`: independently-toggleable DNA filter selections (nullable per dimension).
- `budget`: string bound to the Nº3 budget input, parsed as a number for the waste estimate.
- `preflightSel`: id of the currently-selected pre-flight example/pasted ad.
- `platformSel`: map of brief-index → selected platform tab (`"meta" | "tiktok" | "native"`), independent per card.
- `copiedKey`: transient id of whichever copy button was last clicked (auto-clears after 1.4s) — drives the "COPIED ✓" label swap.
- `marksOn` + `countT`: one-shot flags/eased progress (0–1, cubic ease-out) for the Nº3 hand-drawn annotations and the N→K count-up, latched by the IntersectionObserver.
- Scroll-derived: overall scroll progress (0–1) and which of the four sections is "active", recomputed on scroll (throttled to animation frames).

**Data fetching**: In the real product, submitting a vertical should trigger a live pull of ad-library data for that vertical (Meta Ad Library primarily, TikTok Creative Center as a secondary source per the footer credit) plus a corresponding creative-DNA extraction and duplicate-cluster analysis of the user's own ad set. The prototype seeds this with static JSON (see Data/Assets below) for 4 pre-baked verticals and falls back to "live pull" for anything else, per the hero's "4 seeded, live pull for anything else" caption — the real implementation should replace the static seed with that live pipeline.

## Design Tokens

**Colors**
- Background (paper): `#F7F5F0`; secondary background wash: `#EFECE3`
- Ink (primary text): `#1C1917`
- Secondary text: `#6B655A`; muted/tertiary text: `#938D80`
- Body copy on light cards: `#443F35` / `#55503F` / `#333`
- Accent (brand — "hook orange"): `#C2410C`; hover: `#A33509`; button drop-shadow: `#8C2E08`; light tint: `rgba(194,65,12,0.05–0.08)`
- Positive/proof green: `#1F6F54`; light green bg: `#F0F6F1`; border: `#CFE0D5`
- Warning/duplicate amber: `#B45309`; fill: `#FBBF24`; light bg: `#FBF4E4`; border: `#E5C08F`
- Info blue (emotion tag): `#3E5C76`
- Borders (light UI): `#DED8CA`, `#E2DDD2`, `#E5E0D5`, `#EEE9DD`
- Ink-plate (Nº3 dark panel) gradient: `#232038 → #2B2647 → #221F36`; border `#3B3560`; text `#F2F0FA` / `#8B86A8`; violet gradient text `#A99AFF → #D3C6FF`; diagram accents `#4B4478` / `#57509A` / `#332D56`
- Card-specific advertiser-avatar palette (hashed per name): `#1F6F54, #C2410C, #7C6455, #3E5C76, #8C5E3C, #5B5E4A, #6E4A6B`

**Typography**
- Display/serif (headlines, italic emphasis, pull-quotes, big stat numbers): **Source Serif 4**, weights 400/600/700, italic used for emphasis words and quotes.
- UI/body sans: **IBM Plex Sans**, weights 400/500/600/700.
- Mono (labels, data, timestamps, kickers, log lines): **IBM Plex Mono**, weights 400/500/600.
- Scale in use: hero H1 ~52px/1.08; section stat numbers 72px; card titles 16px serif; body 12–15px; micro-labels 9–11px mono with `letter-spacing: 0.08–0.15em` caps.

**Radius**: buttons/inputs 6–8px; cards 7–11px; ink plate 16px; pills/chips 999px (full).

**Shadows**: brief/brutalist cards use an offset flat shadow `3px 3px 0 #E5E0D5` (hover: `5px 5px 0`, card nudges up-left 1px); floating preview card `0 14px 34px rgba(28,25,23,0.12)`; ink plate `0 18px 44px rgba(35,32,56,0.26)`; small lifted cards `0 6–12px 16–30px rgba(28,25,23,0.08–0.14)`.

**Motion**: entrance rise/fade ~0.4–0.6s ease (list items staggered ~0.05–0.09s apart); loading ripple ring 1.6s ease-out infinite (offset pair); blinking cursor 0.9s step-end; hero card drift loops 7–8s ease-in-out; SVG hand-drawn annotations stroke-draw 0.5–0.9s ease with staggered delays; count-up 1.2s cubic ease-out.

## Assets
- **Fonts**: Google Fonts — Source Serif 4, IBM Plex Sans, IBM Plex Mono (loaded via `<link>` in the prototype; use the codebase's existing font-loading approach).
- **Ad creative screenshots**: the hero collage and in-feed previews are *simulated* ad cards built from HTML/CSS + copy pulled from the seed data — not real screenshots. No image assets to hand off; if the production version pulls live ad-library data, real creative thumbnails (`coverUrl` field in the data) should replace these mocks where available.
- **Background texture**: a subtly-visible inline SVG fractal-noise "paper grain" overlay (`feTurbulence`) at low opacity across the whole page.
- **Icons**: a single custom fishhook mark (inline SVG path) used as the logo and as the scroll-progress indicator — no icon library.
- **Seed data**: `data/demo-data.js` (loaded as a global `window.ANGLER_DATA`) contains the full mock dataset driving every screen — the ranked ads list, per-ad creative-DNA tags, the sample user ad set + duplicate clustering + gap analysis, pre-flight examples, and the generated briefs. `data/weight-loss-supplement.json` and `data/weight-loss-redundant.json` are the raw source data this was derived from. Use these as a **shape reference** for the real API/data contract, not as production content.

## Files
- `Angler - Final.dc.html` — the full prototype (final design). All screens, states, and inline styling live here.
- `support.js` — the prototyping tool's template runtime. Reference only for understanding the markup's loop/conditional syntax (`<sc-for>`, `<sc-if>`); do not port.
- `data/demo-data.js`, `data/weight-loss-supplement.json`, `data/weight-loss-redundant.json` — seed/mock data, useful as a data-shape reference.
