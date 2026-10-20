# Nakshatra-X — Design System

The visual and behavioural contract for every screen. Nothing in the product
sets a colour, size, spacing, radius or animation that is not defined here.

- **Branch:** `design/foundation` · **Date:** 2026-09-23
- **Revised:** 2026-10-18 — re-skinned on the owner-approved design reference
  (`churn-design-system.html`, mapped in `docs/ui-redesign/design-system-mapping.md`):
  warm-neutral light surfaces, dark "instrument" chrome for the map, Geist /
  Hanken Grotesk / Geist Mono, nested radii, flat elevation. Principles (§1),
  the provenance rule (§10) and the motion bans (§7.2) are unchanged in
  substance; §3-§7 record the new values and every deliberate amendment.
- **Revised:** 2026-10-20 — colour restored inside content, as the reference
  directs (rule 3: "brights appear in media, block previews and one accent per
  view"). Every chart now sits in a dark data well and takes its series colour
  from the reference brights by role (§3.9, §8); source-kind tags are bright
  fills with ink on them (§3.9). Chrome — navigation, buttons, segmented
  controls — stays monochrome, as the reference requires.
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

Values live in `frontend/src/app/tokens.css`; each is quoted from the design
reference or is a documented extension (`design-system-mapping.md` §5). The
token *names* are unchanged from the previous system, so components did not
need new vocabulary.

### 3.1 Surfaces — warm-neutral light, plus dark chrome

**Elevation is a tone step, not a shadow** (reference rule 5).

| Token | Light | Dark chrome | Use |
|---|---|---|---|
| `--surface-0` | `#FAFAFA` | `#0F0F0F` | Page (`--bg`) |
| `--surface-1` | `#F7F7F7` | `#151515` | Cards, panels, card headers (`--bg-alt`) |
| `--surface-2` | `#EDEDED` | `#1E1E1E` | Wells, inputs on cards, feature cards (`--surface`) |
| `--surface-3` | `#E2E2E2` | `#2E2E2E` | Hover, active, chips (`--surface-2`) |
| `--surface-black` | `#0F0F0F` | `#0A0909` | Dark media wells only |

**Dark chrome** (`.chrome-dark`) is the reference's editor chrome, "dark in both
themes". It redefines every semantic token for its subtree and is used where the
content needs a dark ground: the satellite map card (imagery, cividis, status
markers) and the landing page's data media well. Nowhere else.

### 3.2 Text — ink, by alpha

| Token | Light | Dark chrome | Use |
|---|---|---|---|
| `--text-primary` | `#0F0F0F` | `#FAFAFA` | Headings, values, body |
| `--text-secondary` | ink 70% | `#B6B6B6` | Supporting prose, labels, eyebrows |
| `--text-tertiary` | ink 60% | paper 56% | Captions, metadata, units |

Hierarchy by alpha, not new greys (reference rule 2). The reference's 50 / 40 /
30% steps fail AA on light surfaces (3.36 / 2.53 / ~1.9:1 worst), so they are
raised to the lowest alphas that pass on every surface. There is still no
dimmer text token: text too unimportant to meet AA is too unimportant to render.

### 3.3 Accent — ink on light, mint in chrome; mint once per view

| Token | Light | Dark chrome | Use |
|---|---|---|---|
| `--accent` | `#1E1E1E` | `#00FFD0` | Links, selection, focus ring, the single primary action |
| `--accent-muted` | `#D7FBF4` | `#12362F` | Selected fills, text selection |
| `--highlight` / `--highlight-fg` | `#00FFD0` / `#0F0F0F` | — | **The one mint accent per view**, as a fill with ink on it |
| `--inverse-bg` / `--inverse-fg` / `--inverse-hover` | `#1E1E1E` / `#FAFAFA` / `#3C3C3C` | swapped | Primary buttons, toasts |

Mint is 1.24:1 on `#FAFAFA` and can never be text there. On light, `accent` is
the reference's inverse ink, so chrome stays monochrome (reference rule 3:
"brights … never on chrome"). As an accent, mint appears once per view as a
fill — the console's focal answer — and as the accent inside dark chrome.
Inside content it is also the model's data colour and the DERIVED tag's fill
(§3.9); those are content, which the reference colours. Links in prose are underlined (`.prose-link`), because an
ink link in ink text is distinguished by colour alone otherwise.

### 3.4 Status — data semantics only

Status colour may **only** encode the state of a measured thing. It is never
used for emphasis, branding or decoration — including as a series colour.

| Token | Light | Dark chrome | Meaning |
|---|---|---|---|
| `--status-nominal` | `#2F6B1C` | `#63AD45` | Within expected range |
| `--status-caution` | `#735C00` | `#E9D352` | Approaching a threshold |
| `--status-critical` | `#BD1A1A` | `#FF6B6B` | Threshold breached |
| `--status-unknown` | `#5E5E5E` | `#9A9A9A` | No data, stale, or degraded — **the default** |

Light values are the reference's green, yellow and red darkened along their own
hue until they pass 4.5:1 as text on every surface; dark-chrome values are the
reference's own, with red lifted (it measured 3.73:1 on `#2E2E2E`).

**Colour is never the only channel.** Every status carries a text label and a
distinct icon shape. This is what makes the palette safe for colour vision
deficiency, and it is a hard rule, not a recommendation.

### 3.5 Sequential colormap — cividis

For the prospectivity surface, risk heat and every continuous quantity on the map.

Sampled from `matplotlib 3.11.2`'s `cividis` at nine equal stops:

| t | 0.000 | 0.125 | 0.250 | 0.375 | 0.500 | 0.625 | 0.750 | 0.875 | 1.000 |
|---|---|---|---|---|---|---|---|---|---|
| hex | `#00224E` | `#1A386F` | `#434E6C` | `#61656F` | `#7D7C78` | `#9B9476` | `#BCAE6C` | `#DEC958` | `#FEE838` |

Relative luminance is **strictly increasing** across the ramp
(0.0169 → 0.0420 → 0.0772 → 0.1300 → 0.2013 → 0.2946 → 0.4205 → 0.5801 → 0.7907),
so the map survives greyscale and reads monotonically for CVD viewers. It is
drawn on dark chrome, which its pale end needs.

**No rainbow, no jet, ever.** Per the PLOS paper, rainbow maps invent structure
that is not in the data.

This colormap module is the **single documented exception** to the no-raw-hex
rule: a colormap is data, not theme, so its stops live as literals in one file
(`frontend/src/lib/colormap.ts`) and nowhere else.

### 3.6 Borders

| Token | Light | Dark chrome | Use | 3:1 required |
|---|---|---|---|---|
| `--border-subtle` / `--border-default` | ink 8% | paper 8% | Rules, card edges (`--line`) | no — decorative |
| `--border-strong` | ink 16% | paper 16% | Section boundaries, overlays (`--line-strong`) | no — decorative |
| `--border-interactive` | ink 50% | paper 42% | **Input, select and checkbox boundaries** | **yes** |

WCAG 2.2 §1.4.11 requires 3:1 for the visual boundary of a control a user must
perceive; the reference's `--line-strong` input border is 1.3:1, so controls use
ink at 50% (the reference's own `--fg-2`). Buttons are identified by their
label and fill and need no boundary. **All borders are 1px.**

### 3.7 Verified contrast

Computed with the WCAG relative-luminance formula, alpha tokens composited over
each surface (`design-system-mapping.md` §4.3):

```
light               surface-0  surface-1  surface-2  surface-3  gate   result
--------------------------------------------------------------------------------
text-primary        18.36      17.89      16.37      14.80      4.5    PASS
text-secondary       7.03       6.96       6.67       6.42      4.5    PASS
text-tertiary        4.96       4.90       4.76       4.64      4.5    PASS
accent (ink)        15.97      15.56      14.24      12.87      4.5    PASS
status-nominal       6.21       6.05       5.54       5.00      4.5    PASS
status-caution       6.17       6.01       5.50       4.97      4.5    PASS
status-critical      6.05       5.89       5.39       4.87      4.5    PASS
status-unknown       6.21       6.05       5.54       5.01      4.5    PASS
border-interactive   3.54       3.54       3.47       3.36      3.0    PASS

dark chrome         #0F0F0F    #151515    #1E1E1E    #2E2E2E    gate   result
--------------------------------------------------------------------------------
text-secondary       9.45       9.01       8.22       6.70      4.5    PASS
text-tertiary        6.24       6.10       5.85       5.19      4.5    PASS
accent (mint)       14.80      14.10      12.87      10.49      4.5    PASS
status (4)          ≥ 6.81     ≥ 6.49     ≥ 5.92     ≥ 4.83     4.5    PASS
border-interactive   3.98       3.96       3.88       3.63      3.0    PASS
```

`tools/status-labels.js` measures every rendered status label against both sets.

### 3.8 Elevation

**Deliberately flat.** No component casts a shadow: every Tailwind shadow step
resolves to nothing in `tokens.css`. Separation is a surface step plus a 1px
line; floating chrome (the app bar) uses an 18px backdrop blur over
`--nav-bg`. `--shadow-overlay` survives only as a name, now a 1px line ring.

### 3.9 Colour inside content — data colour and fills

The reference's brights (`--p-mint #00FFD0`, `--p-blue #4DC5E5`, `--p-pink
#F9ABFF`, `--p-yellow #E9D352`, `--p-green #63AD45`, `--p-red #FF3333`; the
Paper file names the same values butter, cyan, green, pink and red) belong
inside content, never on chrome. On the light page none of them reaches 3:1 as a
mark (mint 1.24, yellow 1.45, pink 1.64, blue 1.93, green 2.65; red 3.48 is the
only one that would pass), so the reference
shows them on a dark media ground (`.feature .media`, `.stage`). Two ways in:

**Data colour.** Every chart sits in a dark data well — `DATA_WELL` in
`primitives.tsx`, a `.chrome-dark` scope on `--ui-bg #151515` — and takes its
series colour by what the series *is*, never by its position:

| Token | Value | Role | On the well |
|---|---|---|---|
| `--data-model` | mint `#00FFD0` | The forecaster's own output: median, interval, feature importances | 14.10:1 |
| `--data-measured` | blue `#4DC5E5` | Observed inputs: rainfall | 9.07:1 |
| `--data-synthetic` | yellow `#E9D352` | A generated series: MineTwin's 50 years | 12.09:1 |
| `--data-illustrative` | pink `#F9ABFF` | An assumption-based continuation; always dashed | 10.69:1 |
| `--data-comparison` | ink-white at 56% | Baselines; dashed where it is a line | 6.10:1 |
| `--data-axis` / `--data-grid` | `#B6B6B6` / white at 8% | Ticks / gridlines | 9.01:1 / — |

Where two series share a chart they differ in more than hue: mint against a
neutral (lightness), solid against dashed (line style), or bar order with a
key. Thresholds keep the status colours, which `.chrome-dark` redefines for the
well. Track A's colormap (§3.5) is unchanged.

**Fills.** A bright as a fill with ink on it, the reference's `.tag.new`: a
tint on light surfaces, the full bright inside `.chrome-dark`. Used for the
source-kind tags (`SourceBadge`, the map legend, the blending result), keyed by
hue in `FILL` (`primitives.tsx`):

| Token | Light | Dark chrome | Used for | Ink on it |
|---|---|---|---|---|
| `--fill-green` | `#CBE1C2` (green 30%) | `#63AD45` | LIVE / MEASURED | 13.77 / 6.93 |
| `--fill-mint` | `#ADF9EB` (mint 30%) | `#00FFD0` | DERIVED | 16.00 / 14.80 |
| `--fill-yellow` | `#F1E9B5` (yellow 40%) | `#E9D352` | SYNTHETIC, cached tiles | 15.57 / 12.69 |
| `--on-fill` | `#0F0F0F` | `#0F0F0F` | The text on any fill | — |

REFERENCE is the neutral `.tag`; ASSUMPTION stays dashed and unfilled,
deliberately unlike the kinds that have a source. The word always names the
kind, so colour is never the only channel.

**Still monochrome:** the app bar and its active link, buttons, segmented
controls, inputs and focus on light surfaces — the reference's chrome. Mint as
selection appears where the reference puts it: the selected grade tile's fill,
and selection and focus inside dark chrome.

---

## 4. Typography

### 4.1 Families

| Role | Family | Loaded via |
|---|---|---|
| Primary (UI, prose, display) | **Geist** 400/500 | `next/font/google`, self-hosted, `display: swap` |
| Secondary (eyebrows, chrome labels) | **Hanken Grotesk** 400/500 | `next/font/google` |
| Mono (figures, IDs, code) | **Geist Mono** 400/500 | `next/font/google` |

The reference's primary and secondary faces, DieGrotesk and ABC Diatype, are
licensed and are **not used or named**; these are the web fallbacks the
reference itself declares (all SIL OFL). Inter, Sora and IBM Plex Mono are
removed. `npm run test:fonts` asserts each face is loaded, applied, and served
from this origin.

### 4.2 Scale

| Token | Size / line-height | Reference role |
|---|---|---|
| `--text-xs` | 12 / 16 | Eyebrow, code, table metadata |
| `--text-sm` | 13 / 20 | Caption, dense table cells |
| `--text-base` | 16 / 24 | **Interface and body default** |
| `--text-lg` | 18 / 27 | Body on narrative pages |
| `--text-xl` | 20 / 24 | Lead |
| `--text-2xl` | 26 / 30 | Heading 2, small |
| `--text-3xl` | 32 / 36 | Heading 2 / 3 |
| `--text-4xl` | 40 / 44, −0.01em | Display, small |
| `--text-5xl` | 56 / 61, −0.01em | Display |

Role utilities with the reference's exact values: `.t-display`, `.t-h2`
(0.9 leading), `.t-h2-wrap` (1.05, for headings that wrap), `.t-h3`, `.t-lead`,
`.t-caption`, `.t-code`. Tracking belongs to roles, not sizes: +0.044em on
buttons, nav, tags, inputs and captions; +0.036em on eyebrows; none on body
text and figures.

`.label` (the eyebrow) is Hanken Grotesk 12/16, +0.036em, **sentence case**, in
`--text-secondary` — the reference's `.t-eyebrow`, kept at the secondary ink for
projector legibility (`POLISH_AUDIT.md` issue 4) and at a 16px line so the
console's reserved heights hold.

### 4.3 Numerals

```css
.num, td, th, [data-metric] { font-variant-numeric: tabular-nums; }
```

**Every number in the product is set in tabular figures.** Columns align, and a
value does not shift horizontally when it changes.

### 4.4 Case and weight

- Sentence case for prose, headings, buttons and eyebrows.
- `uppercase` survives only on provenance badges (`LIVE`, `SYNTHETIC`, …) and
  status words, which are written that way in the source.
- **One weight.** 400 everywhere; 500 is the ceiling (the wordmark, and the few
  dense-table emphases that used `font-semibold`/`font-bold`, which resolve to
  500). Nothing renders at 600 or 700. Emphasis is size or ink, not weight.
- No `drop-shadow` on text, ever. Map labels get a 2px dark halo, not a glow.

---

## 5. Spacing, radii, layout

### 5.1 Spacing — 4px base

Tailwind's 4px scale, identical to the reference's `--s-1 … --s-32`
(4, 8, 12, 16, 20, 24, 32, 40, 64, 96, 128). Narrative sections are spaced at
96-112px; product sections at 24-32px.

### 5.2 Radii — nested

| Token | px | Use |
|---|---|---|
| `--radius-xs` | 4 | Small marks |
| `--radius-sm` | 5 | Tags, badges, small buttons, segment chips |
| `--radius-md` | 8 | Buttons, inputs, controls |
| `--radius-tile` | 11 | Metric tiles, wells, popups |
| `--radius-lg` | 16 | The floating app bar, menus |
| `--radius-xl` | 20 | Cards |
| `--radius-2xl` | 22 | The map card, dialogs |
| `--radius-3xl` | 32 | Feature cards |
| `--radius-pill` | 64 | Switches, pill tags |

Reference rule 6: bigger container, bigger radius; inner radius = outer −
padding. `rounded-full` remains for genuinely circular objects.

### 5.3 Layout

- Content max-width **1280px** on product routes (their measured layouts and
  layout-shift reservations were built against it); **1200px** on narrative
  pages (the reference's column). Prose measure capped at **72ch**.
- Gutters: 16px at 375, 24px at 768, 32px at ≥1024.
- Breakpoints: `sm 640 · md 768 · lg 1024 · xl 1280`.
- **Content wraps; it never clips.** Horizontal scroll is a bug at every width.
- The app bar floats: 56px tall in total below `md` (the console's sticky
  mobile rows are offset against it), 68px from `md`.

---

## 6. Interaction states

| State | Treatment |
|---|---|
| Hover | One surface step (`surface-2` → `surface-3`), or ink → charcoal on a primary button. No glow. |
| Focus | `outline: 2px solid var(--focus); outline-offset: 3px` — ink on light, mint in dark chrome. **Always visible, never removed.** Fields without their own outline (the prompt bar's input) draw it on their container. |
| Active / press | Buttons scale to 0.97 over 180ms (reference `.btn:active`). Transform only; nothing around them moves. |
| Selected | Segmented controls: a paper chip on the grey track with a 1px line. Layer rows in dark chrome: mint edge on `accent-muted`. Always carried by `aria-pressed` / `aria-current` too. |
| Disabled | `opacity: 0.35`, `cursor: not-allowed`, and `disabled` / `aria-disabled`. |
| Loading | Skeleton at `surface-3`, or a determinate bar. Never a spinner over existing content. |

---

## 7. Motion policy

**Default state: nothing moves.** Motion is added only where it reports a change
the user caused or needs to notice — and, on the landing page alone, a short
one-time settle that the owner approved on 2026-10-18 as a *selective* update,
not a licence to animate.

Curves and durations are the design reference's: `--ease-out`
`cubic-bezier(.2,.715,.205,.99)` (default), `--ease-in-out`
`cubic-bezier(.835,.12,.225,.77)`, and 180 / 360 / 700ms. GSAP uses the same
curves through `CustomEase` (`frontend/src/lib/motion.ts`).

### 7.1 Permitted

| Purpose | Duration | Easing | Where |
|---|---|---|---|
| Hover / focus colour feedback | **180ms** | `ease-out` | everywhere |
| Press feedback: scale 0.97 | 180ms | `ease-out` | buttons |
| Disclosure — menu, drawer, accordion, panel arriving | **180ms** | `ease-out`, no bounce, no overshoot | everywhere |
| Loading indication — skeleton shimmer, determinate progress | while genuinely pending | linear | everywhere |
| Map pan / zoom | user-driven | native to the map library | map |
| Hero settle: each line fades and rises 14px, once | 700ms, 60ms apart, all done < 0.9s | `ease-out` | **landing page only** (CSS) |
| Section settle as it is reached: fade and rise 16px, once | 700ms, 60ms apart | `ease-out` | **landing page only** (GSAP, `<Reveal>`) |
| Text roll on hover (label swaps for an identical copy) | 360ms | `ease-out` | **landing calls to action only** |
| Arrow lift on hover (↗ moves 2px) | 180ms | `ease-out` | arrow links |
| Layer-stack separation, scroll-linked | scrub | none | landing Track A figure (GSAP ScrollTrigger) |

Product routes (everything but `/`) are held to **≤ 300ms, no loops, no
transition on a layout property** by `tools/e2e-motion.js`. Transitions name
their properties — `transition-[background-color,color,scale]` — never
`transition-all`.

What the landing allowances may never do, each asserted by `test:motion`:
- **hide content** — everything is server-rendered at full opacity; a section
  already on screen when scripts run is not animated, and the start state is
  applied only when its trigger fires (`immediateRender: false`);
- **delay reading** — the hero is fully opaque within 1.2s of load;
- **move layout** — opacity and transform only;
- **repeat** — every one fires once;
- **run under reduced motion** — all of it is off, and the page is complete.

### 7.2 Banned outright

| Banned | Why |
|---|---|
| Parallax | decorative depth, motion-sickness trigger |
| Scroll-jacking, smooth-scroll shims | takes control of the user's scroll |
| Scroll-scrubbed video | both of the above, at 145 MB |
| Particle / dust fields, generative canvases | perpetual work, zero information, masks real change |
| Pulsing or breathing glows | spends the alarm channel on decoration |
| Typewriter / scramble / decode text | delays legibility, disrupts screen readers |
| **Count-up numbers** | displays values that were never measured — an integrity violation, not only a motion one |
| Auto-rotation, auto-carousels, spinning decoration | movement the user did not ask for |
| Marquees / tickers | decorative "liveness" |
| Glitch effects | simulates malfunction in a tool whose job is trust |
| Any infinite decorative animation | the reference's own demo loops (easing track, wordmark sheen, wave canvas) included |
| Staggered entrance on **product** routes | delays data to choreograph it *(amended: permitted on the landing page, §7.1)* |
| `transition-all` | transitions layout properties; the source of the jitter |
| Transform on hover (`scale`, `translate`) of a card, row or control | reflow-adjacent jitter, no information *(amended: the landing text roll and the 2px arrow lift, §7.1, move only a glyph inside a fixed box)* |

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

Global, in the base layer, plus explicit `animation: none` for `.hero-enter`,
`.panel-enter` and `.resolve-once` and no roll or arrow transforms. GSAP effects
are registered inside `gsap.matchMedia('(prefers-reduced-motion: no-preference)')`
and are reverted on unmount. Determinate progress remains, because it reports
real state rather than decorating.

### 7.4 Motion inventory

Every animation that survives, enumerated. Anything not on this list is a defect.

| # | Where | What | Duration | Trigger | Reduced-motion |
|---|---|---|---|---|---|
| 1 | Buttons, links, rows, tabs, chips | `background-color` / `color` / `border-color` | 180ms ease-out | hover / focus | disabled |
| 2 | Buttons | `scale` 0.97 | 180ms ease-out | press | disabled |
| 3 | Menus, drawers, accordions, arriving panels | `opacity` / `transform` | 180ms ease-out | user disclosure | disabled |
| 4 | Skeleton loader | opacity shimmer | 1.2s linear, loop | data pending | static skeleton |
| 5 | Determinate progress | `width` | tracks real progress | export / long job | **kept** — reports real state |
| 6 | Leaflet map | pan / zoom | library default | user drag / scroll | library default |
| 7 | Focus ring | none — appears instantly | 0ms | keyboard focus | n/a |
| 8 | Landing hero | `opacity` + `transform`, once | 700ms, 60ms stagger | page load | none |
| 9 | Landing sections | `opacity` + `transform`, once | 700ms, 60ms stagger | scrolled into view | none |
| 10 | Landing calls to action | label roll, `transform` | 360ms | hover | none |
| 11 | Arrow links | arrow `transform` 2px | 180ms | hover | none |
| 12 | Landing Track A figure | layer `transform` / `opacity` | scroll-linked | scroll | static, separated |
| 13 | Map point scored | one-shot `background-color` fade | 900ms | a click resolves | none |

---

## 8. Charts — Recharts theme

Recharts stays (no new charting dependency). Shared values live in
`frontend/src/lib/chart-theme.ts`; colours are the data roles in §3.9.

| Element | Treatment |
|---|---|
| Ground | A dark data well (`DATA_WELL`): `--radius-xl` when the well is the card, `--radius-tile` when nested in one |
| Grid | `--data-grid`, horizontal lines only, 1px |
| Axes | `--data-axis`, 12–13px, no axis line, no tick marks; every category labelled |
| Series | By role (§3.9): model mint, measured blue, synthetic yellow, illustrative pink dashed, comparison neutral dashed |
| Series (categorical, more than the roles) | cividis at evenly spaced stops — never arbitrary hues, never status colours |
| Prediction interval | `--data-model` at 16% fill, its p10 / p90 edges drawn as 1px lines at 60% |
| Median / point forecast | `--data-model`, 2.5px |
| Baseline / comparison | `--data-comparison`, 1.5px, dashed |
| Threshold line | `--status-caution` or `--status-critical` (dark-chrome values), 1px dashed, **always explained in text** |
| Key | Inside the well: the marks themselves (fill, line, dash) with a word each |
| Tooltip | `surface-0` of the well, 1px `--border-strong`, `--radius-md`, tabular numerals; hover column `--data-grid` |
| Hand-drawn SVG charts | Same roles; strokes `vector-effect: non-scaling-stroke` where the SVG stretches; tick text in HTML at the type scale |
| Print | `.chrome-dark` prints its ground (`print-color-adjust: exact`), so a chart never prints light text on white |
| Empty state | "No data" in `--text-tertiary` — never a zero-line implying a measured zero |
| Animation | **off** (`isAnimationActive={false}`) — chart entrance animation is a count-up by another name |

Uncertainty is always drawn. A point forecast never renders without its interval;
a chart that cannot show its interval shows an explicit note instead.

---

## 9. Map styling

Following the Worldview grammar: map as canvas, controls in a rail, time along
the bottom. The whole map card is dark chrome (`.chrome-dark`, §3.1), framed at
`--radius-2xl`; token colours handed to Leaflet are resolved against the map's
own element, so they are the dark-chrome values.

| Element | Treatment |
|---|---|
| Base layer | Desaturated dark raster. No saturated overlay on imagery (audit C-6). |
| Data surface | cividis, opacity user-adjustable, **legend always visible** with units and range |
| Mine markers | 10px circle (14px selected), 2px `--text-primary` ring, 1px `--surface-black` halo |
| Selected layer / hotspot | mint `--accent` edge on `--accent-muted` (layers); the marker's own colour as fill (hotspots) |
| Status markers | status token fill **plus** distinct shape — circle nominal, triangle caution, square critical |
| Labels | 10.5px mono, weight 500, 2px `--surface-black` halo — **halo, not glow** |
| Controls | `surface-2`, `--border-strong`, `--radius-md` |
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

Single source of truth: `frontend/src/app/tokens.css`. Tailwind 4 reads the
`@theme` block and emits each token as a custom property on `:root`, used as
`bg-surface-1`, `text-text-secondary`, `rounded-xl` or `var(--color-accent)`.
`.chrome-dark` redefines the same properties for its subtree. Components use
tokens — never a hex, never an arbitrary colour.

### 11.2 Primitives

`frontend/src/components/ui/primitives.tsx` — each the reference component of
the same job (`design-system-mapping.md` §4.6):

`Button` / `buttonClass` (primary, secondary, ghost, accent; sm, md, lg, icon) ·
`RollLabel` · `Card` / `CardHeader` / `CardBody` · `Tag` · `Badge` ·
`StatusDot` / `StatusLabel` (colour **+** shape **+** label) · `Segmented` ·
`Switch` · `Field` / `INPUT_CLASS` · `Skeleton` · `EmptyState` · `PageHeader` ·
`Section` · `MineSwitcher` · `PageNav` · `DATA_WELL` (every chart's ground) ·
`FILL` (bright tag fills) · `Metric` (in `console/Evidence.tsx` — the provenance
gate stays where it is). Chart values: `lib/chart-theme.ts`.

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
