# B-1 — First-time-user walkthrough

A walkthrough of the four tasks a first-time user is expected to complete, with
a screenshot of each confusion point and the root cause in the code. Captured
before any Phase 2 design work, at `docs/design/before-v2/`.

The user: a MOIL planner who has been told this tool predicts production
shortfall and ranks where to prospect. They have not seen it before and nobody
is sitting next to them.

---

## Task (a) — "Which mine needs my attention today?"

**Screen:** `/console` · `before-v2/console@1280.png`

**What they see:** ten cards. Nine of them say **P 100%**. One says P 99%, one
P 78%, one P 73%.

### Confusion 1 — the headline number does not discriminate

`P 100%` on nine of ten mines tells a planner nothing about where to look. The
figure that *does* discriminate is on the same card in tertiary weight: expected
shortfall, which ranges from −0 t to −700 t. The screen leads with the
saturated number and buries the separating one.

**Root cause.** `DecisionConsole.tsx` renders `p_shortfall` as the card's
primary value and `expected_shortfall_tonnes` as a trailing annotation. The
forecaster is behaving correctly — against these plan targets the probability
genuinely is near 1 for most mines — so this is a presentation failure, not a
model failure. Ranking by a quantity that saturates is the design error.

### Confusion 2 — no stated ordering

The cards are laid out in register order (Balaghat, Bharweli, Ukwa…), which is
neither risk order nor alphabetical. Nothing on screen says how they are
sorted, so the eye reads position as importance and position means nothing.

**Root cause.** `DecisionConsole.tsx` maps over `mines` in the order the
register returns them, with no sort and no sort control.

### Confusion 3 — ten equal cards, no focal point

Every card has identical weight, size and colour. There is no entry point for
the eye, so reading the screen is a scan of ten near-identical blocks.

**Root cause.** One card component at one size, in a uniform 3-column grid.

---

## Task (b) — "Open the worst mine and understand why"

**Screen:** `/console?mine=1&track=b` · `before-v2/mine-detail@1280.png`

### Confusion 4 — the page does not say where you are

After drilling into Balaghat, the `<h1>` still reads **"Decision support for
MOIL"**. The only indication of which mine is open is a 12 px breadcrumb above
the fold and the mine's name inside a panel heading.

**Root cause.** `DecisionConsole.tsx` renders one `PageHeader` for the route,
not for the selected entity; the title is a constant.

### Confusion 5 — the track toggle competes with the breadcrumb

"Track B · production risk / Track A · prospectivity" is a pair of buttons
directly under an integrity banner, in the same visual register as navigation.
A first-time user cannot tell whether these are tabs within the mine, a filter,
or a change of page.

**Root cause.** The toggle is styled as a button pair with no relationship to
the breadcrumb that describes the same state (`Portfolio / Balaghat /
production risk`).

### Confusion 6 — everything at once, at equal weight

Conditions, the forecast window note, four metrics, grade chips, a trajectory
chart, a backtest table and three constraint-checked actions arrive as one
sequence of same-weight panels. Nothing says which to read first, and the
answer to "why is this mine at risk" — the drivers — is not distinguished from
the evidence supporting it.

**Root cause.** `TrackBPanel.tsx` is a flat sequence of `<section>` blocks with
no hierarchy between "the answer" and "the evidence for the answer".

---

## Task (c) — "Check whether I should believe it"

**Screen:** the backtest block on the mine detail

### Confusion 7 — the credibility evidence is below the fold, mid-page

The rolling-origin backtest — MAPE 11.67% against a 14.81% baseline, coverage
0.812 on the pilot mine — is among the strongest things this product can say.
(Scoped deliberately: 0.812 is Balaghat on one 150-day window. Portfolio-wide
daily coverage is 0.761 [0.733, 0.786] and the 14-day cumulative distribution is
too narrow at 0.738 [0.700, 0.777] — `docs/CALIBRATION.md`. The protocol is the
strong claim; the single number is not a system-wide one.) It sits roughly
two-thirds down a long page, in a panel with the same border and background as
the panel above it.

**Root cause.** Same flat sequence. Nothing promotes the validation.

### Confusion 8 — nine mines say the backtest is unavailable, in the same visual language as the figures

Resolved in an earlier PR (the pilot-mine state), and recorded here because the
walkthrough found it: for the nine mines without a committed artifact, the panel
previously read "Backtest unavailable" in critical red.

---

## Task (d) — "Do the same on a phone"

**Screen:** `before-v2/mine-detail@375.png`

### Confusion 9 — 4,513 px of desktop, one column

The mobile mine detail is the desktop composition stacked: every panel, in the
same order, at full height, with no progressive disclosure and no collapsed
sections. Reaching the constraint-checked actions takes roughly eleven screens
of scrolling.

**Root cause.** Layout is `grid` → `grid-cols-1` at small widths with no
mobile-specific composition. Nothing is deferred, collapsed or reordered.

### ~~Confusion 10 — the assistant launcher sits on the content~~ — withdrawn

I recorded this from the 375 px capture: a circular "N" overlapping body text in
the hero and again over the conditions cards.

**It is not part of the product.** It is the Next.js dev-mode indicator, served
from a `nextjs-portal` shadow root, and it does not exist in a production build.
Checked by querying for fixed-position elements of that size (none in the
document) and then for the overlay host (`document.querySelector('nextjs-portal')`
→ present).

Left in with the correction rather than deleted, because a walkthrough that
quietly drops its wrong findings is not evidence of anything. Nothing to fix.

### Confusion 11 — two export buttons before any content

"Export CSV" and "Export PDF" occupy a full row above the page title at 375 px —
prime position for two actions a first-time user cannot yet have a reason to
take.

**Root cause.** The action row is part of the page chrome and is rendered
before the header at every width.

---

## Summary of root causes

| # | Confusion | Root cause | Fixed by |
|---|---|---|---|
| 1 | Headline number saturates | `p_shortfall` is the primary value | B-5 · lead with expected shortfall |
| 2 | No stated ordering | no sort, no sort control | B-5 · sort by shortfall, state it |
| 3 | No focal point | uniform card grid | B-5 · one focal element per screen |
| 4 | Page does not name the mine | constant `<h1>` | B-5 · entity-scoped header |
| 5 | Toggle competes with breadcrumb | unrelated components for one state | B-5 · unify breadcrumb and track |
| 6 | Everything at equal weight | flat `<section>` sequence | B-5 · answer / evidence split |
| 7 | Credibility buried mid-page | flat sequence | B-5 · promote the backtest |
| 8 | Missing backtest read as failure | critical styling for a scope decision | done (pilot state) |
| 9 | Mobile is squeezed desktop | no mobile composition | B-5 · designed mobile layout |
| ~~10~~ | ~~Launcher over content~~ | **withdrawn** — Next.js dev overlay, not the product | nothing to fix |
| 11 | Exports before content | chrome renders first | B-5 · demote to the panel they belong to |

---

# Re-run — tranche 2 (2026-10-01)

Same four tasks, desktop and 375 px, against the tranche-2 build. Screenshots in
`docs/design/after-v2/`.

| # | Confusion | Status | Evidence |
|---|---|---|---|
| 1 | Headline number saturates | **fixed** | Cards lead with expected shortfall (−0 t to −700 t). P is the qualifier. The underlying saturation was a bug and is fixed separately: independent daily aggregation understated cumulative spread 2.5–3.4×; P at 1.000 went from 9/10 mines to 2/10. |
| 2 | No stated ordering | **fixed** | Ranked 01–10 by expected shortfall, sort stated on screen: *"Largest shortfall first. Mines still computing sort last."* |
| 3 | No focal point | **fixed** | A focal band promotes the largest expected shortfall and answers task (a) in one line. Visible at 506 px at 375 px width. |
| 4 | Page does not name the mine | **fixed** | `<h1>` reads **Balaghat** on the mine detail, "Decision support for MOIL" at portfolio level. Verified at both widths. |
| 5 | Track toggle competes with breadcrumb | **open** | The toggle is still a button pair below the integrity banner, unrelated to the breadcrumb describing the same state. Not addressed in tranche 2. |
| 6 | Everything at equal weight | **improved** | Two named parts — *What the forecaster expects*, *Why you should believe it* — and four tabbed sections at 375 px. The desktop composition is still a long single column below those headings. |
| 7 | Credibility buried mid-page | **fixed** at 375 px, **improved** at desktop | One tap to *Evidence* on mobile. On desktop it sits under its own display heading rather than being the seventh identical panel. |
| 8 | Missing backtest read as failure | **fixed** (tranche 1) | Pilot-mine state, asserted by `test:pilot`. |
| 9 | Mobile is squeezed desktop | **fixed** | Mine detail 4,513 px → 2,512 px. Sticky summary carrying mine, shortfall, P and status at 310 px — inside the fold. Four sections, one tap each. |
| ~~10~~ | ~~Launcher over content~~ | **withdrawn** | Next.js dev overlay, not the product. |
| 11 | Exports before content | **improved** | Still above the title, but the answer now precedes everything that matters: the sticky summary is at 310 px with the exports above it in the page chrome. |

## Measured

| | before | after |
|---|---|---|
| mine detail height @375 | 4,513 px | 2,512 px |
| answer visible without scrolling @375 | no (1,330 px) | **yes (310 px)** |
| sections reachable in one tap @375 | 0 | **4** |
| portfolio height @1280 | — | 1,590 px |

## Still open, honestly

Confusion 5 is untouched. Confusion 6 is improved rather than fixed: the desktop
mine detail remains a long column beneath its two headings, and a genuine
two-column or progressive layout there is the next thing worth doing.

---

# Re-run — PR B, confusions 5 and 6 (2026-10-03)

The two left open after tranche 2. Desktop 1280×800 and 1440×900, and 375×812,
against the final PR B build. Screenshots in `docs/design/after-v3/` (main in
`docs/design/before-v3/`).

| # | Confusion | Status | Evidence |
|---|---|---|---|
| 5 | Track toggle competes with breadcrumb | **fixed** | One navigation model. The breadcrumb is the only track control and the track is part of the location: *Portfolio / Balaghat / production risk · prospectivity*. Both tracks shown, the current one carrying `aria-current="page"` — exactly one current location at every step. The button pair is gone from both places it was rendered. |
| 6 | Everything at equal weight, one long column | **fixed** (desktop); unchanged at 375 | Answer and drivers on top, then two structured columns: *Why you should believe it* (backtest) beside *What to do about it* (actions), each under its own heading. Conditions follow the answer at every width. |

### Confusion 5, walked

| step | URL | breadcrumb | current |
|---|---|---|---|
| open the console | `/console` | Portfolio / production risk · prospectivity | production risk |
| choose prospectivity | `/console?track=a` | same | prospectivity |
| open Balaghat | `/console?mine=1&track=b` | Portfolio / Balaghat / production risk · prospectivity | production risk |
| choose prospectivity | `/console?mine=1&track=a` | same | prospectivity |
| go up to Portfolio | `/console?track=a` | Portfolio / production risk · prospectivity | prospectivity |

Step 2 was **impossible before**: the button pair appeared only once you were on
Track A or inside a mine, so from `/console` — where most people land — there was
no way into Track A from the console at all. Going up to Portfolio now keeps the
track (it used to reset to Track B); in a location model, moving up a level
should not also switch tracks.

`npm run test:nav` asserts all of it. Against main (`cbe675a`): **8 failures**.

### Confusion 6, measured — 1280×800, `/console?mine=1&track=b`

| | main | PR B |
|---|---|---|
| page height | 3,141 px | **2,445 px** |
| P(shortfall) card | 1,054 px — below the fold | **562 px — above** |
| calibration (how far to trust it) | — | 692 px, beside the drivers |
| by-grade drivers | 1,383 px | **692 px — above** |
| trajectory chart starts | 1,538 px | **847 px** |
| backtest / actions | 1,896 / 2,282 px, stacked | 1,125 / 1,225 px, **side by side** |

The largest single cause was a bug, not density: the four answer cards sat one per
row at full width because the mobile tabs' `md:block` overrode the metric grid's
`display:grid` at every desktop width — 456 px for what is one 114 px row.

## Still open, honestly

- **The trajectory chart starts 47 px below an 800 px fold** (inside a 900 px
  one). The answer and the by-grade drivers are fully above it. Clearing the last
  ~270 px at 800 px tall would mean collapsing the forecast-window note or the
  integrity banner, both placed prominently on purpose by earlier PRs. Not done.
- **The selected-mine card still covers the top of the map at 375.** It did on
  main too. The legend no longer sits under it (it moved beside or below the map),
  so it overlaps nothing now — it just takes ~130 px of a 380 px map.
