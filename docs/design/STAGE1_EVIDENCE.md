# Stage 1 — evidence

Every acceptance check, with the command and its actual output. Where a target
is not met, that is stated rather than worked around.

Measured on `design/foundation`, production build (`next build && next start`),
FastAPI on `:8000`, Chrome headless via `puppeteer-core`.

---

## 1. Motion

```
$ cd frontend/src && grep -rF "<pattern>" . | wc -l

  pattern                    before   after
  ------------------------------------------
  transition-all               161       0
  animate-pulse                 31       1
  animate-ping                  13       0
  animate-bounce                 5       0
  animate-spin-slow              1       0
  @keyframes                    20       0
  requestAnimationFrame          7       2
  framer-motion imports          5       0
  prefers-reduced-motion         0       1
```

**The one remaining `animate-pulse`** is `components/ui/primitives.tsx:175`, the
`Skeleton` primitive — entry 3 in the motion inventory (DESIGN_SYSTEM.md §7.4),
and disabled under `prefers-reduced-motion`.

**The two remaining `requestAnimationFrame`** are both in
`components/nakshatra/sections.tsx`, a Stage-2 route component; one is the loop
and one is its `cancelAnimationFrame` teardown. The global reduced-motion block
already neutralises its output; the loop itself is removed in Stage 2 when that
component is rewritten.

`animate-spin` remains where it is a genuine pending indicator (`Loader2`,
`RefreshCw` gated on a loading flag) — loading indication is permitted motion.
The decorative `animate-spin-slow` on an orbit glyph is gone.

---

## 2. Colour

```
$ grep -rnoE "#[0-9A-Fa-f]{3,8}\b" frontend/src --exclude=tokens.css | wc -l
```

| File (Stage 1 surface) | hex | rgb() | arbitrary `-[#…]` |
|---|---|---|---|
| `app/page.tsx` | 0 | 0 | 0 |
| `app/layout.tsx` | 1 † | 0 | 0 |
| `app/globals.css` | 5 † | 0 | 0 |
| `components/shell/AppBar.tsx` | 0 ‡ | 0 | 0 |
| `components/shell/IntegrityFooter.tsx` | 0 | 0 | 0 |
| `components/ui/primitives.tsx` | 0 | 0 | 0 |
| `components/console/DecisionConsole.tsx` | 0 | 0 | 0 |
| `components/console/Evidence.tsx` | 0 | 0 | 0 |
| `components/console/TrackAPanel.tsx` | 0 | 0 | 0 |
| `components/console/TrackBPanel.tsx` | 0 | 0 | 0 |

† Documented exceptions, commented in place: `layout.tsx` is Next's `themeColor`,
serialised into a `<meta>` tag at build time where a CSS custom property cannot
resolve; `globals.css` is the `@media print` block, because a dark token palette
cannot be printed. Plus `lib/colormap.ts` (9 cividis stops), the exception named
in DESIGN_SYSTEM.md §3.5.

‡ A naive grep reports 2 for `AppBar.tsx`; both are `&#8209;` non-breaking
hyphen entities, not colours.

**Not yet clean, and honestly so:** 1,807 hex literals remain across the
Stage-2 routes (`mission-control/*`, `mine-twin/*`, `admin/*`, `about`, and
`legacy.css`). Stage 1 scoped colour work to the shell and the two reference
screens; Stage 2 clears the rest and deletes `legacy.css`.

---

## 3. Contrast — computed, not asserted

WCAG 2.2 relative-luminance formula, every foreground against every surface:

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

Two candidate values failed this check during design and were replaced:
`text-tertiary` `#7B838C` (4.46 against `surface-2`) → `#858D96`, and a single
`border` token at 1.36 → split into decorative rules and `border-interactive`
`#6A727B`.

cividis luminance is strictly increasing across all nine stops
(0.0169 → 0.7907), so the colormap survives greyscale and CVD.

---

## 4. Accessibility — axe-core

```
$ node tools/a11y.js --out docs/design/after/_a11y.json
```

axe-core 4.13.0 driven through `puppeteer-core`, rules
`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`.

**The brief asks for Playwright.** `puppeteer-core` was already a dependency and
drives the same headless Chrome, so it is used rather than adding a second
browser-automation stack for one check. The engine, rules and results are
axe-core's either way. This is a deliberate substitution, not an oversight.

| Route | serious/critical |
|---|---|
| **`/`** | **0** ✅ *(0 violations at any severity)* |
| **`/console`** | **0** ✅ *(0 violations at any severity)* |
| `/mine-twin`, `/flood-alert`, `/features`, `/features/1`, `/about`, `/loading`, `/admin/setup`, `/auth/callback` | 0 |
| `/dashboard`, `/preview`, `/login` | 1 each — `color-contrast` |
| `/evaluator` | 1 — `color-contrast` |
| `/blending` | 1 — `label` |
| `/production` | 2 — `label`, `scrollable-region-focusable` |
| `/admin`, `/admin/login`, `/admin/profile` | 2 each — `button-name`, `target-size` |

**Stage 1 target met: 0 serious/critical on both reference screens.**

**13 serious/critical remain across the Stage-2 routes, and the criterion is
not met product-wide yet.** All 13 are pre-existing, verified two ways:

```
$ git grep -c "<violating markup>" 5c817bb -- frontend/src   # present on main
$ git diff 5c817bb..HEAD -- frontend/src | grep "<violating line>"
  (no output — not one violating line was touched by this branch)
```

They are Stage 2's opening backlog: old 10px `text-slate-500` on `#090D16`
(contrast), unlabelled range inputs, and an icon-only close button with no
accessible name and a sub-24px target.

---

## 5. Build, types, lint

```
$ npx tsc --noEmit        -> clean, no output
$ npm run build           -> ✓ Compiled successfully
```

```
$ npx biome check src/ --max-diagnostics=300

                    main @ 5c817bb      design/foundation
  files checked           115                  103
  errors                   52                   46
  warnings                118                  103
  infos                    17                   17
```

**Lint is not clean, and was not clean on `main` either.** This branch reduces
errors 52 → 46 and warnings 118 → 103; it introduces none. The remainder are
pre-existing patterns in Stage-2 files — `useExhaustiveDependencies`,
`noArrayIndexKey`, `noDocumentCookie`, `noControlCharactersInRegex` in
`lib/security.ts`. Reporting this as a pass would be false.

---

## 6. Bundle

Same measurement method both times (`du` over the production build):

| | before | after |
|---|---|---|
| `.next/static` | 3.0 MB | **2.8 MB** |
| `.next/static/chunks` | 2.7 MB | **2.5 MB** |
| CSS (largest) | 196.0 KB | **172.0 KB** raw · 24.4 KB gzipped |
| JS total | — | 2.31 MB raw · 642 KB gzipped |
| **`frontend/public/`** | **145 MB** | **4.6 MB** |

The JS figure moves modestly because the removed dependencies were mostly
*unimported* — they inflated `node_modules` and install time, not the shipped
bundle. The real shipping win is `public/`: **145 MB → 4.6 MB**, the 788-frame
scroll sequence.

`node_modules` footprint removed: cesium 143 MB, three 25 MB, react-globe.gl
17 MB, framer-motion 5.6 MB.

`legacy.css` still contributes 10.0 KB raw / 2.4 KB gzipped and is deleted in
Stage 2.

---

## 7. Backend untouched

```
$ git diff --stat 5c817bb..HEAD -- backend/ AI/
  (no output — not one byte changed)
```

No endpoint, contract, payload, schema or model was modified. The six backend
suites are unaffected by construction.

---

## 8. Provenance and integrity

- `console/Evidence.tsx` keeps its contract: `Metric` still refuses to render a
  number without an envelope, and still flags an unprovenanced value as a PRD
  N-3 violation. Only its styling changed.
- `SourceBadge` still derives its label from `env.source_kind`, so "LIVE" is a
  computed claim, never a literal.
- The six hardcoded `LIVE` / `ACTIVE` / `STREAMING` labels are removed with the
  components that carried them.
- The `StatsSection` count-up is removed.
- The integrity footer is promoted to the shell **verbatim** — no wording that
  describes data provenance was altered.
- No new liveness indicator was added anywhere.
