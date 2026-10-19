# Paper "Butter — Design System": partial MCP extraction (2026-10-17, superseded)

> **Superseded on 2026-10-18.** The owner supplied `churn-design-system.html` as
> the approved reference for the redesign; `design-system-mapping.md` now maps
> that file. This record is kept unchanged below the line because it is the
> only verified data retrieved from the Paper document, and its tokens differ
> from the HTML's (see `design-system-mapping.md` §0.2).

---

> **Status: PARTIAL. Extraction is BLOCKED by Paper's weekly MCP limit.**
> Only the file identity and the token list have been retrieved. Every
> component, variant, state, asset and layout specification below is marked
> *not yet inspected*. Nothing here may be filled in from guesses, screenshots
> alone, or any other Paper document.

**Butter — Design System is the sole Paper design reference for this task.
XAI — Website & Design System will not be used.**

## 0. Source and what was inspected

| | |
|---|---|
| Paper file | "Butter — Design System", id `01M53M6SA38J7SY6XSVQGZGYPG` |
| URL | https://app.paper.design/file/01M53M6SA38J7SY6XSVQGZGYPG/p-1-0 |
| Page | "Design System" (`p-1-0`), the only page |
| Artboard | "Butter — Design System", 1440 × 4632, 6 direct children, 509 nodes in the file |
| Fonts used in the file | Inter Tight, DM Mono, Familjen Grotesk |
| Token content hash | `94efbbe0` |
| Access | Read-only. The document has never been written to |

**Inspection log**

| Date (UTC) | Tool | Result |
|---|---|---|
| 2026-10-17 | `get_basic_info` | OK. File identity, artboard and the token list in §1 |
| 2026-10-17 20:56 | `get_tokens` and the other read tools | Failed: "Weekly MCP limit reached. It resets in 6 days." |

**Not inspected yet:** the names and contents of the artboard's six sections,
the node tree, JSX, computed styles, screenshots, images and icons.

**When access returns:**
- Call `get_basic_info` first. If the token hash is still `94efbbe0`, §1 is
  current and doesn't need fetching again.
- Budget roughly 30 calls for the full extraction.

## 1. Verified tokens (59)

These are verbatim from Paper, as retrieved on 2026-10-17. Changing any of
them requires a new inspection.

### Color (12)

| Token | Value |
|---|---|
| `--color-paper` | `#FAFAFA` |
| `--color-panel` | `#EDEDED` |
| `--color-line` | `#E2E2E2` |
| `--color-muted` | `#B6B6B6` |
| `--color-ink-soft` | `#3C3C3C` |
| `--color-editor` | `#1E1E1E` |
| `--color-ink` | `#0F0F0F` |
| `--color-butter` | `#E9D352` |
| `--color-cyan` | `#4DC5E5` |
| `--color-green` | `#63AD45` |
| `--color-pink` | `#F9ABFF` |
| `--color-red` | `#FF3333` |

### Font families (3)

| Token | Value |
|---|---|
| `--font-display` | Inter Tight |
| `--font-sans` | Inter Tight |
| `--font-mono` | DM Mono |

Familjen Grotesk appears in the file but has no token. Its role is unknown
until the frames are inspected.

### Type size (7) · line height (6) · weight (4) · tracking (4)

| Size token | Value | Line-height token | Value |
|---|---|---|---|
| `--text-xs` | 12px | — | — |
| `--text-sm` | 14px | `--leading-sm` | 20px |
| `--text-base` | 16px | `--leading-base` | 24px |
| `--text-lg` | 20px | `--leading-lg` | 28px |
| `--text-xl` | 28px | `--leading-xl` | 32px |
| `--text-2xl` | 40px | `--leading-2xl` | 42px |
| `--text-display` | 64px | `--leading-display` | 64px |

The table pairs sizes and line heights by shared suffix. Butter doesn't
declare the pairing; the frames have to confirm it.

| Weight token | Value | Tracking token | Value |
|---|---|---|---|
| `--font-weight-light` | 300 | `--tracking-display` | -0.045em |
| `--font-weight-regular` | 400 | `--tracking-tight` | -0.03em |
| `--font-weight-medium` | 500 | `--tracking-normal` | -0.01em |
| `--font-weight-black` | 900 | `--tracking-mono` | 0.02em |

### Spacing (9)

`--spacing-1` 4px · `--spacing-2` 8px · `--spacing-3` 12px · `--spacing-4` 16px ·
`--spacing-6` 24px · `--spacing-8` 32px · `--spacing-12` 48px · `--spacing-20` 80px ·
`--spacing-40` 160px

### Radius (5)

`--radius-sm` 12px · `--radius-md` 16px · `--radius-lg` 20px · `--radius-xl` 26px ·
`--radius-full` 999px

### Opacity (3) · breakpoints (4) · containers (2)

| Token | Value |
|---|---|
| `--opacity-faint` | 24% |
| `--opacity-muted` | 48% |
| `--opacity-strong` | 72% |
| `--breakpoint-sm` / `-md` / `-lg` / `-xl` | 640 / 768 / 1024 / 1440px |
| `--container-prose` | 560px |
| `--container-content` | 1280px |

**No tokens exist for shadow, elevation, border width, z-index, duration or
easing.** Whether the frames specify any of these is unknown until they are
inspected.

## 2. Derived facts (computed here, not Paper specifications)

WCAG 2.x contrast ratios between the verified colors. Thresholds: 4.5:1 for
normal text, 3:1 for large text and non-text UI.

| Foreground | on paper | on panel | on editor | on ink |
|---|---|---|---|---|
| ink | 18.36 | 16.37 | — | — |
| ink-soft | 10.57 | 9.42 | — | — |
| muted | **1.94** | **1.73** | 8.22 | 9.45 |
| line | **1.24** | **1.11** | 12.87 | 14.80 |
| butter | **1.45** | **1.29** | 11.04 | 12.69 |
| cyan | **1.93** | **1.72** | 8.28 | 9.52 |
| green | **2.65** | **2.36** | 6.03 | 6.93 |
| pink | **1.64** | **1.46** | 9.76 | 11.22 |
| red | 3.48 | 3.11 | 4.58 | 5.27 |
| paper | — | — | 15.97 | 18.36 |

**What this means for implementation:**
- On paper or panel backgrounds, no accent color can be used as text.
- Only red reaches 3:1 for non-text UI.
- `muted` can't carry meaningful text.
- `line` can't be the only boundary of an input or other control
  (WCAG 1.4.11).
- Ink on any accent fill passes: 12.69 on butter, 9.52 on cyan, 6.93 on green,
  11.22 on pink, 5.27 on red.

## 3. Component mapping — NOT YET INSPECTED

Fill this in from the frames. For each component, list the Butter node and its
variants and states (default, hover, focus-visible, active, disabled, loading,
error, selected) with exact values. Then list the Nakshatra component it
replaces.

| Nakshatra component (`frontend/src/components`) | Butter source | Status |
|---|---|---|
| `ui/primitives`: Button, Card, CardHeader/Body, Badge, StatusDot/Label, Skeleton, EmptyState, PageHeader, Section | — | not inspected |
| `ui/Evidence`: SourceBadge, EvidenceDetail, Metric, IntegrityBanner | — | not inspected |
| `AppBar` and navigation, `IntegrityFooter`, `OfflineIndicator` | — | not inspected |
| Dialogs: AI copilot modal, blending modal | — | not inspected |
| Form controls: inputs, selects, number fields, toggles, tabs | — | not inspected |
| Tables and data rows, chart styling (Recharts), map chrome (Leaflet) | — | not inspected |
| Auth: `LoginForm`, glass components | — | not inspected |

## 4. Assets — NOT YET INSPECTED

Icons, images and illustrations used in Butter, with their source references.
None are retrieved yet. Copy only what the implementation needs.

## 5. Proposed extensions (not in Butter) — none approved

Anything the product needs that Butter doesn't define goes here. Each entry
needs a rationale and approval before implementation. Expected candidates,
pending inspection:
- Status colors (nominal, caution, critical, unknown) that meet contrast on
  light backgrounds.
- A text-safe accent for links.
- The colormap's pale end against paper.
- Motion durations and easings.

## 6. Implementation notes (not Butter specifications)

- Weights each family offers in the Google Fonts catalogue (not Butter):
  - Inter Tight: 100 to 900
  - DM Mono: 300, 400 and 500
  - Familjen Grotesk: 400 to 700

  Any weight-900 style can therefore only be Inter Tight.
- The current system is in `frontend/src/app/tokens.css` and
  `docs/design/DESIGN_SYSTEM.md`: dark, Inter/Sora/IBM Plex Mono, one blue
  accent, 2-6px radii.
- `tools/fonts-guard.js` asserts the current font families.
  `tools/e2e-motion.js` asserts the current motion policy. Both need deliberate
  updates when the tokens change.
