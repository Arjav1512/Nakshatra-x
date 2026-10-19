# Nakshatra-X redesign — implementation report

| | |
|---|---|
| Date | 2026-10-18 |
| Worktree / branch | `t3code-dd2508ab` / `t3code/dd2508ab`, base `20d1cdd` (= `origin/main`) |
| Reference | `churn-design-system.html`, owner-approved (mapping: `design-system-mapping.md`) |
| Source control | **Uncommitted.** Nothing committed, pushed, merged or deployed |

## What changed

**Foundation** (`frontend/src/app/tokens.css`, `globals.css`, `layout.tsx`)
- The product's semantic tokens (`surface-0..3`, `text-*`, `accent`, `status-*`,
  `border-*`) re-valued to the reference's warm-neutral light system; a
  `.chrome-dark` scope redefines them for the reference's dark "editor chrome".
- Geist / Hanken Grotesk / Geist Mono through `next/font` (self-hosted; licensed
  DieGrotesk and ABC Diatype not used). Inter, Sora and IBM Plex Mono removed.
- Reference type roles (`.t-display`, `.t-h2`, `.t-lead`, …), nested radii
  4-64px, every Tailwind shadow flattened, reference easing and durations.
- Accessible variants for text alphas, control boundaries, statuses and accent,
  each measured (mapping §4.3, §5).

**Primitives** (`components/ui/primitives.tsx`): `Button`/`buttonClass`,
`RollLabel`, `Card`, `Tag`, `Badge`, `Segmented`, `Switch`, `Field`/`INPUT_CLASS`,
`EmptyState`, `PageHeader` (eyebrow), `MineSwitcher`, `PageNav`.

**Shell**: floating blurred app bar (`AppBar`, `UserNav`), column footer
(`IntegrityFooter`, guardrail wording unchanged), toast-style offline notice, the
AI-X dialog as a flat sheet with a prompt bar.

**Routes**: every route in mapping §6 — `/`, `/console` (portfolio, Track A,
Track B), `/production`, `/flood-alert`, `/blending`, `/mine-twin`, `/method`,
`/about`, `/login`, `/auth/callback`, `/admin`, `/admin/login`, `/admin/setup`,
`/admin/profile`, not-found, error, loading.

**Motion**: landing hero settle (CSS), landing section reveals (GSAP +
ScrollTrigger, `components/landing/Reveal.tsx`), the existing layer-stack scroll
separation, text roll on landing calls to action, press scale on buttons.
Reference curves via `CustomEase` (`lib/motion.ts`). `DESIGN_SYSTEM.md` §7 and
`tools/e2e-motion.js` amended; nothing existing relaxed.

**Guards updated, none weakened**
- `tools/fonts-guard.js`: asserts the new faces, plus a new check for the
  secondary face on an eyebrow.
- `tools/status-labels.js`: reads every definition of each status/accent token
  (light and dark chrome), and samples a partly clipped label at the centre of
  its visible part instead of the centre of its whole box (which measured the
  undrawn half against whatever lay outside the map frame).
- `tools/e2e-motion.js`: five new checks on the landing settle (hero legible
  within 1.2s, nothing on screen held back, every reveal ends visible, and both
  off under reduced motion).

## Verification

Servers: this worktree's own, on :3100 (Next production build) and :8100
(FastAPI), offline-sinked as CI does, fresh per group, health-checked before and
after every suite. Port :3000/:8000 belong to another session and were not used.

## Results

Labels: **PASS** means verified and passing. **FAIL** means verified and failing.
**NOT VERIFIED** means not exercised. **BLOCKED** means it cannot be exercised here.

### Static checks (final source)

| Check | Result |
|---|---|
| `tsc --noEmit` | PASS |
| `npm run lint:literals` | PASS (0 numeric literals rendered as data) |
| `biome lint src` | PASS on "no worse": 20 errors / 75 warnings vs 33 / 77 at `20d1cdd`. The remaining errors pre-date the redesign; Biome exits 1 at the base commit too |
| `npm run build` | PASS (build `K27kR1W7sRmDuJMKgBZdb`) |
| Backend `pytest` (the CI command) | PASS: 141 passed, 1 deselected. No backend file changed |

### Browser suites

There were two runs:
- **Build 8** (`wsMwy9_n1m-rFin3VEYdh`): the full CI set, `suites-final`.
- **Build 9** (`K27kR1W7sRmDuJMKgBZdb`): built after the last two edits, with the
  suites that cover what those edits touched, `suites-recheck`.

The last two edits were:
- `ProspectivityStack` renders its header slot inside a Fragment. This fixed a dev-only
  React key warning and leaves the DOM unchanged.
- `/admin/*` all-caps headings moved to sentence case, and the `/admin/setup`
  placeholders neutralised.

Each suite ran on fresh servers on :3100 / :8100, offline-sinked, with health
recorded before and after.

| Suite | Build 8 | Rerun / build 9 |
|---|---|---|
| test:e2e, dates, pilot, scenario, surface, nav, auth, band, blending | PASS | — |
| test:motion (24 checks, 5 new) | PASS | PASS (build 9) |
| test:fonts | PASS | PASS (build 9) |
| test:interactions | **FAIL(1)**: harness crash, Puppeteer "detached Frame" at the 375px transition. Machine load averaged about 4 at the time | PASS on rerun: 333 activations, 5 routes × 2 widths, 0 violations, 0 controls that could not be activated |
| test:interactions --backend-down | PASS: 215 activations, 0 violations, both widths | — |
| test:routes --external-offline | PASS: 108/108, 1 skip (ESRI, external) | PASS (build 9): 108/108, 1 skip |
| test:provenance | PASS: 0 unattributed values on 16 routes | — |
| test:provenance --offline | PASS | — |
| test:cls | **FAIL(1)**: the same harness crash, on `/console?track=a@375`. The 6 measurements taken all passed | PASS on rerun, all 20 route/width/condition cases; worst 0.014 (`/method@1280`). Build 9: PASS again, worst 0.014 |
| test:a11y (17 routes × 2 viewports) | PASS: 0 serious/critical; status labels 155 found, worst contrast 5.2:1 | PASS (build 9): 0 serious/critical; 155 labels, worst 5.2:1 |
| test:a11y-map | PASS | — |

**Discarded run.** The first a11y and a11y-map runs on build 8 audited the wrong
server. Those two tools read only `--base`, which defaults to :3000, and :3000 is
another session's server running the old design. The tell was "status labels: 0
found". Both runs were discarded, the runner was fixed to pass `--base`, and the
results above are from the corrected runs.

**Two guard changes, described above, neither a weakening.**
- `status-labels.js` caught a real defect: a map label half-clipped at the map edge
  measured 1.45:1. The guard was then corrected to sample the part of the label that
  is actually drawn.
- `fonts-guard.js` asserts the new faces.

### Responsive and live server

| Check | Result |
|---|---|
| `capture.js`: 16 routes × 4 widths, document overflow | PASS (0 overflow) |
| Width sweep: 14 routes × 360 / 390 / 1024 / 1440, overflow and clipped controls | PASS |
| Live check on the review server (`next dev`): 17 routes × 1440 / 390. Status 200 (404 for the unknown path), an `h1`, new tokens applied, no overflow, no uncaught page errors | PASS. Remaining console errors are pre-existing: `/auth/callback` without a Supabase session, and the 404 page's own 404 resource |
| Focus ring | ink 2px ring on light surfaces; mint ring inside the dark map chrome |

### Not verified / blocked

- **BLOCKED:** Google sign-in, Supabase OTP delivery, Resend/SMTP mail, GitHub
  OAuth. No credentials are configured locally, by design. E-mail-code sign-in
  *is* testable locally: in development the OTP route writes the code to the
  server log instead of mailing it.
- **NOT VERIFIED:** real devices and Safari / Firefox. All browser checks used
  Chrome via Puppeteer. There was no screen-reader pass beyond axe and the
  scripted label checks.
- **NOT VERIFIED:** the OTP e-mail HTML template (`api/auth/otp/route.ts`). It is
  e-mail, not a route, and still carries the old dark styling.

### Live auth checks (review server, 2026-10-19)

| Check | Result |
|---|---|
| Guest sign-in (`POST /api/auth/guest`) | PASS: session with role `guest` |
| E-mail-code sign-in with `reviewer@example.com` | PASS: no mail sent, code in the server log only and never in the response. Correct code → `operator` session; wrong code → 400 |
| `POST /api/auth/session` with a client-made "verified" user | 405 (no POST handler): no session minted |
| Unsigned JSON `nx-operator-session` cookie | `{"user":null}`: not accepted as a session |
| `/api/admin/profiles` without credentials | 401 |

## Colour restoration (2026-10-20)

**Why.** The first pass applied the reference's rule 3 ("brights … never on
chrome") but not its other half ("colour inside content … media, block
previews"). So the charts were ink on grey, and the reference palette appeared
only as one mint tag.

**Source.** `churn-design-system.html` (SHA-256 `6665ef69…`): `--p-mint`,
`--p-blue`, `--p-pink`, `--p-yellow`, `--p-green`, `--p-red`. Paper's "Butter —
Design System" tokens were read once (`get_basic_info`) and list the same
values. The artboard tree was not readable: Paper's weekly MCP limit, "resets in
4 days". No new palette was invented. Every value used is a reference value or
a measured tint of one.

**What changed.** Design rules: `DESIGN_SYSTEM.md` §3.9 and §8, and mapping §5.2
(amended).
- `tokens.css`:
  - data roles `--data-model / measured / synthetic / illustrative /
    comparison / axis / grid`
  - fills `--fill-green / mint / yellow` and `--on-fill`: tints on light, full
    brights in `.chrome-dark`
- `primitives.tsx`: `DATA_WELL` (a dark data well) and `FILL`.
- `lib/chart-theme.ts`: ticks, grid, tooltip and cursor, shared by every chart.
- Charts, each now in a data well, with series colour by role:
  - Track B forecast band (mint median and interval, neutral dashed baseline)
  - rainfall (blue bars; yellow caution threshold)
  - MineTwin 50-year series (yellow synthetic; pink dashed illustrative; new key)
  - MineTwin daily bars (mint against neutral)
  - Method deck and model-card feature importances (mint)
- Chart readability fixes:
  - rainfall y-axis ticks were clipped to "ım" by a −18px margin
  - the 50-year chart's year ticks were 8-unit SVG text squashed by
    `preserveAspectRatio="none"`; they are now HTML at 12px, and the lines use
    non-scaling strokes
  - the deck chart was dropping alternate feature names
- Source tags (`SourceBadge`, map legend, blending result) are reference fills
  with ink on them.
- `globals.css`: `.chrome-dark` prints its ground, so `Export PDF` never prints
  light text on white. Verified with backgrounds off.
- Unchanged: chart data, calculations, axes' domains, interactions, the cividis
  colormap, and chrome (navigation, buttons, segmented controls, inputs, focus
  on light).

**Checks** (build `km_dfMW6VQErxnyPniDVv`; suites on fresh :3100 / :8100 per
group, health recorded before and after each):

| Check | Result |
|---|---|
| `tsc --noEmit`, `lint:literals`, `npm run build` | PASS |
| Biome no-worse vs `20d1cdd` | PASS: 20 / 75 vs 33 / 77 (unchanged from the PR head) |
| Backend pytest (CI command) | PASS: 141 passed, 1 deselected; both guard lines present. No backend file changed |
| Console group: e2e, dates, pilot, scenario, surface, nav, auth, motion, fonts, band, blending, interactions | PASS, 12/12. Interactions: 337 activations, 0 violations |
| Routes, provenance, provenance `--offline`, interactions `--backend-down` | PASS: 108/108 (1 external skip); 0 unattributed; 215 activations, 0 violations |
| CLS | PASS: worst 0.014 |
| a11y (17 routes × 2 viewports), a11y-map | PASS: 0 serious/critical. Status labels 92, lowest 5.21:1. The count fell from 155 because source tags are now ink on a fill, not status-coloured text; axe's colour-contrast rule covers them, and ink on each fill measures at least 13.77:1 |
| `test:map`, live Planetary Computer, against the review server | PASS: 41 checks, 0 failures |
| Live render (17 routes × 1440 / 390) and overflow (14 routes × 360 / 390 / 1024 / 1440) | PASS |
