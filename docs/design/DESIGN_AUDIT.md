# Nakshatra-X — Design Audit

Stage 1 of the UI/UX redesign. This document records what the current interface
does wrong, with evidence, and commits to a decision for every item.

- **Branch:** `design/foundation` (cut from `main` @ `5c817bb`)
- **Date:** 2026-09-23
- **Scope:** UI/UX only. No feature, backend, API, data-model or contract changes.

---

## 1. Method and evidence base

| Evidence | How it was produced | Where it lives |
|---|---|---|
| Before-screenshots | `frontend/tools/capture.js` (puppeteer-core + local Chrome) against a **production** build (`next build && next start`) on `:3000` with FastAPI on `:8000` | `docs/design/before/` — 19 routes × 4 widths = 76 PNGs |
| Per-route console log, HTTP status, horizontal-overflow probe | same harness | `docs/design/before/_report.json` |
| Motion / colour / typography inventories | `grep` over `frontend/src` | quoted inline below |
| Bundle baseline | `du` over the committed `.next` production build | §8 |

**Screens inspected pixel-by-pixel:** `/` (1280 and 375), `/console` (1280),
`/dashboard` (1280). Findings for the other 15 routes are derived from the
route→component map (§5) and the source inventories, not from reading each
image; those rows are marked *(code-derived)* so the basis is never overstated.

**Severity:** `S1` blocks credibility or access · `S2` major · `S3` moderate ·
`S4` minor. **Decision:** one of *remove / redesign / simplify / restructure / keep*.

---

## 2. The one-line diagnosis

The interface is **costumed as a spacecraft rather than built as an instrument.**
Its visual language spends its budget on signalling "space-tech" — neon, glow,
scroll-scrubbed video, drifting particles, pulsing badges — and has nothing left
for the job the PRD actually sets: letting a MOIL planner see a shortfall
forecast, its uncertainty and its provenance, and act on it.

The irony is that the project already contains the answer. `/console` is
restrained, legible, honest, and states its guardrails in plain sentences. It
scores roughly 7/10 on its own. Everything else scores 2–3. **The redesign is
largely the act of making the rest of the product look like `/console` already
does** — then raising that shared bar.

---

## 3. Cross-cutting findings

### 3.1 Colour — `S1`

```
2,040   hard-coded hex literals   (119 distinct)
1,532   arbitrary Tailwind colour values  e.g. text-[#00FF88]
  471   rgba()/rgb() literals
  106   gradients
  209   glow boxShadows
   77   backdrop-blur
```

Most-used: `#00FF88` ×641 · `#38BDF8` ×343 · `#FACC15` ×110 · `#94A3B8` ×109 ·
`#FF2E63` ×100 · `#00E5FF` ×56.

| # | Problem | Sev | Decision |
|---|---|---|---|
| C-1 | **119 distinct hexes, zero tokens.** There is no colour system — only 2,040 individual decisions. Any global change is un-makeable. | S1 | restructure |
| C-2 | **`#00FF88` used 641 times.** A maximum-chroma green on near-black is the single loudest thing the eye can be shown. Used for borders, text, glows, dots and icons indiscriminately, it carries no meaning — everything is emphasised, so nothing is. | S1 | remove |
| C-3 | **Status colour is decorative, not semantic.** Green/amber/red appear on badges, borders and glows unrelated to risk state, so the palette cannot also be used to encode risk — the channel is already spent. | S1 | redesign |
| C-4 | **Not colour-blind safe.** `#00FF88` vs `#FACC15` vs `#FF2E63` as a status triad is the classic deutan/protan failure; nothing pairs colour with shape, text or position. | S1 | redesign |
| C-5 | **209 glow shadows + 77 backdrop-blurs.** Elevation is signalled by emission, which reads as "toy" and costs paint performance on every scroll. | S2 | remove |
| C-6 | **Saturated colour over photographic satellite imagery** (landing map panel) leaves no contrast headroom; labels are legible only because of heavy `drop-shadow` stacks. | S2 | redesign |

### 3.2 Typography — `S2`

17 distinct text-size utilities; four families in play (`font-inter`,
`font-space`, `font-mono`, `font-sans`) plus a decorative `font-3d-cyber`;
**exactly one** `next/font` usage in the codebase.

| # | Problem | Sev | Decision |
|---|---|---|---|
| T-1 | **No scale.** 17 sizes, many as arbitrary values (`text-[10px]`, `text-[11px]`, `text-[44px]`). Vertical rhythm is accidental. | S2 | restructure |
| T-2 | **Body text at 10–11px.** `/` and several panels set `text-[10px]`/`text-[11px]` for real content, below the 12px floor for sustained reading and far below comfortable. | S1 | redesign |
| T-3 | **`font-3d-cyber` with `tracking-[0.22em]` and stacked `drop-shadow`** on the wordmark. Costume typography. | S2 | remove |
| T-4 | **`uppercase` + wide tracking used for paragraphs and labels everywhere**, which destroys word-shape and slows reading. Acceptable for short eyebrow labels only. | S2 | simplify |
| T-5 | **No tabular numerals.** Every metric, forecast and interval is set in proportional figures, so digits jitter between renders and columns do not align. For a numbers product this is a correctness-of-presentation issue. | S2 | redesign |
| T-6 | **Fonts not loaded through `next/font`** (1 usage), so the app pays layout-shift and an extra round trip. | S3 | restructure |

### 3.3 Motion — `S1`

```
 20   @keyframes definitions
105   animate-* usages   (spin 32, pulse 31, ping 13, in 13, bounce 5,
                          solar-pulse, solar-orbit-1/2/3, corona-spin, spin-slow)
161   transition-all
  7   requestAnimationFrame loops        5 components
  4   canvas 2D contexts
  7   scroll listeners
  9   setInterval
  0   prefers-reduced-motion queries     <-- zero
```

| # | Problem | Sev | Decision |
|---|---|---|---|
| M-1 | **`prefers-reduced-motion` is not honoured anywhere.** Zero occurrences in `src/`. Every one of the 105 animations and 7 rAF loops runs for users who have asked their OS to stop motion. This is a WCAG 2.2 failure and the single most serious accessibility defect in the product. | S1 | redesign |
| M-2 | **Scroll-jacking** — the landing hijacks ~7,000px of scroll to scrub a video (see §6.1). | S1 | remove |
| M-3 | **31 `animate-pulse` + 13 `animate-ping`,** overwhelmingly on badges and status dots that are not reporting anything changing. Pulsing is an alarm channel; spending it on decoration means a real alarm cannot be seen. | S1 | remove |
| M-4 | **`transition-all` ×161.** Transitions every animatable property including `width`, `height` and layout-affecting ones — the direct cause of the "jittery" feel. | S2 | redesign |
| M-5 | **Always-on rAF loops in 5 components**, none gated on visibility or reduced-motion. Continuous main-thread work and battery drain on an idle page. | S2 | remove |
| M-6 | **Text effects** — `hyper-text.tsx` (scramble) and `text-effect.tsx` (staggered/typewriter) animate real content, delaying legibility for spectacle and disrupting screen readers. | S2 | remove |
| M-7 | **`CustomCursor.tsx`** replaces the OS cursor with a rAF-driven canvas cursor. Breaks cursor affordances (text I-beam, resize, disabled), adds latency to every pointer move, and is invisible to touch users. | S2 | remove |
| M-8 | **`animate-bounce` ×5, `animate-spin-slow`, `corona-spin`, `solar-orbit-1/2/3`** — purely ornamental perpetual motion. | S3 | remove |
| M-9 | **A count-up animation renders unmeasured numbers.** `StatsSection.tsx` animates `0 → value` over 2s and paints every intermediate. Banned by the motion policy *and* by the integrity rules: a displayed number must be one the system actually measured. | S1 | remove |

### 3.4 Visual noise — `S1`

| # | Problem | Sev | Decision |
|---|---|---|---|
| V-1 | **Badge inflation.** The landing hero alone stacks three pill badges above the wordmark, then a four-segment "telemetry capsule" below it, then a scroll prompt — five competing ornaments before any content. | S1 | remove |
| V-2 | **Every container is a glowing bordered card.** With no flat surfaces there is no ground, so nothing can be figure. | S1 | redesign |
| V-3 | **`SpaceDustParticles` on 6 routes** (`/about`, `/blending`, `/evaluator`, `/flood-alert`, `/mine-twin`, `/production`) — see §6.3. | S2 | remove |
| V-4 | **Emoji in product chrome** — ⛔×4, 📜×2, ✦×2, ✅×2, ⚡×2, 🛡, 🚀, 📧. Renders differently per platform, announces as verbose alt text, and reads as consumer-casual in a ministry tool. | S3 | remove |
| V-5 | **931-line `globals.css`** compiling to a **196 KB** CSS bundle — mostly bespoke effect classes (`ios-badge`, `cyber-liquid-red`, `font-3d-cyber`, `cinema-viewport`). | S2 | restructure |

### 3.5 IA and navigation — `S1`

| # | Problem | Sev | Decision |
|---|---|---|---|
| N-1 | **The primary nav is clipped at 1280px** — the most common laptop width. `docs/design/before/console@1280.png` and `dashboard@1280.png` both show the pill label truncated to "ROL", "ALL FEATU" cut mid-word, and fragments ("E… SY… DF") colliding at the top-right. The product's main navigation is broken on its most likely viewport. | S1 | redesign |
| N-2 | **At 375px the nav overlaps the hero content** rather than collapsing (`before/root@375.png`). There is no working mobile navigation. | S1 | redesign |
| N-3 | **19 routes, no model.** Nine feature routes sit as siblings with no hierarchy: `/production`, `/blending`, `/mine-twin`, `/flood-alert`, `/evaluator`, `/features`, `/features/[id]`, `/preview`, `/dashboard`. Nothing tells a user which is the product and which is a demo. | S1 | restructure |
| N-4 | **`/loading` is a route.** A loading *state* has been published as a navigable page. There is simultaneously **no root `loading.tsx`** and **no `not-found.tsx`**, so real loading and 404 states are unstyled while the fake one is linked. | S2 | restructure |
| N-5 | **`/dashboard` renders the login screen** (`before/dashboard@1280.png`) with no indication that it is gated — it looks like the dashboard *is* a login page. | S2 | restructure |
| N-6 | **`/preview` duplicates `/login`** — both compose `auth/LoginForm`; `/preview` adds `nakshatra/sections`. Two doors to the same room. | S2 | restructure |
| N-7 | **`/console` — the product's best and most honest screen — is not reachable from the primary nav.** The nav offers "ML STUDIO", "MINE TWIN", "FLOOD ALERT", "PRODUCTION", "ORE BLENDING", "ALL FEATURES". The decision console is absent. | S1 | restructure |
| N-8 | **`components/globe/IndiaMineGlobe.tsx` is orphaned** — imported by nothing (§6.2). | S3 | remove |

### 3.6 Consistency — `S2`

| # | Problem | Sev | Decision |
|---|---|---|---|
| K-1 | **Two unrelated design languages.** `/console` (flat, neutral, hairline borders, sentence-case prose) vs everything else (neon, glow, uppercase mono). A user moving between them cannot tell it is one product. | S2 | redesign |
| K-2 | **Three parallel component vocabularies** — `components/ui/`, `components/nakshatra/ui.tsx`, and bespoke markup inside `mission-control/`. No shared button, card, badge, table or field. | S2 | restructure |
| K-3 | **Two map/globe implementations plus a dead third** — `IndiaCommandGlobe` (canvas), `IndiaSatelliteMap` (Leaflet CSS), `IndiaMineGlobe` (Cesium, orphaned). | S2 | restructure |

### 3.7 Copy and microcopy — `S2`

| # | Problem | Sev | Decision |
|---|---|---|---|
| P-1 | Theatrical labels throughout: "Orbital Console Login", "NAKSHATRA-X MISSION SECURITY", "Return to 3D Space Platform", "INITIALIZING ORBITAL SENSORS…", "SCROLL DOWN TO RECONNAISSANCE MAP", "Syncing space intelligence telemetry…". A ministry evaluator reads this as a costume over a thin product. | S2 | redesign |
| P-2 | "Autonomous Space-Geological Decision Support Platform" — the system is explicitly **not** autonomous; the PRD frames it as decision support for a qualified person, and guardrail (b) says outputs are not statutory figures. The tagline contradicts the product's own stated limits. | S2 | redesign |
| P-3 | Copy changes must not alter provenance claims. Any rewrite of a label that describes where a number came from carries its meaning across verbatim. | — | keep (as a rule) |

### 3.8 Accessibility — `S1`

| # | Problem | Sev | Decision |
|---|---|---|---|
| A-1 | **No `prefers-reduced-motion`** (M-1). | S1 | redesign |
| A-2 | **10–11px body text** at ratios that will not survive an audit (T-2). | S1 | redesign |
| A-3 | **Custom cursor** destroys pointer affordances (M-7). | S2 | remove |
| A-4 | **Colour-only status encoding** (C-4). | S1 | redesign |
| A-5 | **Focus rings unaccounted for.** No focus-visible token exists; against 209 glow shadows a default ring is invisible. Keyboard navigation is untested and unstyled. | S1 | redesign |
| A-6 | **`/` renders nothing server-side** — `page.tsx` mounts both children with `ssr: false`, so the landing has no document content without JavaScript, and the first thing any crawler or assistive pass sees is an empty `<main>`. | S2 | restructure |
| A-7 | **Disclosure only on hover.** `ProductionSentinel`'s "STREAMING" badge carries "simulated activity feed" in a `title` attribute — unavailable to touch and unreliable for screen readers, while the visible label claims streaming (§7). | S2 | redesign |

### 3.9 Responsiveness — `S1`

The harness reports **zero horizontal overflow at every route and width** — but
that number is misleading, and the misleading-ness is itself the finding.

| # | Problem | Sev | Decision |
|---|---|---|---|
| R-1 | **Content is clipped, not wrapped.** At 375px the landing paragraph is cut off at *both* edges (`before/root@375.png`) — "…omous Space-Geological Decision Support Platform for Ministry of S…". Ancestor `overflow-hidden` suppresses the scrollbar, so `scrollWidth === clientWidth` and the probe passes while the user simply cannot reach the text. **Worse than overflow: unreachable rather than awkward.** | S1 | redesign |
| R-2 | **`whitespace-nowrap flex-nowrap` on the hero wordmark** guarantees the clipping in R-1 at narrow widths. | S2 | redesign |
| R-3 | **Nav does not collapse** at any breakpoint (N-1, N-2). | S1 | redesign |
| R-4 | **Fixed 1920×1080 canvases** in `ScrollVideo` and the particle layers, `object-cover`-scaled — effects are sized for one viewport and cropped everywhere else. | S3 | remove |

---

## 4. Required specific evaluations

### 4.1 The 788-frame scroll-scrubbed hero — `ScrollVideo.tsx`

**Decision: REMOVE.** *(S1)*

Measured facts:

```
frontend/public/frames/     788 files     145 MB
TOTAL_FRAMES = 788, preloadAround(centerIndex, windowSize = 30)
48 Math.random() parallax stars on a second 1920×1080 canvas
requestAnimationFrame(render) — unconditional, never gated
```

Reasoning:

1. **145 MB of image assets** ship in `public/` to produce one background effect.
   The preloader fetches a rolling 36-frame window *while the user scrolls*, so
   the cost is paid on a real network, mid-interaction.
2. **It is scroll-jacking by construction.** A fixed `cinema-viewport` sits over
   a tall `scroll-track` spacer; ~7,000px of the user's scroll gesture drives a
   video instead of moving the page. This is the "enormous dead black gap"
   visible mid-page in `before/root@1280.png`.
3. **The banned-motion list names it twice** — scroll-jacking and scroll-scrubbed
   video are both prohibited outright by the motion policy.
4. **It carries the product's worst integrity defects.** The overlay hardcodes
   `LIVE SATELLITE TELEMETRY ACTIVE` with a pulsing dot, `LIVE TELEMETRY STREAM`,
   `10 Active MOIL Mining Sites` and `ISRO MOSDAC / BHUVAN ACTIVE` — none driven
   by data, none with provenance (§7).
5. **It contributes nothing a still frame would not.** The content is a slow
   orbital pan; the information conveyed is "this is about satellites and mining",
   which one well-chosen image conveys instantly and accessibly.

*Replacement:* a single static hero image (one optimised frame, `next/image`,
served responsively), with the real value proposition in server-rendered text.
The 788 frames are deleted from `public/`.

### 4.2 The 3D globe — `react-globe.gl` / Cesium

**Decision: REMOVE the dependencies and the orphaned component. RESTRUCTURE the surviving map.** *(S2)*

Measured facts:

```
react-globe.gl   0 imports in src/        node_modules: 17 MB
three            0 imports in src/        node_modules: 25 MB
cesium           1 dynamic import, in components/globe/IndiaMineGlobe.tsx
                                          node_modules: 143 MB
IndiaMineGlobe   imported by nothing  -> orphan
public/cesium/   does not exist       -> CESIUM_BASE_URL = '/cesium/' cannot resolve
```

Reasoning:

1. **`react-globe.gl` and `three` are dead dependencies** — zero imports. 42 MB
   of `node_modules` and a large install surface for code that is never reached.
   Removing them is free.
2. **The Cesium globe could never have run.** `IndiaMineGlobe.tsx` is imported by
   no route, and even if mounted it points `CESIUM_BASE_URL` at `/cesium/`, a
   directory that does not exist in `public/`. This is not a working feature being
   cut — it is dead code being swept, so removal cannot regress a capability.
3. **A globe is the wrong projection for the problem.** Every mine in scope sits
   in one corridor (Balaghat–Nagpur–Bhandara–Sausar, roughly 20.5–22.5°N,
   78.5–80.8°E). A rotating sphere spends its pixels on ocean and its interaction
   budget on re-finding a region the user never leaves, while making distance and
   area harder to judge, not easier.
4. **The genuine map capability is preserved.** `IndiaSatelliteMap` (Leaflet)
   stays and is restyled — pan/zoom remains explicitly allowed motion. What goes
   is the redundant `IndiaCommandGlobe` canvas and the dead Cesium path.

*Capability check:* no route loses a map. `/features/[id]` keeps
`IndiaSatelliteMap`; the orphan and the decorative canvas globe are removed.

### 4.3 Particle and canvas effects

**Decision: REMOVE all four decorative canvases.** *(S2)*

Measured facts:

```
4 canvas getContext('2d')  ·  7 requestAnimationFrame loops  ·  0 reduced-motion guards

SpaceDustParticles.tsx   165 lines, 15 Math.random() calls, mounted on 6 routes
ScrollVideo.tsx          48-star parallax layer, second full canvas
CustomCursor.tsx         rAF-driven cursor replacement, global
IndiaCommandGlobe.tsx    canvas globe with ACTIVE badge
nakshatra/sections.tsx   rAF loop
```

Reasoning:

1. **Perpetual main-thread work for zero information.** Each loop repaints
   forever whether or not anything changed, whether or not the tab is visible,
   and whether or not the user asked for reduced motion.
2. **Drifting particles directly damage a data product.** Movement in the
   periphery is the visual channel the eye uses to detect change. Spending it on
   dust means a genuine change — a threshold crossed, a forecast updated — has
   no way to attract attention.
3. **`CustomCursor` is a usability regression**, not an effect: it removes the
   I-beam, resize and not-allowed cursors that tell a user what a control does.
4. **They are on the banned list** — particles and perpetual ornamental motion
   are prohibited by the motion policy.

*Replacement:* flat token-driven surfaces. Depth comes from value contrast and
1px hairlines, not emission. The native cursor returns.

---

## 5. Per-route findings

Legend — evidence: **[img]** screenshot read pixel-by-pixel · *(code)* derived
from the route→component map and source inventories.

| Route | Renders | Key problems | Sev | Decision |
|---|---|---|---|---|
| `/` **[img]** | `ScrollVideo` + `MissionControlDashboard`, both `ssr: false` | §4.1 hero; nav overlap at 375 (N-2); clipped copy (R-1); 5 stacked ornaments (V-1); decorative LIVE claims (§7); no SSR content (A-6); 7,045px tall | S1 | redesign |
| `/console` **[img]** | `console/DecisionConsole` | The reference screen — flat, honest, provenance-bearing, guardrails in prose. Faults: clipped nav (N-1); all 10 mines read "forecast unavailable" because cold-start exceeds the harness wait; type scale and spacing not yet tokenised; not linked from nav (N-7) | S2 | keep + redesign to system |
| `/dashboard` **[img]** | self-contained login | Renders the login screen with no gating cue (N-5); theatrical copy (P-1); duplicates `/login` | S2 | restructure |
| `/login` *(code)* | self-contained | Duplicated by `/preview` and `/dashboard` (N-6) | S2 | restructure |
| `/preview` *(code)* | `nakshatra/sections`, `nakshatra/ui`, `auth/LoginForm`, `auth/CyberRobotAvatar` | Third login surface; third component vocabulary (K-2) | S2 | restructure |
| `/production` *(code)* | `ProductionSentinel`, `SpaceDustParticles` | Particles (V-3); "STREAMING" badge with hover-only disclosure (A-7) | S2 | redesign |
| `/blending` *(code)* | `SmartOreBlendingModal`, `RiskCockpit`, `SpaceDustParticles` | Particles (V-3); modal-as-page | S2 | redesign |
| `/mine-twin` *(code)* | `MineTwinPanel`, `SpaceDustParticles` | Particles (V-3) | S2 | redesign |
| `/flood-alert` *(code)* | `LocationFloodAlertFinder`, `SpaceDustParticles` | Particles (V-3) | S2 | redesign |
| `/evaluator` *(code)* | `JudgesArchitectureDeck`, `RealtimeMLTrainingStudio`, `SpaceDustParticles` | Particles (V-3); a judges-only deck as a first-class route (N-3) | S2 | restructure |
| `/features` *(code)* | self-contained | Index of feature routes — a nav in page form (N-3) | S3 | restructure |
| `/features/[id]` *(code)* | `IndiaSatelliteMap`, `RealtimeMLTrainingStudio`, `MineTwinPanel`, `SmartOreBlendingModal`, `ProductionSentinel` | Loads five heavy panels at once; overlaps `/mine-twin`, `/blending`, `/production` wholesale (N-3) | S2 | restructure |
| `/about` *(code)* | `SpaceDustParticles` | Particles (V-3); framer-motion entrance animation | S3 | redesign |
| `/loading` *(code)* | `nakshatra/sections`, `nakshatra/ui` | A loading state published as a route (N-4) | S2 | restructure |
| `/auth/callback` *(code)* | `nakshatra/sections`, `nakshatra/ui` | 8 console errors (Supabase session errors when unauthenticated — expected, but surfaced raw) | S3 | redesign |
| `/admin` *(code)* | `CyberRobotAvatar` | Admin in the same costume as the marketing surface | S3 | redesign |
| `/admin/login` *(code)* | self-contained | Fourth login surface (N-6) | S2 | restructure |
| `/admin/setup` *(code)* | self-contained | — | S3 | redesign |
| `/admin/profile` *(code)* | `CyberRobotAvatar` | — | S3 | redesign |
| *(missing)* `not-found.tsx` | — | No 404 design exists (N-4) | S2 | restructure |
| *(missing)* root `loading.tsx` | — | No real loading design exists (N-4) | S2 | restructure |

All 19 routes returned **HTTP 200**. Console issues: `/` 1 (a 404 resource),
`/console` 40 (503s from backend cold start — `/forecast` costs ~96.5s cold, the
harness waits 1.2s), `/auth/callback` 8. All other routes: 0.

---

## 6. Per-component findings

| Component | Sev | Problem | Decision |
|---|---|---|---|
| `ScrollVideo.tsx` | S1 | §4.1 | **remove** |
| `CustomCursor.tsx` | S2 | M-7, A-3 | **remove** |
| `mission-control/SpaceDustParticles.tsx` | S2 | §4.3, 6 routes | **remove** |
| `globe/IndiaMineGlobe.tsx` | S3 | orphan, broken asset path (§4.2) | **remove** |
| `mission-control/IndiaCommandGlobe.tsx` | S2 | decorative canvas globe, hardcoded `ACTIVE` badge | **remove** |
| `ui/hyper-text.tsx` | S2 | scramble animation on real content (M-6) | **remove** |
| `ui/text-effect.tsx` | S2 | staggered/typewriter entrance (M-6) | **remove** |
| `ui/animated-generate-button-shadcn-tailwind.tsx` | S3 | animated ornament button; not a system primitive | **remove** |
| `SolarCyberLogo.tsx` | S2 | `solar-pulse`, `solar-orbit-1/2/3`, `corona-spin` perpetual motion | **redesign** (static mark) |
| `TopNavMenu.tsx` | S1 | N-1, N-2, N-7 — clipped at 1280, overlaps at 375, omits `/console` | **redesign** |
| `TopBanner.tsx` | S3 | competes with nav for the same region | **remove/merge** |
| `mission-control/MissionControlDashboard.tsx` | S1 | hardcoded `LIVE STREAM TICK: 4s` + `10 Active MOIL Sites` (§7); 3 `setInterval`s | **redesign** |
| `mission-control/ProductionSentinel.tsx` | S2 | `STREAMING` badge, hover-only "simulated" disclosure (A-7) | **redesign** |
| `mission-control/RealtimeMLTrainingStudio.tsx` | S2 | simulated training presented as live, on 2 routes | **redesign** (label honestly) |
| `mission-control/IndiaSatelliteMap.tsx` | S2 | hardcoded `LIVE ML` badge; saturated overlay on imagery (C-6) | **redesign** (keep map) |
| `console/Evidence.tsx` | — | `Metric`, `SourceBadge`, `EvidenceDetail`, `IntegrityBanner`. Refuses to render a number without provenance. **The contract the whole system adopts.** | **keep — extend, never weaken** |
| `console/{DecisionConsole,TrackAPanel,TrackBPanel}.tsx` | S3 | correct in substance; needs tokens, type scale, tabular numerals | **redesign to system** |
| `nakshatra/ui.tsx`, `nakshatra/sections.tsx` | S2 | parallel component vocabulary (K-2); rAF loop | **restructure** (fold into primitives) |
| `StatsSection.tsx` | **S1** | **Confirmed count-up**: `animate(0, value, { duration: 2 })` drives `setDisplay` on every frame, so for two seconds the screen shows numbers that were never measured — plus `delay: i * 0.15` staggered entrance | **remove** (render the measured value directly) |
| `AboutSection / FeaturesSection.tsx` | S2 | framer-motion staggered entrance animation (banned) | **redesign** |
| `Footer.tsx` | S3 | emoji, glow | **redesign** |
| `auth/*` (4) | S2 | four login surfaces across `/login`, `/preview`, `/dashboard`, `/admin/login` (N-6) | **restructure** |
| `offline/*` (3) | S3 | `PWARegistry`, `OfflineIndicator`, `BackupManager` — functional; restyle only | **keep** |
| `mine-twin/*` (2) | S3 | restyle | **redesign** |

---

## 7. Integrity findings carried into the redesign

Phase 8 removed 17 fabrication clusters, but its greps targeted fabricated
**data paths**. Six fabricated **presentation strings** survived, because they
are literals in JSX rather than values on a data path:

| Location | String | Why it fails |
|---|---|---|
| `ScrollVideo.tsx:290` | `LIVE SATELLITE TELEMETRY ACTIVE` | hardcoded, pulsing dot, no feed behind it |
| `ScrollVideo.tsx:320` | `LIVE TELEMETRY STREAM` | hardcoded |
| `MissionControlDashboard.tsx:185` | `LIVE STREAM TICK: 4s` | hardcoded; asserts a 4s cadence that does not exist; `animate-pulse` radio icon |
| `IndiaSatelliteMap.tsx:234` | `LIVE ML` | hardcoded |
| `IndiaCommandGlobe.tsx:205` | `ACTIVE` | hardcoded |
| `ProductionSentinel.tsx:272` | `STREAMING` | feed is simulated; the disclosure is in a hover-only `title` |

Also: `ISRO MOSDAC / BHUVAN ACTIVE` and `10 Active MOIL Mining Sites` in the hero,
and `Autonomous …` in two taglines (P-2).

And one fabrication of a different kind: **`StatsSection.tsx` animates its numbers
from zero**, displaying ~120 intermediate values per statistic that correspond to
no measurement (M-9).

**All are removed or rewritten in this redesign.** The rule the redesign adopts
is the one `console/Evidence.tsx` already enforces: *a claim about data — its
liveness, its source, its recency — is rendered from the provenance envelope or
it is not rendered at all.* No screen touched by this work may state "live",
"active" or "streaming" as a literal.

This is a **design finding, not a feature change**: removing a false label
removes no capability.

---

## 8. Baseline measurements

Production build, committed tree, before any redesign change:

```
.next/static                 3.0 MB
.next/static/chunks          2.7 MB
largest JS chunk           376.0 KB
CSS bundle                 196.0 KB      <- from a 931-line globals.css
public/frames              145   MB      (788 JPEGs)

node_modules footprint of heavy deps:
  cesium           143 MB    1 dynamic import, in an orphaned component
  firebase          45 MB    1 module (Google popup sign-in)
  three             25 MB    0 imports
  react-globe.gl    17 MB    0 imports
  framer-motion    5.6 MB    4 imports
  leaflet          3.8 MB    CSS only in src; map component in use
  reactflow        212 KB    2 imports  (+4 redundant @reactflow/* sub-packages)
```

Removal candidates with justification, to be recorded in `docs/DECISIONS.md`:
`three` and `react-globe.gl` (zero imports), `cesium` + `@types/cesium`
(orphaned component, missing assets), `@reactflow/{background,controls,core,minimap}`
(re-exported by the `reactflow` meta-package already installed), `framer-motion`
(its only uses are banned entrance animations).

After-figures for the same measurements are reported in the PR.

---

## 9. What is kept

Not everything is wrong, and the redesign does not restart from zero:

- **`console/Evidence.tsx` and its provenance contract** — the strongest idea in
  the product. It becomes the system-wide rule.
- **`/console`'s information design** — two tracks stated plainly, guardrails in
  prose, synthetic data disclosed in a sentence rather than a badge.
- **The guardrail footer.** It survives verbatim; only its typography changes.
- **`IndiaSatelliteMap`** as the single map, restyled.
- **Recharts** as the chart library (6 imports, already in use) — themed, not replaced.
- **The offline/PWA components** — functional, restyled only.

---

## 10. Sequencing

**Stage 1** (this branch): tokens, primitives, motion strip, app shell, then
exactly two reference screens — `/` and `/console` — with after-screenshots at
four widths. One PR, then review.

**Stage 2** (after approval): every remaining route and component, duplicate
consolidation, microcopy rewrite, error/404/loading states.

No capability is dropped in either stage. Every removed, merged or redirected
route is listed with its reason in the PR that performs the change.
