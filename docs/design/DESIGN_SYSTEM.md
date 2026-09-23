# Nakshatra-X — Design System

The visual and behavioural contract for every screen. Nothing in the product
sets a colour, size, spacing, radius or animation that is not defined here.

- **Branch:** `design/foundation` · **Date:** 2026-09-23
- **Companion documents:** `DESIGN_AUDIT.md` (what was wrong), `IA.md` (structure)

---

## 1. Principles

1. **Instrument, not costume.** The interface should look futuristic because it
   is precise, dense and well-made — not because it glows. Every pixel that
   doesn't carry information is spent against the pixels that do.
2. **Ink is earned.** Emphasis is a finite budget. If everything is bright,
   nothing is. Default to the quietest treatment that works.
3. **A number is a claim.** No value renders without its provenance envelope.
   This is not a visual rule; it is the product's integrity contract, and the
   design serves it rather than working around it.
4. **Colour means something or it isn't used.** Hue is reserved for data
   semantics. Chrome is neutral.
5. **Motion reports change.** If nothing changed, nothing moves.
6. **Legible before beautiful; honest before impressive.**

---

## 2. References studied

Recorded honestly: only sources that actually loaded and returned substantive
content are listed as studied. Two did not, and are named as such.

| Reference | Loaded | What was taken from it |
|---|---|---|
| [NASA Open MCT — About](https://nasa.github.io/openmct/about-open-mct/) | yes | A mission-ops framework certified for ISS telemetry display at JSC and trialled at JPL for MSL/Curiosity. Confirms the target posture: one consolidated interface composing plots, tables, imagery and timelines; responsive across desktop and mobile; composition by direct manipulation rather than deep menus. **The page documents architecture, not visual design — it offers no colour, typography, density or alarm-indication guidance, so none is claimed from it.** |
| [NASA Worldview — Data Tool in Focus](https://www.earthdata.nasa.gov/news/feature-articles/data-tool-focus-nasa-worldview) | yes | A production satellite-imagery browser over 1,000+ layers. Layout: persistent left rail for layers, map as the whole canvas, **timeline pinned along the bottom**, keyboard arrows to step through time. Layer opacity, thresholds and palettes are user-adjustable rather than fixed. Directly informs our map screen and the treatment of time as a first-class axis. |
| [Optimizing colormaps with consideration for color vision deficiency (PLOS One, 2018)](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0199239) | yes | The evidentiary basis for our colormap choice. Perceptual uniformity means equal distances in CIECAM02-UCS correspond to equal perceived differences; jet/rainbow maps create false structure because bright yellow bands read as higher values regardless of the data. **cividis** is optimised so that viewers with and without colour vision deficiency interpret it near-identically. |
| [GOV.UK Design System — Colour](https://design-system.service.gov.uk/styles/colour/) | yes | The discipline model for a government service. Always use the palette; reference **functional colour variables, never raw hex**, so a global change is possible; colour is assigned to fixed functional purposes (error, success, focus) so interactions stay predictable; text and interactive elements must meet WCAG 2.2 AA (1.4.3). |
| NASA NTRS Open MCT paper (`20160006385`) | **no — fetch failed, "Socket is closed"** | Nothing. Not cited. |
| IBM Carbon — data-visualization colour palettes | **no — page returned truncated content** | Nothing. Not cited. |

**Synthesis.** Worldview gives the layout grammar (map as canvas, left rail,
time along the bottom). Open MCT gives the posture (one consolidated operational
surface). The PLOS paper settles the colormap on evidence rather than taste.
GOV.UK supplies the governance rule that makes the whole thing maintainable:
tokens, not hex.

---

## 3. Colour

### 3.1 Surfaces — near-neutral dark

A four-step neutral ramp with a slight cool cast. **Elevation is value contrast,
not shadow.** A raised element is a lighter surface, not a glowing one.

| Token | Hex | Use |
|---|---|---|
| `--surface-0` | `#0B0D10` | Page background |
| `--surface-1` | `#121519` | Panels, app bar, rails |
| `--surface-2` | `#181C21` | Cards, inputs, table headers |
| `--surface-3` | `#1F242A` | Hover, active row, popover |

### 3.2 Text

| Token | Hex | Use |
|---|---|---|
| `--text-primary` | `#E6E9EC` | Headings, values, body |
| `--text-secondary` | `#A2AAB3` | Supporting prose, labels |
| `--text-tertiary` | `#858D96` | Captions, metadata, units |

There is no fourth, dimmer text token. If text is too unimportant to meet AA,
it is too unimportant to render.

### 3.3 Accent — exactly one

| Token | Hex | Use |
|---|---|---|
| `--accent` | `#6AA5F0` | Links, selection, focus ring, the single primary action per view |

One accent, used sparingly. It is not a decoration and never a border colour for
ordinary containers. `#00FF88` and the other 118 hexes are gone.

### 3.4 Status — data semantics only

Status colour may **only** encode the state of a measured thing. It is never used
for emphasis, branding or decoration.

| Token | Hex | Meaning |
|---|---|---|
| `--status-nominal` | `#3FB98F` | Within expected range |
| `--status-caution` | `#E0A33E` | Approaching a threshold |
| `--status-critical` | `#F0684F` | Threshold breached |
| `--status-unknown` | `#858D96` | No data, stale, or degraded — **the default** |

**Colour is never the only channel.** Every status carries a text label and a
distinct icon shape. This is what makes the palette safe for colour vision
deficiency, and it is a hard rule, not a recommendation — hue alone fails for
roughly 4% of users and fails entirely in greyscale print.

`--status-unknown` being the default matters: a component with no data shows
"unknown", never "nominal". Absence of evidence is not evidence of health.

### 3.5 Sequential colormap — cividis

For the prospectivity surface, risk heat and every continuous quantity on the map.

Sampled from `matplotlib 3.11.2`'s `cividis` at nine equal stops:

| t | 0.000 | 0.125 | 0.250 | 0.375 | 0.500 | 0.625 | 0.750 | 0.875 | 1.000 |
|---|---|---|---|---|---|---|---|---|---|
| hex | `#00224E` | `#1A386F` | `#434E6C` | `#61656F` | `#7D7C78` | `#9B9476` | `#BCAE6C` | `#DEC958` | `#FEE838` |

Relative luminance is **strictly increasing** across the ramp
(0.0169 → 0.0420 → 0.0772 → 0.1300 → 0.2013 → 0.2946 → 0.4205 → 0.5801 → 0.7907),
so the map survives greyscale and reads monotonically for CVD viewers.

**No rainbow, no jet, ever.** Per the PLOS paper, rainbow maps invent structure
that is not in the data.

This colormap module is the **single documented exception** to the no-raw-hex
rule: a colormap is data, not theme, so its stops live as literals in one file
(`frontend/src/lib/colormap.ts`) and nowhere else.

### 3.6 Borders

| Token | Hex | Use | 3:1 required |
|---|---|---|---|
| `--border-subtle` | `#23282E` | Table rules, list dividers | no — decorative |
| `--border-default` | `#2E343B` | Card and panel edges | no — decorative |
| `--border-strong` | `#3D444C` | Section boundaries | no — decorative |
| `--border-interactive` | `#6A727B` | **Input, select, checkbox and button boundaries** | **yes** |

The split is deliberate. WCAG 2.2 §1.4.11 requires 3:1 for the visual boundary
of a control a user must perceive — not for a decorative divider. Conflating the
two either fails the audit or produces a grid of harsh lines. `--border-interactive`
meets the gate; the decorative rules stay quiet.

**All borders are 1px.** There are no 2px borders and no glows.

### 3.7 Verified contrast

Computed with the WCAG relative-luminance formula, not asserted:

```
token               surface-0  surface-1  surface-2  surface-3  gate   result
--------------------------------------------------------------------------------
text-primary        15.97      15.02      14.04      12.82      4.5    PASS
text-secondary       8.28       7.79       7.28       6.65      4.5    PASS
text-tertiary        5.79       5.45       5.09       4.65      4.5    PASS
accent               7.65       7.20       6.73       6.14      4.5    PASS
status-nominal       7.92       7.45       6.97       6.36      3.0    PASS
status-caution       8.78       8.26       7.73       7.05      3.0    PASS
status-critical      6.30       5.93       5.54       5.06      3.0    PASS
border-interactive   3.99       3.75       3.51       3.20      3.0    PASS
focus-ring           7.65       7.20       6.73       6.14      3.0    PASS
```

Every foreground token clears its gate **against all four surfaces**, so no
combination in the system can produce a failure. The status colours clear 4.5
as well, so they are safe as text, not only as marks.

### 3.8 Elevation

There are no glow shadows. Depth is surface value plus a 1px border. Exactly one
shadow token exists, for true overlays that float above the page:

```css
--shadow-overlay: 0 8px 24px rgb(0 0 0 / 0.40);
```

Used by modals and popovers only. Nothing else casts a shadow.

---

## 4. Typography

### 4.1 Families

| Role | Family | Loaded via |
|---|---|---|
| Sans (UI, prose) | **Inter** — neo-grotesque, excellent at small sizes, true tabular figures | `next/font/google`, `display: swap`, subset `latin` |
| Mono (data, IDs, code) | **IBM Plex Mono** | `next/font/google` |

Two families. `font-3d-cyber`, `font-space` and the `font-sans`/`font-inter`
duplication are removed. Both load through `next/font` so metrics are known at
build time and there is no layout shift.

### 4.2 Scale — 7 steps

| Token | Size / line-height | Use |
|---|---|---|
| `--text-xs` | 12 / 16 | Table metadata, units, footnotes |
| `--text-sm` | 13 / 20 | Dense table cells, secondary body |
| `--text-base` | 15 / 24 | **Body default** |
| `--text-lg` | 18 / 28 | Lead paragraph, card title |
| `--text-xl` | 22 / 30 | Section heading |
| `--text-2xl` | 28 / 36 | Page title |
| `--text-3xl` | 36 / 44 | Hero |

Plus one restricted step:

| `--text-label` | 11 / 16, uppercase, `letter-spacing: 0.08em`, `font-weight: 500` |

`--text-label` is permitted **only** for short eyebrow labels of one to three
words. It is never used for sentences. Nothing else in the product renders below
12px — the 10px and 11px body text found in the audit (T-2) is gone.

### 4.3 Numerals

```css
.num, td, th, [data-metric] { font-variant-numeric: tabular-nums; }
```

**Every number in the product is set in tabular figures.** Columns align, and a
value does not shift horizontally when it changes. For a forecasting product
this is correctness of presentation, not polish.

### 4.4 Case and weight

- Sentence case for all prose, headings and buttons.
- `uppercase` only on `--text-label`.
- Weights: 400 body, 500 labels and emphasis, 600 headings. No 700+, no
  `font-black`.
- No letter-spacing on body text. No `drop-shadow` on text, ever.

---

## 5. Spacing, radii, layout

### 5.1 Spacing — 8px base

| Token | px | | Token | px |
|---|---|---|---|---|
| `--space-1` | 4 | | `--space-5` | 24 |
| `--space-2` | 8 | | `--space-6` | 32 |
| `--space-3` | 12 | | `--space-7` | 48 |
| `--space-4` | 16 | | `--space-8` | 64 |

4px exists as a half-step for tight pairings (icon↔label). Every other value is
a multiple of 8.

### 5.2 Radii — minimal

| Token | px | Use |
|---|---|---|
| `--radius-sm` | 2 | Badges, tags, inputs |
| `--radius-md` | 4 | Cards, buttons, panels |
| `--radius-lg` | 6 | Modals |
| `--radius-full` | 9999 | **Only** genuinely circular objects — avatars, status dots |

Pill-shaped buttons and capsules are gone. `--radius-full` on a text container
is what made the old UI read as consumer-casual.

### 5.3 Layout

- Content max-width **1280px**; prose measure capped at **72ch**.
- Gutters: 16px at 375, 24px at 768, 32px at ≥1280.
- Breakpoints: `sm 640 · md 768 · lg 1024 · xl 1280`.
- **Content wraps; it never clips.** No `whitespace-nowrap` on prose, and no
  ancestor `overflow-hidden` that could hide content the user cannot scroll to
  (audit R-1). Horizontal scroll is a bug at every width.

---

## 6. Interaction states

| State | Treatment |
|---|---|
| Hover | Surface steps up one level (`surface-2` → `surface-3`). No colour change, no scale, no glow. |
| Focus | `outline: 2px solid var(--accent); outline-offset: 2px;` — **always visible, never removed**. |
| Active / press | Surface steps down one level. No transform. |
| Selected | 1px `--accent` left border + `surface-3`. |
| Disabled | `opacity: 0.45`, `cursor: not-allowed`, and `aria-disabled`. |
| Loading | Skeleton at `surface-2`, or a determinate bar. Never a spinner over existing content. |

`:focus-visible` is styled for keyboard users; the ring is never suppressed for
mouse users on controls where it aids orientation. The native cursor is restored
— `CustomCursor.tsx` is removed.

---

## 7. Motion policy

**Default state: nothing moves.** Motion is added only where it reports a change
the user caused or needs to notice.

### 7.1 Permitted

| Purpose | Duration | Easing |
|---|---|---|
| Hover / focus / press feedback | ≤ **150ms** | `ease-out` |
| Disclosure — accordion, popover, drawer, tooltip | ≤ **200ms** | `ease-out`, **no bounce, no overshoot** |
| Loading indication — skeleton shimmer, determinate progress | continuous while genuinely pending | linear |
| Map pan / zoom | user-driven | native to the map library |

Only these four. Transitions name their properties explicitly —
`transition: background-color 120ms ease-out` — never `transition-all`.

### 7.2 Banned outright

| Banned | Why |
|---|---|
| Parallax | decorative depth, motion-sickness trigger |
| Scroll-jacking | takes control of the user's scroll |
| Scroll-scrubbed video | both of the above, at 145 MB |
| Particle / dust fields | perpetual work, zero information, masks real change |
| Pulsing or breathing glows | spends the alarm channel on decoration |
| Typewriter / scramble / decode text | delays legibility, disrupts screen readers |
| **Count-up numbers** | displays values that were never measured — an integrity violation, not only a motion one |
| Auto-rotation, auto-carousels | movement the user did not ask for |
| Marquees / tickers | decorative "liveness" |
| Glitch effects | simulates malfunction in a tool whose job is trust |
| Staggered entrance animation | delays content to choreograph it |
| `transition-all` | transitions layout properties; the source of the jitter |
| Transform on hover (`scale`, `translate`) | reflow-adjacent jitter, no information |

### 7.3 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Global, in the base layer. Every non-essential animation stops. Determinate
progress remains, because it reports real state rather than decorating.

This fixes audit M-1: the current codebase honours `prefers-reduced-motion` in
**zero** places across 105 animations and 7 rAF loops.

### 7.4 Motion inventory

Every animation that survives, enumerated. Anything not on this list is a defect.

| # | Where | What | Duration | Trigger | Reduced-motion |
|---|---|---|---|---|---|
| 1 | Buttons, links, rows, tabs | `background-color` / `border-color` | 120ms ease-out | hover / focus / active | disabled |
| 2 | Accordion, drawer, popover, tooltip | `height` / `opacity` | 180ms ease-out | user disclosure | disabled |
| 3 | Skeleton loader | opacity shimmer | 1.2s linear, loop | data pending | disabled — static skeleton |
| 4 | Determinate progress | `width` | tracks real progress | export / long job | **kept** — reports real state |
| 5 | Leaflet map | pan / zoom | library default | user drag / scroll | library default |
| 6 | Focus ring | none — appears instantly | 0ms | keyboard focus | n/a |

Six entries, down from 105 `animate-*` usages, 20 `@keyframes`, 161
`transition-all` and 7 rAF loops.

---

## 8. Charts — Recharts theme

Recharts stays (6 existing imports; no new charting dependency).

| Element | Treatment |
|---|---|
| Grid | `--border-subtle`, horizontal lines only, 1px |
| Axes | `--text-tertiary`, 12px, no axis line, ticks outside |
| Axis labels | `--text-secondary`, `--text-xs` |
| Series (single) | `--accent` |
| Series (categorical) | cividis at evenly spaced stops — never arbitrary hues |
| Prediction interval | `--accent` at 16% opacity, no border |
| Median / point forecast | `--accent`, 2px |
| Baseline / comparison | `--text-tertiary`, 1px, dashed |
| Threshold line | `--status-caution` or `--status-critical`, 1px dashed, **always labelled in text** |
| Tooltip | `surface-3`, 1px `--border-default`, `--radius-md`, tabular numerals |
| Empty state | "No data" in `--text-tertiary` — never a zero-line implying a measured zero |
| Animation | **off** (`isAnimationActive={false}`) — chart entrance animation is a count-up by another name |

Uncertainty is always drawn. A point forecast never renders without its interval;
a chart that cannot show its interval shows an explicit note instead.

---

## 9. Map styling

Following the Worldview grammar: map as canvas, controls in a rail, time along
the bottom.

| Element | Treatment |
|---|---|
| Base layer | Desaturated dark raster. No saturated overlay on imagery (audit C-6). |
| Data surface | cividis, opacity user-adjustable, **legend always visible** with units and range |
| Mine markers | 6px circle, `--text-primary` fill, 1px `--surface-0` outline |
| Selected marker | `--accent` fill, 8px |
| Status markers | status token fill **plus** distinct shape — circle nominal, triangle caution, square critical |
| Labels | `--text-xs`, `--text-primary`, 1px `--surface-0` halo — **halo, not drop-shadow stack** |
| Controls | `surface-1`, `--border-default`, top-left rail |
| Attribution | `--text-tertiary`, `--text-xs`, always present |

Every data layer states its source, vintage and whether it is synthetic, drawn
from the provenance envelope — never from a hardcoded string.

---

## 10. The provenance rule

`frontend/src/components/console/Evidence.tsx` already enforces the contract:
`Metric` renders "unavailable" rather than a bare number, and flags a value that
arrives without an envelope as a PRD N-3 violation.

**This system extends that rule to every screen it touches. It is never weakened.**

| Rule | Consequence |
|---|---|
| A number renders only with `{value, unit, source, source_kind, vintage, model_version, uncertainty, is_synthetic, is_live}` | no envelope → no number |
| `is_live` and `is_synthetic` are **computed** from `source_kind` | a caller cannot mislabel synthetic data as live |
| "Live", "active", "streaming" are rendered **from the envelope, never as literals** | the six hardcoded badges in the audit are removed |
| Synthetic data carries a visible `Synthetic` marker and is never styled as live | no green dot, no pulse |
| Stale or missing data shows `--status-unknown` and states the staleness | guardrail (d) |
| A forecast shows its interval, or states that it cannot | uncertainty is not optional |

**No new "live" indicator may be added to any screen by this redesign.** The
redesign only removes false ones.

---

## 11. Implementation

### 11.1 Tokens

Single source of truth: `frontend/src/app/tokens.css`, CSS custom properties on
`:root`, exposed to Tailwind 4 via `@theme`:

```css
@import "tailwindcss";

:root {
  --surface-0: #0B0D10;
  /* … all tokens … */
}

@theme inline {
  --color-surface-0: var(--surface-0);
  --color-text-primary: var(--text-primary);
  --color-accent: var(--accent);
  --spacing-1: var(--space-1);
  --radius-md: var(--radius-md);
  /* … */
}
```

Components then use `bg-surface-1`, `text-secondary`, `border-default` — never a
hex, never an arbitrary value.

### 11.2 Primitives

`frontend/src/components/ui/`, replacing the three parallel vocabularies:

`Button` · `Card` · `Badge` · `Field` (label + input + hint + error) ·
`Select` · `Table` · `Tabs` · `Dialog` · `Tooltip` · `Skeleton` ·
`EmptyState` · `StatusDot` (colour **+** shape **+** label) ·
`Metric` (re-exported from `Evidence.tsx` — the provenance gate stays where it is)

### 11.3 Enforced

| Gate | Rule |
|---|---|
| No raw colour | zero `#hex`, `rgb()`, `hsl()` outside `tokens.css` — sole exception `lib/colormap.ts` |
| No arbitrary colour | zero `text-[#…]`, `bg-[#…]`, `border-[#…]` |
| No banned motion | greps for `transition-all`, `animate-pulse`, `animate-ping`, `animate-bounce`, particles, count-ups return zero, or the hit is in the §7.4 inventory |
| Contrast | every pair computed, AA or better |
| Focus | every interactive element has a visible ring |
| Reduced motion | the global block is present |
| Provenance | every rendered number passes through `Metric` |

Each gate is evidenced with pasted output in the PR.

---

## 12. Removed

Deleted by this system, each with its audit reference:

| Removed | Reference |
|---|---|
| `ScrollVideo.tsx` + 788 frames (145 MB) | §4.1 |
| `CustomCursor.tsx` | M-7 |
| `SpaceDustParticles.tsx` | §4.3 |
| `globe/IndiaMineGlobe.tsx` (orphan) | §4.2 |
| `mission-control/IndiaCommandGlobe.tsx` | §4.3 |
| `ui/hyper-text.tsx`, `ui/text-effect.tsx` | M-6 |
| `ui/animated-generate-button-*.tsx` | component table |
| Count-up in `StatsSection.tsx` | M-9 |
| Six hardcoded LIVE/ACTIVE/STREAMING labels | §7 of the audit |
| Dependencies: `three`, `react-globe.gl`, `cesium`, `@types/cesium`, `@reactflow/{background,controls,core,minimap}`, `framer-motion` | §8 of the audit |

Each dependency removal is recorded in `docs/DECISIONS.md` with its one-line
justification. **No capability is removed — only decoration, dead code and false
claims.** Every route keeps its function; the map, the console, the exports,
auth, admin and the `docs/DEMO.md` journey all survive.
