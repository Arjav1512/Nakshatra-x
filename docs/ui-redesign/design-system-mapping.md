# Design reference → Nakshatra-X mapping

| | |
|---|---|
| Reference | `churn-design-system.html`, supplied by the owner on 2026-10-18 as the approved design reference |
| Reference identity | Title "Churn Design System", v1.0, "Extracted from butter.video · Oct 2026"; 778 lines, 58,513 bytes, SHA-256 `6665ef69d1bd71ae4118dd2b5553e454b3b97a37092cebe1a3a354328f4fd65c` |
| What was inspected | The whole file: the `:root` and dark-theme custom properties, every CSS rule (lines 1-314), all markup (316-660) and the inline script (662-777), including the token-export block |
| Not used | The Paper document via MCP (no calls were made for this), "XAI — Website & Design System" (never opened), any other design system |
| Reference copy | Kept unchanged, outside the repository and outside any publicly served directory |

**Status: Phase 1 complete.** Sections 1-3 are the reference's own values,
quoted. Section 4 maps them to this product. Section 5 lists every deliberate
deviation, with its reason. Nothing in §1-§3 was guessed or taken from a
screenshot.

---

## 0. Source notes

### 0.1 What the reference is

A one-page reference sheet for a light, monochrome marketing site with a dark
"editor chrome" for its product UI: *"Light = marketing site, dark = editor
chrome"* (line 7). Its stated thesis: *"A monochrome system: one regular
weight, near-black ink on warm-neutral greys, soft radii, and colour that only
shows up inside the work."*

It is built for a video editor. Its product content (blocks, templates,
timelines, exports, the Churn wordmark, the logo strip, the generative wave
canvas) is **not** carried into Nakshatra-X. Its visual language is.

### 0.2 Relationship to the earlier Paper extraction

On 2026-10-17 the Paper document "Butter — Design System" returned 59 tokens
before the weekly MCP limit blocked further reads
(`paper-butter-partial-extraction.md`). **That token set is not the same as
this file's.** Paper's used Inter Tight, DM Mono and Familjen Grotesk, radii
of 12-26px and different colour names; this file uses DieGrotesk/Geist, ABC
Diatype/Hanken Grotesk and Geist Mono, radii of 4-64px, and adds a mint accent.
The shared ground is the neutral and bright palette (`#FAFAFA`, `#EDEDED`,
`#E2E2E2`, `#B6B6B6`, `#3C3C3C`, `#1E1E1E`, `#0F0F0F`, `#E9D352`, `#4DC5E5`,
`#63AD45`, `#F9ABFF`, `#FF3333`).

The owner designated this HTML file as the reference, so **it governs**. The
Paper record is kept for traceability only and is not mixed in.

---

## 1. Tokens, verbatim from the reference

### 1.1 Raw palette (lines 10-13)

| Group | Token | Value |
|---|---|---|
| Light neutrals | `--p-white` | `#FAFAFA` |
| | `--p-off-white` | `#F7F7F7` |
| | `--p-light` | `#EBEBEB` |
| | `--p-light-grey` | `#EDEDED` |
| | `--p-dark-grey` | `#E2E2E2` |
| | `--p-charcoal` | `#3C3C3C` |
| | `--p-black` | `#1E1E1E` |
| | `--p-true-black` | `#0F0F0F` |
| Editor chrome | `--p-ui-900` | `#0A0909` |
| | `--p-ui-850` | `#151515` |
| | `--p-ui-800` | `#212121` |
| | `--p-ui-700` | `#2E2E2E` |
| | `--p-ui-text` | `#B6B6B6` |
| Brights | `--p-red` | `#FF3333` |
| | `--p-blue` | `#4DC5E5` |
| | `--p-green` | `#63AD45` |
| | `--p-yellow` | `#E9D352` |
| | `--p-pink` | `#F9ABFF` |
| | `--p-mint` | `#00FFD0` (the accent) |
| | `--p-butter` | `#F6D84D` |

### 1.2 Semantic tokens, light (lines 16-23)

| Token | Value |
|---|---|
| `--bg` | `--p-white` `#FAFAFA` |
| `--bg-alt` | `--p-off-white` `#F7F7F7` |
| `--surface` | `--p-light-grey` `#EDEDED` |
| `--surface-2` | `--p-dark-grey` `#E2E2E2` |
| `--fg` | `--p-true-black` `#0F0F0F` |
| `--fg-strong` | `--p-black` `#1E1E1E` |
| `--fg-2` / `--fg-3` / `--fg-4` | `rgba(15,15,15,.5)` / `.4` / `.3` |
| `--line` / `--line-strong` | `rgba(15,15,15,.08)` / `.16` |
| `--inverse-bg` / `--inverse-fg` | `#1E1E1E` / `#FAFAFA` |
| `--nav-bg` | `rgba(250,250,250,.72)` |
| `--tint` | `rgba(0,0,0,.02)` |
| `--accent` / `--accent-fg` | mint `#00FFD0` / `#0F0F0F` |
| `--focus` | `#0F0F0F` |

### 1.3 Editor chrome, dark in both themes (line 26)

`--ui-bg` `#151515` · `--ui-panel` `#1E1E1E` (`#0A0909` in dark theme) ·
`--ui-chip` `#2E2E2E` · `--ui-line` `#212121` · `--ui-fg` `#B6B6B6` ·
`--ui-fg-strong` `#FAFAFA`.

### 1.4 Dark theme (lines 43-60)

Applied by `prefers-color-scheme: dark` unless `data-theme="light"`, or by
`data-theme="dark"`: `--bg` `#0F0F0F`, `--bg-alt` `#151515`, `--surface`
`#1E1E1E`, `--surface-2` `#2E2E2E`, `--fg` `#FAFAFA`, `--fg-2/3/4`
`rgba(250,250,250,.56/.42/.3)`, `--line` `.08`, `--line-strong` `.16`,
inverse swapped, `--nav-bg` `rgba(21,21,21,.72)`, `--focus` `#FAFAFA`.

### 1.5 Typography (lines 29-31, 75-83, 390-398)

Families:
- `--font-primary`: `'DieGrotesk','Geist','Helvetica Neue',Arial,sans-serif`
- `--font-secondary`: `'ABCDiatype','Hanken Grotesk','Helvetica Neue',Arial,sans-serif`
- `--font-code`: `'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace`

DieGrotesk and ABC Diatype are marked *licensed* (line 653). The page loads
only Geist 400/500, Geist Mono 400 and Hanken Grotesk 400/500 from Google
Fonts (line 5).

| Role | Size | Line height | Tracking | Notes |
|---|---|---|---|---|
| Display | `clamp(40px,6.2vw,56px)` | 1.09 | -0.01em | `text-wrap:balance` |
| Heading 2 | `clamp(26px,3.4vw,32px)` | 0.9 | +0.006em | |
| Heading 3 | `clamp(24px,3vw,32px)` | 1.0 | +0.008em | |
| Lead | 20px | 1.2 | +0.033em | |
| Nav / body | 18px | 1.5 | normal | body default |
| Interface | 16px | 1.3 | +0.044em | buttons, nav links, inputs |
| Caption | 13px | 1.25 | +0.044em | colour `--fg-3` |
| Eyebrow | 12px, secondary family | 2.0 | +0.036em | colour `--fg-3`, sentence case |
| Code | 12px, mono | — | 0 | |

Weight: **400 only.** *"No bold anywhere. Step size or opacity for emphasis.
500 is reserved for the wordmark."* (line 626).

### 1.6 Shape, space, elevation (lines 34, 37, 414-420, 630-631)

- Radius: `--r-xs` 4 · `--r-sm` 5 · `--r-md` 8 · `--r-tile` 11 · `--r-lg` 16 ·
  `--r-xl` 20 · `--r-2xl` 22 · `--r-3xl` 32 · `--r-pill` 64 (px).
  Rule: *"Outer r32 card → inner media r20 → tiles r11 → chips r5. Inner
  radius = outer − padding."*
- Space, 4px base: `--s-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 ·
  `-8` 32 · `-10` 40 · `-16` 64 · `-24` 96 · `-32` 128 (px).
- Elevation: *"deliberately flat"*. Level 0 page `--bg`, level 1 card
  `--surface`, level 2 well `--surface-2`, float `--nav-bg` + blur 18px.
  *"No drop shadows. Use --surface steps, 1px --line, and blur for floating
  chrome."*
- Layout column: `max-width:1200px`, side padding `max(16px, safe-area)`.

### 1.7 Motion (lines 40-41, 66, 427-435)

- `--ease-out: cubic-bezier(.200,.715,.205,.990)` — *"Hovers, reveals, text
  roll. Default."*
- `--ease-in-out: cubic-bezier(.835,.120,.225,.770)` — *"Page transitions,
  large panels."*
- `--dur-fast` 180ms · `--dur` 360ms · `--dur-slow` 700ms. *"Fast out, long
  settle."*
- Reduced motion: every animation and transition off (line 66).
- The reference itself runs three infinite animations (the easing demo track,
  the footer wordmark sheen, the wave canvas). They are demos; see §5.6.

---

## 2. Components in the reference

Every component below is quoted from the CSS. States listed are the ones the
reference defines; states it does not define are marked as extensions in §5.

| Component | Spec (from the CSS) | States defined |
|---|---|---|
| **Button** `.btn` | 42px high, `0 16px`, `--r-md`, no border, 16px/+0.044em, gap 8px, `white-space:nowrap` | hover (per variant), `:active` scale .97, `[disabled]` opacity .35 |
| ↳ primary | `--inverse-bg` / `--inverse-fg`; hover `--p-charcoal` `#3C3C3C` | |
| ↳ secondary | `--surface` / `--fg`; hover `--surface-2` | |
| ↳ ghost | transparent; hover `--tint` | |
| ↳ accent | mint / `#0F0F0F` | |
| ↳ sizes | `sm` 32px, `0 12px`, 14px, `--r-sm`; `lg` 50px, `0 22px`; `pill` `--r-pill`, `0 24px`; `icon` square, round, 18px glyph | |
| **Text roll** `.slide` | label duplicated, rolls up `translateY(-100%)` over `--dur` on hover | hover |
| **Link** `.link` | 16px/+0.044em, trailing `↗` moves `translate(3px,-3px)` on hover | hover |
| **Tag / badge** `.tag` | 26px high, `0 10px`, `--r-sm`, `--surface`, 13px/+0.044em; `.dot` 6px circle | variants `dark` (`--ui-chip`/`--ui-fg`), `pill`, `new` (mint/ink) |
| **Field** `.field` + `.input` | label 13px/+0.044em `--fg-2`; input 46px, `--r-md`, 1px `--line-strong`, `--bg`, `0 14px`, 16px | placeholder `--fg-4`; focus: border `--fg`, no outline |
| **Prompt bar** `.prompt` | `--r-xl`, `--surface`, `6px 6px 6px 18px`, 18px input + primary button | focus: no outline on the inner input |
| **Segmented** `.seg` | track `--surface`, `--r-md`, 3px padding, gap 2px; buttons 34px, `0 14px`, `--r-sm`, 14px/+0.044em, `--fg-2` | `aria-pressed="true"`: `--bg`, `--fg`, 1px `--line` ring |
| **Switch** `.switch` | 40×24, pill, `--surface-2`; knob 18px `--bg` | `aria-checked="true"`: track `--inverse-bg`, knob `--inverse-fg`, moved 16px over `--dur` |
| **Toast** `.toast` | inverse colours, `--r-md`, `10px 12px 10px 16px`, 15px/+0.03em; fixed bottom-centre | enters by opacity + 20px rise over `--dur`; `role="status" aria-live="polite"` |
| **Floating nav** `.nav` | sticky (top 14px padding), `--nav-bg` + `blur(18px) saturate(1.4)`, 1px `--line`, `--r-lg`, `8px 8px 8px 18px`, min-height 52px; links 16px/+0.044em `--fg-strong`, gap 24px; right cluster `margin-left:auto` | links hidden ≤760px |
| **Feature card** `.feature` | `--r-3xl`, `--surface`, two columns, min-height 360px; copy padding `--s-10`; media inset 12px, `--p-black`, `--r-xl` | one column ≤760px |
| **Editor chrome** `.editor` | `--ui-panel`, `--r-xl`, 1px `--ui-line`, secondary family; library tiles `--ui-bg`, `--r-tile`, 1px `--ui-line` | tile hover border `#3a3a3a`; selected border mint; focus outline mint |
| **Range / dial** | 4px track, filled part `--ui-fg-strong`, 14px white thumb; dial in mint | |
| **Tabbed list** `.ways` | large tab labels, inactive `--fg-4`, active `--fg`, `role="tablist"` | `aria-selected`, hover |
| **Code block** `.code` | `#151515`, `#d7d7d7`, `--r-md`, 12.5px/1.6 mono, `overflow-x:auto` | |
| **Template card** `.tcard` | 4:5 thumb `--r-xl`, overlay tag | hover scale .985 |
| **Footer** `footer.site` | top 1px `--line`, 4 columns (2 ≤640px), eyebrow heads, 15px links | |
| **Section head** `.sec-head` | eyebrow (`<b>NN</b>` index in `--fg`) + H2 + caption, max 720px | |
| **Hero** | centred, eyebrow → display → lead (max 560px) → CTA row → meta row of tabular figures | |
| **Usage rule card** `.rule` / `.mcard` | `--bg-alt`, 1px `--line`, `--r-xl`, padding `--s-5` | |
| **Focus** | `:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; border-radius: var(--r-sm) }` | |

---

## 3. Usage rules, verbatim (lines 626-631)

1. **Weight 400 only.** No bold anywhere. Step size or opacity for emphasis. 500 is reserved for the wordmark.
2. **Alpha, not new greys.** Secondary text is `--fg` at 50 / 40 / 30%.
3. **Colour inside content.** Brights appear in media, block previews and one accent per view (mint). Never on chrome.
4. **Tight headlines.** H2 runs at 0.9 line-height.
5. **Flat surfaces.** No drop shadows. Use `--surface` steps, 1px `--line`, and blur for floating chrome.
6. **Nested radii.** Outer r32 → media r20 → tiles r11 → chips r5.

---

## 4. Mapping to Nakshatra-X

### 4.1 Architecture

Nakshatra-X already routes every colour, size and radius through semantic
tokens in `frontend/src/app/tokens.css` (Tailwind 4 `@theme`), used as
`bg-surface-2`, `text-text-secondary`, `border-accent` and so on in ~1,500
places. The redesign **keeps those semantic names and changes their values**,
so the system is replaced in one place instead of rewriting every component.
The reference's raw palette is added alongside (`--color-p-*`) for the few
places that need a raw value, such as fills inside data views.

### 4.2 Light surfaces and dark "instrument" panels

The reference is light for its site and dark for its product chrome.
Nakshatra-X is both: a light product shell, and a few genuinely instrument-like
panels where dark serves the content.

| Surface | Treatment | Why |
|---|---|---|
| Every page, nav, cards, forms, tables, charts, text content | **Light** (`--bg` family) | It is the reference's primary identity, and a light page prints and projects well |
| Satellite map (the whole map card: search, map, layer rail, legend, hotspot strip, popups) | **Dark chrome** (`.chrome-dark`) | Satellite imagery is dark, the cividis colormap and status markers were tuned against dark, and Leaflet controls sit on the imagery. This is the reference's "editor chrome" |
| Landing page data figure (the Track A layer stack) | **Dark media inset** inside a feature card | Reference feature-card pattern: light card, dark media well. The cividis surface reads correctly on dark |
| Code / command blocks | Dark (`#151515`, reference `.code`) | As specified |

`.chrome-dark` redefines the same semantic custom properties for its subtree,
so components inside it need no dark-specific classes.

The reference's whole-page dark theme (`prefers-color-scheme`) is **not** wired
up: it would be a second complete theme to verify on every route and state.
The token structure allows it later (§5.8).

### 4.3 Colour tokens

Light (default):

| Nakshatra token | Was | Now | Reference source |
|---|---|---|---|
| `surface-0` page | `#0B0D10` | `#FAFAFA` | `--bg` |
| `surface-1` panels, app bar, card headers | `#121519` | `#F7F7F7` | `--bg-alt` |
| `surface-2` cards, wells | `#181C21` | `#EDEDED` | `--surface` |
| `surface-3` hover, active, popover | `#1F242A` | `#E2E2E2` | `--surface-2` |
| `surface-black` hero media | `#000000` | `#0F0F0F` | `--p-true-black` |
| `text-primary` | `#E6E9EC` | `#0F0F0F` | `--fg` |
| `text-secondary` | `#A2AAB3` | ink at **70%** | `--fg-2` (50%), raised — §5.1 |
| `text-tertiary` | `#858D96` | ink at **60%** | `--fg-3` (40%), raised — §5.1 |
| `text-placeholder` (new) | — | ink at 60% | `--fg-4` (30%), raised — §5.1 |
| `border-subtle` / `border-default` | `#23282E` / `#2E343B` | ink at 8% | `--line` |
| `border-strong` | `#3D444C` | ink at 16% | `--line-strong` |
| `border-interactive` | `#6A727B` | ink at 50% | `--fg-2` used as a boundary — §5.1 |
| `accent` (links, selection, focus, primary action) | `#6AA5F0` | `#1E1E1E` | `--inverse-bg`, `--focus` — §5.2 |
| `accent-muted` (selected fill) | `#1E3149` | `#D7FBF4` | mint at 14% over `--bg` — §5.2 |
| `highlight` (new, the one mint accent per view) | — | `#00FFD0` | `--accent` |
| `highlight-fg` (new) | — | `#0F0F0F` | `--accent-fg` |
| `status-nominal` | `#3FB98F` | `#2F6B1C` | `--p-green`, darkened — §5.3 |
| `status-caution` | `#E0A33E` | `#735C00` | `--p-yellow`, darkened — §5.3 |
| `status-critical` | `#F0684F` | `#BD1A1A` | `--p-red`, darkened — §5.3 |
| `status-unknown` | `#858D96` | `#5E5E5E` | neutral ink — §5.3 |
| `nav-bg` (new) | — | `rgba(250,250,250,.72)` | `--nav-bg` |
| `tint` (new) | — | `rgba(0,0,0,.02)` | `--tint` |
| `inverse-bg` / `inverse-fg` (new) | — | `#1E1E1E` / `#FAFAFA` | as named |

Dark chrome (`.chrome-dark`):

| Token | Value | Reference source |
|---|---|---|
| `surface-0` / `-1` / `-2` / `-3` | `#0F0F0F` / `#151515` / `#1E1E1E` / `#2E2E2E` | dark `--bg`, `--bg-alt`, `--surface`, `--surface-2` (= `--ui-chip`) |
| `text-primary` / `-secondary` / `-tertiary` | `#FAFAFA` / `#B6B6B6` / paper at 56% | `--ui-fg-strong` / `--ui-fg` / dark `--fg-2` |
| borders | paper at 8% / 8% / 16% / 42% | dark `--line`, `--line-strong`; 42% — §5.1 |
| `accent` | `#00FFD0` | mint: the editor's selected-tile border and focus ring |
| `accent-muted` | `#12362F` | mint at 14% over `--ui-bg` |
| `status-nominal` / `caution` / `critical` / `unknown` | `#63AD45` / `#E9D352` / `#FF6B6B` / `#9A9A9A` | `--p-green` / `--p-yellow` / `--p-red` lifted — §5.3 / neutral |

Measured contrast (script: composited over each surface, WCAG 2.2):

| Pair | Worst case | Needs |
|---|---|---|
| text-primary on surfaces 0-3 (light) | 14.80 | 4.5 |
| text-secondary, ink 70% | 6.42 | 4.5 |
| text-tertiary, ink 60% | 4.64 | 4.5 |
| border-interactive, ink 50% | 3.36 | 3.0 |
| status nominal / caution / critical / unknown (light) | 5.00 / 4.97 / 4.87 / 5.01 | 4.5 |
| accent `#1E1E1E` | 12.87 | 4.5 |
| dark: text-secondary `#B6B6B6` / tertiary 56% | 6.70 / 5.19 | 4.5 |
| dark: mint accent | 10.49 | 4.5 |
| dark: status nominal / caution / critical / unknown | 4.91 / 8.99 / 4.89 / 4.83 | 4.5 |
| primary button `#FAFAFA` on `#1E1E1E` | 15.97 | 4.5 |
| ink on mint | 14.80 | 4.5 |
| *For reference — rejected as text:* ref `--fg-2` 50% / `--fg-3` 40% on `#E2E2E2` | 3.36 / 2.53 | 4.5 |
| *Rejected:* mint / green / red on `#FAFAFA` | 1.24 / 2.65 / 3.48 | 4.5 |

### 4.4 Typography

| Role | Nakshatra use | Family | Size / line height / tracking |
|---|---|---|---|
| Primary | all UI and body text | **Geist** (self-hosted by `next/font`) | — |
| Secondary | eyebrows (`.label`), editor-chrome labels | **Hanken Grotesk** | — |
| Code | figures, IDs, coordinates, code | **Geist Mono** | — |
| Display | the one page title (`.font-display`, `text-4xl`/`5xl`) | Geist | 40 → 56px / 1.09 / −0.01em |
| H2 | section headings on narrative pages (`.t-h2`) | Geist | 26 → 32px / 0.9 / +0.006em |
| H3 | card and panel titles (`text-3xl` where large) | Geist | 32px / 1.0 / +0.008em |
| Lead | page intro (`text-xl`) | Geist | 20 / 1.2 / +0.033em |
| Body | prose (`text-lg`) | Geist | 18 / 1.5 / normal |
| Interface | buttons, nav, inputs (`text-base`) | Geist | 16 / 24px / +0.044em on controls |
| Caption | notes, meta (`text-sm`) | Geist | 13 / 20px / +0.044em on captions |
| Eyebrow | section labels (`.label`) | Hanken Grotesk | 12 / 16px / +0.036em, sentence case, tertiary |
| Code | (`text-xs` mono) | Geist Mono | 12 / 16px / 0 |

Tailwind size tokens: `xs` 12 · `sm` 13 · `base` 16 (was 15) · `lg` 18 ·
`xl` 20 (was 22) · `2xl` 26 (was 28) · `3xl` 32 (was 36) · `4xl` 40 (was 48) ·
`5xl` 56 (was 64).

Tracking is applied **by role** (buttons, nav, tags, inputs, captions,
eyebrows), not baked into the size tokens, because the reference gives body
text normal tracking and the console's dense cards reserve measured heights
(§5.4).

### 4.5 Shape, elevation, spacing

| Nakshatra | Now | Reference |
|---|---|---|
| `rounded-xs` | 4px | `--r-xs` |
| `rounded-sm` badges, tags, chips, small buttons | 5px | `--r-sm` |
| `rounded-md` buttons, inputs, controls, table wells | 8px | `--r-md` |
| `rounded-tile` (new) | 11px | `--r-tile` |
| `rounded-lg` the floating nav, popovers | 16px | `--r-lg` |
| `rounded-xl` cards (`Card`) | 20px | `--r-xl` |
| `rounded-2xl` component frames, map card | 22px | `--r-2xl` |
| `rounded-3xl` feature cards | 32px | `--r-3xl` |
| `rounded-pill` | 64px | `--r-pill` |
| Every Tailwind shadow (`shadow-sm` … `shadow-2xl`, `--shadow-overlay`) | flat: a 1px `--line` ring, no blur | *"No drop shadows"* |
| Spacing | Tailwind's 4px scale, unchanged | 4px base, identical |
| Content column | 1280px kept for the console's data density; 1200px on narrative pages | `.wrap` 1200px — §5.5 |

### 4.6 Components

| Nakshatra component | Reference pattern | Change |
|---|---|---|
| `ui/primitives` `Button` | `.btn` primary / secondary / ghost; `sm`, `md` (= 42px), `lg`; `accent` | Inverse primary, surface secondary, tint ghost; 180ms colour transition; press scale .97; disabled opacity .35 |
| `Card` / `CardHeader` / `CardBody` | `.mcard` / `.rule` / `.cframe` | `--r-xl` 20px, `--bg-alt` fill, 1px `--line`; header strip `--bg-alt` with bottom line |
| `Badge`, `SourceBadge` | `.tag` | 5px radius, 13px/+0.044em; provenance kinds keep their own colours and words |
| `StatusDot` / `StatusLabel` | `.tag .dot` | Shapes kept (circle, triangle, square, ring): colour is never the only channel |
| new `Tag` | `.tag`, `.tag.pill`, `.tag.new`, `.tag.dark` | |
| new `Segmented` | `.seg` | Mine switchers, layer toggles, track switch |
| new `Switch` | `.switch` | Where a boolean control exists |
| new `Field` / `inputClass` | `.field` + `.input` | Labels, 46px inputs, ink focus border plus the global ring |
| new `Eyebrow` (`.label`) | `.t-eyebrow` | Sentence case, secondary family |
| `PageHeader` | `.sec-head` (eyebrow, heading, caption) | Eyebrow slot, display-scale title, lead description |
| `Section` | `.sec-head` + `.sub` | |
| `EmptyState`, `Skeleton` | `.rule` | Flat, dashed `--line-strong` edge; skeleton `--surface-2` |
| new `PageNav` | `.link` with `↗` / arrows | Replaces the stale "Page N:" bars on `/method`, `/mine-twin`, `/blending`, `/about` |
| new `MineSwitcher` | `.seg` | Replaces the three copies of the "Active mine context" pill row |
| `AppBar` | floating `.nav` | Sticky glass bar, 16px radius, wordmark at 500 italic; mobile drawer kept |
| `IntegrityFooter` | `footer.site` + `.fcols` | Columns with eyebrow heads; guardrail wording unchanged |
| `OfflineIndicator`, blending result, copy confirmations | `.toast` | Inverse colours |
| Map card (`IndiaSatelliteMap`) | `.editor` | `.chrome-dark`, 22px outer radius, dark layer rail |
| Search inputs | `.prompt` | Surface fill, 20px radius, primary button inside |
| Landing page | hero, `.statement`, `.feature`, `.sec-head`, `.rule` grid | §4.8 |
| Login, callback, admin | `.field`, `.btn`, `.mcard` | Glass, gradients and neon removed |
| Recharts | — | Series in ink, interval band ink at 12%, grid `--line`, axes tertiary; thresholds in status colours with text labels |

### 4.7 Motion mapping

| Use | Duration | Easing | Where |
|---|---|---|---|
| Hover / focus / press colour | 180ms (`--dur-fast`) | `--ease-out` | everywhere |
| Press scale .97 | 180ms | `--ease-out` | buttons |
| Disclosure (menus, drawers, accordions) | 180ms | `--ease-out` | everywhere |
| Panel or route content arriving (`.panel-enter`) | 180ms | `--ease-out` | product routes |
| Switch knob | 180ms on product routes (the reference uses 360) | `--ease-out` | §5.6 |
| Text roll on hover | 360ms (`--dur`) | `--ease-out` | landing-page calls to action only |
| One-time hero entrance (GSAP) | 700ms (`--dur-slow`), ≤ 60ms stagger | `--ease-out` | landing page only |
| Layer stack separation (GSAP ScrollTrigger, existing) | scroll-linked | none | landing page only |

Product routes keep the existing guard: nothing over 300ms, nothing looping,
no transition on a layout property (`tools/e2e-motion.js`).

### 4.8 Landing page composition

Centred hero (eyebrow → display → lead → two buttons) → statement line →
"Two tracks" as two rule cards → **feature card** with the Track A layer stack
in a dark media inset → "What it scores, measured" figures with their
provenance → Sentinel-2 imagery band → "What this does not claim" as rule cards.
The reference's inline gradient "media chips" inside headlines are not used:
they are decorative colour on text, and in this product an image means a
measurement.

---

## 5. Deliberate extensions and deviations

Each is a change to what the reference specifies, made on purpose.

### 5.1 Text and boundary contrast (accessibility)

The reference's secondary inks (`--fg-2` 50%, `--fg-3` 40%, `--fg-4` 30%)
measure 3.36, 2.53 and ~1.9 on `#E2E2E2`: none passes WCAG 1.4.3 for text.
The rule *"alpha, not new greys"* is kept; the alphas are raised to the lowest
values that pass on every light surface: **70%** (6.42 worst) and **60%**
(4.64 worst). Placeholders use 60% rather than 30%.

The reference's input border (`--line-strong`, 16%) fails WCAG 1.4.11 for a
control boundary (1.3:1). Controls use ink at **50%** (3.36 worst), which is
the reference's own `--fg-2` value. Decorative dividers keep `--line`.

In dark chrome, the control boundary is paper at 42% (3.63 worst).

### 5.2 One accent, split in two

The reference's accent is mint, and it uses mint as a fill or a border, never
as text on light (1.24:1). Nakshatra's `accent` token is used ~300 times as
**text** (links, selected labels) and as the focus ring. So:

- `accent` on light = `#1E1E1E`, the reference's `--inverse-bg` and `--focus`.
  Primary buttons become the reference's inverse button; selected states
  become ink. Chrome stays monochrome, which is rule 3.
- `highlight` = mint, used as a fill with ink text, once per view: the
  console portfolio's "Largest expected shortfall" tag. Elsewhere mint appears
  only inside dark chrome, where it is `accent`: the landing figure's measured
  points and the map's selected layer edge, focus ring and "ON" marker.
- `accent-muted` = mint at 14% over `--bg`, for selected fills and text
  selection.
- In dark chrome, `accent` = mint, which is how the reference's editor uses it
  (selected tile border, focus outline).

Links inside prose are underlined, because an ink link in ink text would be
distinguished by colour alone (WCAG 1.4.1).

**Amended 2026-10-20 (colour inside content).** The first implementation
applied rule 3's "never on chrome" and left content almost as monochrome as
the chrome, so its charts were ink on grey. Rule 3 also says where the brights
*do* go: "inside content … media, block previews". Content now uses them:

- Every chart sits in a dark data well (the reference's `.feature .media` /
  `.stage` ground), where all six brights measure 5:1 or more, and takes its
  series colour by role: mint for the model's output, blue for measured inputs,
  yellow for a synthetic series, pink dashed for an illustrative continuation,
  a neutral dash for baselines. Values and contrast are in `DESIGN_SYSTEM.md`
  §3.9 and §8.
- Source-kind tags are a bright as a fill with ink on it (`.tag.new`): a tint
  on light surfaces, the full bright in dark chrome.
- `highlight` is still the one mint *accent* per view; the model's mint series
  and the DERIVED fill are data, not accent.
- Chrome is unchanged: navigation, buttons, segmented controls, inputs and
  light-surface focus stay ink.

### 5.3 Status colours

The reference has no status semantics; this product's statuses (nominal,
caution, critical, unknown) carry data meaning and must be readable as text.
Light-surface statuses are the reference's green, yellow and red **darkened
along their own hue** until they pass 4.5:1 on every surface. In dark chrome
the reference values are used as-is, except red, which fails at 3.73 on
`#2E2E2E` and is lifted to `#FF6B6B`. Every status keeps its text label and
shape, so colour is never the only channel.

### 5.4 Type sizes and tracking in dense views

- Body text is 16px in the product (the reference's interface size) and 18px
  on narrative pages (the reference's body size). Data tables and cards keep
  12-13px.
- Line heights for wrapped text stay at ≥1.4 (13/20, 16/24). The reference's
  1.25 caption and 1.3 interface leading are kept for single-line controls.
- Eyebrows use 16px line height, not 2.0: the console reserves the measured
  height of its cards and focal band to prevent layout shift, and a 24px
  eyebrow would break those reservations.
- Tracking is applied by role, not globally (§4.4).

### 5.5 Weight

400 throughout. `font-medium` resolves to 400. `font-semibold` and
`font-bold` resolve to **500**, the reference's reserved weight, because a
small number of dense-table emphases need a channel beyond opacity at 12-13px.
No 600 or 700 renders anywhere. The wordmark is 500 italic, as specified.

### 5.6 Motion

- The reference's 360ms default is used only on the landing page. Product
  routes stay within the existing 300ms guard, so switches and reveals there
  use 180ms.
- The reference's infinite demo animations (easing track, wordmark sheen, wave
  canvas) are not used. Looping decoration stays banned.
- The text-roll hover duplicates the label; the copy is `aria-hidden` so a
  screen reader reads the label once.
- `DESIGN_SYSTEM.md` §7 is updated to match, without relaxing the bans on
  count-ups, loops, parallax, scroll-jacking or delays to data.

### 5.7 Fonts

DieGrotesk and ABC Diatype are licensed and are **not** used or named in the
font stacks: naming them would render them only on machines that happen to
have them installed, so the product would look different per machine. The
reference's declared web fallbacks are used instead: Geist, Hanken Grotesk and
Geist Mono, all SIL Open Font License, self-hosted through `next/font/google`
(the mechanism the repo already used; no new dependency). Inter, Sora and IBM
Plex Mono are removed.

### 5.8 Not implemented

- The full-page dark theme and its toggle (§4.2).
- The template card, logo strip, block library tiles, dials, wave canvas,
  inline headline media chips and the footer's giant wordmark: they have no
  counterpart in this product.

### 5.9 Small deviations made during implementation

- **Ghost button hover** steps to `--surface` instead of the reference's
  `--tint` (2% ink), which is invisible on `--bg`.
- **Eyebrows use secondary ink** (70%), not the reference's `--fg-3`, keeping
  the repo's projector-legibility decision (`POLISH_AUDIT.md` issue 4).
- **The hero entrance is CSS, not GSAP.** It runs from first paint, so text the
  server already drew never blinks out while scripts hydrate. GSAP drives what
  needs scroll: section reveals (`components/landing/Reveal.tsx`) and the
  existing layer-stack separation, both on the reference's curve via
  `CustomEase` (`lib/motion.ts`).
- **Press scale** (`.btn:active` 0.97) is used on buttons; the reference's
  template-card hover scale and the swatch hover lift are not (DESIGN_SYSTEM
  §7.2 still bans transform-on-hover for cards and controls).
- **One segmented-control element per group is a `<fieldset>`** with a visually
  hidden `<legend>`, where the reference uses a `div[role=group]`.
- **"Scenarios you have run" stays uppercase** in CSS: the scenario test's
  "nothing listed before a run" regex is case-sensitive and has only ever read
  the heading uppercased; sentence case would turn it into a live check that
  fails on the shared server-side history (BUG-3), not on the design.

### 5.10 Content changes

The redesign restyles copy rather than rewriting it. The exceptions, each
because the old words claimed something untrue or named something gone:

- `/about`: "Autonomous Space-Geological Decision Support Platform" → "A
  decision-support platform" (nothing here acts autonomously; the guardrails say
  outputs are decision support for a qualified person). The SIH problem
  statement itself is quoted unchanged.
- `/login`: the e-mail placeholder was a real-looking personal address; now
  `name@organisation.in`. "Return to 3D Space Platform" → "Back to home".
  "Orbital Console Login" → "Sign in". Two unverifiable footer badges ("Real
  Inbox Verification", "Resend Secured") removed.
- `/auth/callback`: "orbital clearance / orbital operator profile" status lines
  replaced with plain descriptions of the step.
- Account menu: "SECURED ACCESS" and "OPERATOR / SELECT MODE" chips replaced by
  "Signed in" / "Choose a method"; "Enter Guest Mode" → "Continue as guest".
- `/method`, `/blending`, `/mine-twin`: the "Page N: …" bars, whose labels named
  screens that no longer exist, replaced by `PageNav` links to the same and
  related destinations; the duplicate second `<h1>` on two of them removed.
- Mine-twin option labels moved to sentence case with the same characters
  (`+6h delay` still matches the scenario test's case-insensitive lookup).
- The landing hero's last clause ("it shows the uncertainty and the source
  behind every number it reports") became its own statement line, unchanged.
- `/admin/*`: headings typed in capitals ("INITIALIZE PRIMARY COMMANDER", "USER
  DATABASE", "RESTRICTED COMMAND ACCESS" and four more) moved to sentence case,
  same words. On `/admin/setup`, which anyone can open without signing in, the
  name and e-mail placeholders were a real person's name and personal address;
  they are now "Full name" and `name@organisation.in`. The same identity also
  appears as a fallback in sign-in and admin *logic*, which is left unchanged
  and reported in `docs/bug-reports/2026-10-19-auth-fallbacks-and-hardcoded-identities.md`.

**Not changed, flagged:** the Method page's "Model Specs" tab states a Random
Forest (100 trees, depth 6, 80/20 split), while its own header and the metrics
API describe the gradient-boosting model validated leave-one-mine-out. That is
pre-existing content about the science, so it is left for the owner to correct
rather than rewritten here.

### 5.11 Content column

The reference's 1200px column is used on narrative pages. The console and map
keep 1280px, which their measured layouts and layout-shift reservations were
built against.

---

## 6. Route inventory

Verified against the checkout at `20d1cdd`. "Shell" means the root layout:
`AppBar`, `#main`, `IntegrityFooter`, the AI-X copilot, `OfflineIndicator`,
the skip link.

| Route | Purpose / primary task | Main components | Data | States | Covered by | Risk |
|---|---|---|---|---|---|---|
| `/` | Explain the two tracks and show measured evidence | server page, `ProspectivityStack` (GSAP), `BeltImagery` | artifacts read at request time (`landing-evidence`), `public/data/prospectivity-stack.json`, imagery manifest | artifact unreadable → reason, no figure | motion, fonts, routes, provenance, cls, a11y, interactions | Medium |
| `/console` | Which mine needs attention: portfolio ranked by expected shortfall | `DecisionConsole`, `Card`, `SourceBadge`, `ProbabilityWithdrawn` | `/api/v1/mines`, per-mine forecast | register loading, per-card computing / warming / unreachable / unavailable; reserved heights | e2e, cls, provenance, a11y, interactions, nav, dates, band | **High** |
| `/console?mine=N&track=b` | One mine's production forecast, backtest, actions | `TrackBPanel` (Recharts), `IntervalCalibration`, `Evidence`, `IntegrityBanner` | forecast, backtest, recommendations, telemetry, calibration | loading, warming, failed, telemetry failed, sticky mobile summary | e2e, pilot, dates, band, scenario, cls | **High** |
| `/console?track=a` (and `?mine=N&track=a`) | Where to prospect | `TrackAPanel` → `IndiaSatelliteMap` (Leaflet), `MapLayerLegend`, drill targets, score form | prospectivity surface, measured points, tile layers, geocode, metrics | tiles unavailable, layer unavailable, search empty | map, a11y-map, e2e, routes | **High** |
| `/production` | Operational detail behind one mine's shortfall | `ProductionSentinel`, `PageHeader` | mines, telemetry | loading, failed | routes, provenance, a11y, cls | Medium |
| `/flood-alert` | Measured 14-day rainfall for a place | `LocationFloodAlertFinder` | geocode, Open-Meteo via API | searching, no result, unmeasured days | routes, provenance, a11y | Medium |
| `/blending` | Cheapest blend over stated stockpile assumptions | `SmartOreBlendingModal`, `RiskCockpit`, mine switcher | `/api/v1/optimize-blending`, telemetry | solving, infeasible, failed | blending, routes, provenance, a11y | Medium |
| `/mine-twin` | What-if scenario arithmetic for one mine | `MineTwinPanel` (SVG chart), mine switcher | `/api/v1/mine-twin`, constraint check, forecast baseline | running, permitted / blocked, history | scenario, routes, provenance, interactions, fonts | High (and BUG-3, §7) |
| `/method` | How the models are built and validated | `JudgesArchitectureDeck`, `RealtimeMLTrainingStudio`, mine switcher | metrics, drill targets | loading, unavailable | routes, provenance, a11y | Low |
| `/about` | Problem statement and scope | static | none | — | routes, a11y | Low |
| `/login` | Sign in (guest, GitHub, e-mail OTP) | `LoginForm` | `/api/auth/*` | sending, OTP entry, errors, unconfigured providers | auth, a11y, routes | Medium (providers unconfigured locally) |
| `/auth/callback` | Complete an OAuth sign-in | callback page | `/api/auth/session` | working, failed | routes, auth | Low |
| `/admin`, `/admin/login`, `/admin/setup`, `/admin/profile` | Administer users and mines | admin pages | `/api/admin/*` | gated client-side, unconfigured | routes, auth, a11y | Medium |
| not-found, `error.tsx`, `loading.tsx` | Recover | static | none | — | routes | Low |
| Shell | Navigate, disclose guardrails, ask AI-X | `AppBar`, `UserNav`, `IntegrityFooter`, `AICopilotModal`, `OfflineIndicator` | session, historical forecasts | menu open, drawer, offline | nav, a11y, auth | High |

Redirect-only routes (`/dashboard`, `/preview`, `/features`, `/features/:id`,
`/loading`, `/evaluator`) render nothing and are asserted by `test:routes`.

## 7. Open issues outside the redesign

Recorded in `docs/bug-reports/2026-10-18-fail-open-guards-and-mine-twin-history.md`
and **not changed** by this work:

- `tools/provenance-guard.js` and `tools/a11y.js` report PASS when the server
  is down. Every suite run in this work checks server health before and after.
- `/api/v1/mine-twin` shares one scenario history across all visitors
  (cross-user isolation defect). The redesign does not touch the route.
