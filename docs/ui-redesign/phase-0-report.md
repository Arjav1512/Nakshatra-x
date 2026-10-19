# Nakshatra-X UI redesign — Phase 0 report

| | |
|---|---|
| Date | 2026-10-17 to 2026-10-18 |
| Commit audited | `20d1cdd` (= `origin/main`), worktree branch `t3code/dd2508ab` |
| Gate | **PAUSED. Butter access is BLOCKED by Paper's weekly MCP limit.** Phase 1 has not started. No application code has changed. |

**Butter — Design System is the sole Paper design reference for this task.
XAI — Website & Design System will not be used.**

---

## 1. Decisions recorded (owner, 2026-10-18)

1. **Paper access**
   - Wait for the weekly reset. Do not upgrade to Pro.
   - Don't retry blocked calls.
   - When access returns, extract the whole Butter document into
     `docs/ui-redesign/design-system-mapping.md`. Keep verified specifications
     separate from proposed extensions. Never write to the Paper document.
2. **Motion**
   - The brief authorizes purposeful GSAP. This is a selective update to the
     motion policy, not a blanket licence.
   - Always kept:
     - reduced-motion support
     - cleanup of timelines, ScrollTriggers and listeners
     - no infinite decorative motion
     - no delay to data, navigation or critical actions
     - no animations that shift layout
     - a responsive console
     - unchanged keyboard, touch and accessibility behaviour
   - Short one-time entrance or staggered animations are allowed only where
     they clearly help.
   - Count-ups and hover transforms are not to be added indiscriminately.
   - The exact changes to `DESIGN_SYSTEM.md` §7 and `test:motion` are written
     up for approval before either file is edited.
   - Reuse the installed GSAP, `@gsap/react` and ScrollTrigger. No new
     animation dependencies.
3. **Taste-skill is advisory only**
   - Butter's palette, typography and components take precedence.
   - Inspect every script before running it, and never run `assets.mjs`.
   - Install no further dependencies.
   - Keep the skill files out of redesign commits.
4. **Fail-open guards and MineTwin**
   - These get a separate report and remediation plan:
     `docs/bug-reports/2026-10-18-fail-open-guards-and-mine-twin-history.md`.
   - None of these fixes go on the redesign branch without separate approval.
5. **Source control**
   - No commit, push, merge, PR or deploy without approval.
   - The redesign, the skill files and the bug fixes stay separate.

## 2. Butter access — BLOCKED

**Error**, returned for every read tool except `get_basic_info`
(2026-10-17 20:56 UTC):

> Weekly MCP limit reached. It resets in 6 days. Upgrade to Paper Pro to
> continue. You can upgrade in Paper or visit https://paper.design/pricing. If
> you just upgraded and still see this, try closing and reopening Paper.

**The quota:**
- Free plan: 100 MCP tool calls per week. Pro: 1M per week.
- Enforced on Paper's side, per account. Every session on this machine draws on
  it.
- Expected reset: about 2026-10-23 to 24 UTC. Paper doesn't publish the exact
  time.

**Retrieved:** the file's identity and all 59 tokens. These are recorded
verbatim in `design-system-mapping.md` §1, with token hash `94efbbe0`.

**Not retrieved:** the node tree, the six sections' contents, JSX, computed
styles, screenshots and assets. That covers every component, variant, state,
icon, layout and elevation specification.

**Excluded:**
- XAI was never listed, opened or inspected.
- `/tmp/butter_src` is a scrape of the unrelated butter.video website, not the
  Paper document. It has been ignored.

**Other sessions holding a Paper MCP connection** (checked 2026-10-18 ~18:00
IST). Each line is the `paper mcp` relay's parent process and its working
directory:

| Session | Started (IST) | Project |
|---|---|---|
| Terminal `claude` | 2026-10-17 05:23 | `~/Documents/Obsidian Vault` |
| Terminal `claude` | 2026-10-18 17:47 | `~/Downloads/Chorme/excalidraw-master` |
| Claude Desktop Code session | 2026-10-18 02:10 | `~/Downloads/Projects/SatQuery/.claude/worktrees/vibrant-proskuriakova-7562a1` |
| Claude Desktop app, 2 relays | 2026-10-16 23:35, 2026-10-17 20:40 | app-level connector |
| This session | — | this worktree |

The Obsidian Vault session started at the same minute as the burst of MCP
activity in Paper Desktop's log (05:23 to 06:38 IST on 10-17). It is the
likely consumer of this week's budget, but that is an inference, not
confirmed. None of these sessions has been stopped. No call can spend budget
until the reset, so pausing them now changes nothing. They need to be closed,
or have Paper disabled, **before** the reset.

**Budget plan for when access returns**, about 30 calls:
1. `get_basic_info`: confirm the token hash.
2. `get_tree_summary`.
3. For each of the 6 sections: `get_jsx`, `get_screenshot` and
   `get_computed_styles` (18).
4. Assets and fonts (~5).
5. A margin for drilling into individual components.

Nothing gets fetched twice. Results go straight into the mapping doc.

## 3. Repository audit

**Git**
- This worktree is on `t3code/dd2508ab` at `20d1cdd`, the same commit as live
  `origin/main`.
- `feat/nakshatra-paper-ui` doesn't exist locally or on the remote. It will be
  created when Phase 1 is approved.
- The main checkout is clean, has no unique commits, and is 29 commits behind.

**Stack**
- npm, Node 22.20.0.
- Next 16.3.3, React 19.2.8, Tailwind 4.3.3 (tokens in `@theme`),
  TypeScript 7, Biome 2.5.14.
- GSAP 3.15 and `@gsap/react`, Recharts 3, Leaflet 1.9, lucide-react,
  Puppeteer-core guards.
- Backend: FastAPI on Python 3.13.

**Environment:** only `.env.example` files exist. Supabase, Firebase, Resend
and GitHub OAuth are unconfigured, so live sign-in can't be verified locally.

**Next 16 docs to read before Phase 2** (in `node_modules/next/dist/docs/`, per
`AGENTS.md`): fonts, CSS, view transitions, loading/error, proxy, and the
version-16 upgrade guide.

**The current design** (`frontend/src/app/tokens.css`,
`docs/design/DESIGN_SYSTEM.md`):
- Dark surfaces from `#000` to `#1f242a`, with one accent, `#6aa5f0`.
- Status colors: nominal, caution, critical, unknown.
- Fonts: Inter, Sora (display) and IBM Plex Mono.
- Radii of 2, 4 and 6px, and one overlay shadow.
- Durations: feedback 120ms, disclosure 180ms.

It is close to the inverse of Butter, which is light, uses Inter Tight and
DM Mono, has five accents and 12-26px radii.

**Pre-existing design debt:**
- Glass components on `/login`, `/auth/callback` and logout.
- Neon glows in `MineTwinPanel`, at lines 750 and 763.
- A radial-gradient background on `/admin`.
- Leaflet overrides in `legacy.css`.
- The `themeColor` literal `#0b0d10` in `layout.tsx`.

## 4. Baseline verification

The logs and runner scripts are in `/tmp/nx-baseline/`, outside the repo.

| Check | Result |
|---|---|
| `tsc` · `lint:literals` · `npm run build` | PASS |
| Biome gate (CI's no-worse) | PASS, 33 errors and 77 warnings, all pre-existing and equal to base |
| Backend fast pytest suite (CI's command) | PASS: 141 passed, 1 network test deselected. Committed artifacts unchanged |
| Console group: e2e 70s, dates 27s, pilot 89s, scenario 28s, surface, nav, auth, motion 46s, fonts 16s, band 17s, blending | PASS, 11/11 |
| `test:routes --external-offline` | PASS: 108/108, 1 skip (the ESRI basemap is unreachable by design) |
| `test:provenance` · `test:cls` · `test:a11y` · `test:a11y-map` | PASS: 16/16 routes · worst CLS 0.008 · 0 serious axe violations across 17 routes × 2 widths · PASS |
| `test:interactions`, backend up | PASS: 328 activations, 5 routes × 2 widths, 0 violations |
| `test:provenance --offline`, in CI's order on fresh servers | PASS |
| `test:interactions --backend-down` | **FAIL locally, twice.** Puppeteer crashed with "detached Frame". The 1280px pass was clean, and the crash came at the change to 375px |

**Limitations that remain:**
- **The backend-down sweep at 375px is unverified locally.** CI passes it on
  `20d1cdd` (run 39068189283).
- Not run locally: Track B pytest, Track B date checks, the artifact batch
  checks, `test:map`, the network suites and the ESRI tile check. All of them
  pass in CI run 39068189283.
- The frontend has no unit-test framework. Every frontend test is a browser
  tool.
- No screenshot-diff gate exists in CI.

**Runs I discarded, disclosed:**
1. **The first runner was killed when its session ended.** `test:routes` was
   rerun cleanly.
2. **The 02:43 resumed run happened with both servers down.** I quarantined
   it. In that run, `test:provenance`, `test:a11y` and `provenance --offline`
   all reported PASS against dead servers. That exposed BUG-1 and BUG-2.
3. **My first backend-down pass ran with the backend still up.** My stop
   command missed the uvicorn process. I discarded it and redid the pass
   correctly.

**`/mine-twin` provenance failure in my longer local run order.** Its cause is
the shared in-memory scenario history (BUG-3). CI order on a fresh server
passes.

## 5. Route and component inventory

| Route | Main parts | Tests that cover it | Redesign risk |
|---|---|---|---|
| `/` | `ProspectivityStack` (the only GSAP), `BeltImagery`, primitives | motion, fonts, routes, provenance, cls, a11y, interactions | Medium |
| `/console`, `?track=a`, `?mine=N&track=b` | `DecisionConsole` (827 lines); `TrackAPanel` → `IndiaSatelliteMap` (1,515, Leaflet); `TrackBPanel` (877, Recharts); `Metric`/`SourceBadge` | 14 suites | **High** (core demo path) |
| `/production` · `/flood-alert` · `/blending` | `ProductionSentinel` · `LocationFloodAlertFinder` · `RiskCockpit` with the blending modal | routes, provenance, cls, a11y, blending | Medium |
| `/mine-twin` | `MineTwinPanel` (1,059 lines, SVG chart) | fonts, routes, provenance, interactions, scenario | High |
| `/method` · `/about` · not-found, error, loading | Architecture deck, ML studio, static content | routes, provenance, a11y | Low |
| `/login` · `/admin/*` · `/auth/callback` | `LoginForm` (654 lines), glass components; admin gated client-side only | auth, a11y, routes | Medium (sign-in unverifiable locally) |
| Shell on every page | `AppBar`, `IntegrityFooter`, AI copilot modal, `OfflineIndicator`, skip link | nav, a11y | High |

There are 33 API route handlers. `proxy.ts` sets security headers and gates
no routes.

Butter components get mapped to these routes in `design-system-mapping.md` §3,
once inspected.

## 6. Taste-skill status

**Install**
- All 14 skills from `Leonxlnx/taste-skill` are under `.claude/skills/`, with
  their hashes in `skills-lock.json`.
- Both are untracked and **excluded locally**: two anchored lines,
  `/.claude/skills/` and `/skills-lock.json`, in
  `<common git dir>/info/exclude`.
- That file is shared by every worktree of this repo. Nothing is hidden
  anywhere else.
- Nothing has been deleted. Claude Code still loads the skills.

**Scripts** (inspected, none run)
- `draw.mjs`, `inspect.mjs`, `lint.mjs` and `lib/{cdp,probe,rules}.mjs` drive a
  local Chrome. `inspect.mjs` writes its output to `.taste-skill/` in the
  project root, so add that path to the exclude file before first use.
- `assets.mjs` downloads images from public archives. **It will not be run.**
- None of the scripts installs anything or needs keys.

**Conflicts with Butter or the repo**
- It describes itself as "not for dashboards or app screens".
- It bans monospace and hairlines. Butter defines a mono font and a line color.
- It allows at most two typefaces. Butter uses three.
- It requires 8+ moving elements and staggered entrances.
- The draw script picks its own palettes and type.
- `redesign-existing-projects` pushes a single accent, Geist, noise and
  gradients.

**Use:**
- Lint, inspect and critique only, as advisory review.
- `--keep palette,type` wherever an option applies.
- Butter, the repo's guards and this report's decisions override it.

## 7. Animation stack

- GSAP 3.15 with `@gsap/react` and ScrollTrigger appears only in
  `landing/ProspectivityStack`. It is scoped with `useGSAP`, gated by
  `matchMedia` and reduced motion, and cleaned up on unmount.
- Everything else is CSS:
  - `panel-enter` (180ms) and `resolve-once` (900ms) keyframes in
    `globals.css`
  - Tailwind `animate-*` classes in 16 files
  - a global reduced-motion block
- There are no other animation libraries.

**What `tools/e2e-motion.js` enforces today.** The motion-policy proposal must
deliberately keep or amend each of these:

| Area | Check |
|---|---|
| Landing | Layers and annotations are in the server-rendered HTML. Measured points are real marks. No `<video>` |
| Landing | Every annotation is visible before any scrolling. Native scroll, with no lock or shim |
| Landing | Scrolling separates the stack. The front layer stays put. Movement is by `transform`, not layout properties |
| Landing | No looping animation. Figures do not count up |
| Landing, reduced motion | All layers and annotations visible. Scrolling does not animate the stack |
| Console | No looping animation. No animation or transition longer than 300ms. No transition animates a layout property |
| Console, reduced motion | Content still renders |

`DESIGN_SYSTEM.md` §7.2 bans staggered entrances and hover transforms
(`scale`/`translate`), among others. Under the 2026-10-18 decision, any change
here is proposed, with exact wording and test diffs, only after the Butter
extraction. Count-up stays banned in any case, because §7.2 classes it as an
integrity violation.

## 8. Risk register

| # | Risk | Mitigation |
|---|---|---|
| 1 | Butter specs are unavailable, and the quota is shared with other sessions | Wait for the reset. Close or disable the other Paper sessions first. Follow the ~30-call plan. Store everything in the mapping doc |
| 2 | Accent contrast on light backgrounds fails. No accent works as text, only red reaches 3:1 for non-text UI, `muted` is 1.94 and `line` is 1.24 | Ink on accent fills. Status variants as proposed extensions, for approval |
| 3 | Dark-to-light switch touches every surface: the map basemap, the colormap's pale end, charts, `themeColor`, print styles, Leaflet CSS | Decide the theme mapping before Phase 2. The map and chart canvas is an explicit decision point |
| 4 | Guards and docs encode the current design: `fonts-guard`, `e2e-motion`, `status-labels`, `DESIGN_SYSTEM.md` | Update them deliberately with the tokens, without weakening what they protect |
| 5 | The motion policy conflicts with the brief | Settled in principle by the 2026-10-18 decision. Exact diff for approval |
| 6 | The provenance and integrity contract (`Metric`, synthetic markers, no new "live" indicators, D-044 no probabilities, uncertainty always drawn) could be lost in restyling | Keep the components' contracts intact. Run the provenance, scenario and band suites every phase |
| 7 | Two guards fail open (BUG-1, BUG-2) | Separate fix. Until then, check server health before and after each suite, as the Phase 0 runner did |
| 8 | Locally, the backend-down sweep is verified only at 1280px | Rely on CI for 375px. Recorded as unverified |
| 9 | No screenshot-diff gate | Before and after captures with the existing tools each phase |
| 10 | Four very large components: map 1,515 lines, `MineTwinPanel` 1,059, `TrackBPanel` 877, `DecisionConsole` 827 | Restyle in place. No refactors without a reason |
| 11 | Skill files committed by accident | Excluded locally. Stage files explicitly, never `git add -A` |
| 12 | Familjen Grotesk is used in Butter but has no token, so its role is unknown | Resolve from the frames |
| 13 | Shared MineTwin history (BUG-3) could show other visitors' input during a public demo | Restart the server before demos until it's fixed. Separate fix |

## 9. Sequence and gates

1. **Paper reset (~10-23 to 24).** Extract Butter, fill in the mapping doc
   §1-§4, and confirm the token hash.
2. **Finalize the route and component mapping.**
3. **Present for approval:**
   - the token mapping and proposed extensions
   - the component mapping
   - the exact motion-policy and `test:motion` diff
4. **On approval:**
   - create `feat/nakshatra-paper-ui`
   - capture "before" screenshots
   - build the foundation: tokens, fonts, primitives, shell, and the guard and
     doc updates
5. **Redesign routes from lowest to highest risk:** static pages → production,
   flood-alert and blending → mine-twin → console → landing → auth and admin.
   Run every suite after each phase.
6. **GSAP last,** behind the updated motion guard.

## 10. Corrections to the first Phase 0 summary

- **Butter defines 59 tokens, not 63.** Counted from the stored response:
  12 colors, 3 font families, 7 sizes, 4 weights, 4 tracking, 6 leading,
  3 opacity, 4 breakpoints, 2 containers, 9 spacing, 5 radii.
- **`get_tokens` failed.** The tokens came back inline from `get_basic_info`.
