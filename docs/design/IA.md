# Nakshatra-X — Information Architecture

One navigation model. Every capability within two clicks. No orphan routes.

- **Branch:** `design/foundation` · **Date:** 2026-09-23
- **Companions:** `DESIGN_AUDIT.md`, `DESIGN_SYSTEM.md`

---

## 1. The problem being solved

The audit found 19 routes with no hierarchy (N-3): nine feature routes as flat
siblings, four separate sign-in surfaces, a loading *state* published as a
navigable page, and — worst — **`/console`, the product's best screen, absent
from the primary navigation entirely** (N-7). The nav that does exist is clipped
at 1280px and overlaps content at 375px (N-1, N-2).

A user cannot tell which route is the product and which is a demo.

---

## 2. What the product actually is

Read from the code, not from the route names.

`/console` is not one screen among nine. It is the product:

```
DecisionConsole
  level:  'portfolio'  ->  'mine'        (in-page state, not a route)
  track:  'B'          <-> 'A'           (in-page toggle)
  export: CSV, PDF
```

It holds **both PRD tracks** — Track B (production shortfall, days–months) and
Track A (reserve prospectivity, years) — behind a toggle, with portfolio-level
risk across all ten mines and per-mine drill-down into drivers, backtest and
constraint-checked actions. It is also the only screen that renders provenance
on every number.

**The IA follows from that fact:** the console is the home of the product, and
everything else is either a detail view that hangs off it or supporting
material.

---

## 3. Navigation model

A single top bar. Four destinations, plus an account menu. No second nav, no
sidebar competing with it, no in-page nav pretending to be an index.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Nakshatra-X   Console   Production   Operations ▾   Method     [◑]  │
└──────────────────────────────────────────────────────────────────────┘
                                         │
                                         ├─ Ore blending
                                         ├─ Mine twin
                                         └─ Flood alert
```

| Item | Route | Holds |
|---|---|---|
| **Console** | `/console` | Portfolio shortfall risk · mine drill-down · Track A ⇄ Track B · exports. **Default destination after sign-in.** |
| **Production** | `/production` | Track B operational detail — the production sentinel view |
| **Operations** ▾ | — | Menu of three operational tools |
| ↳ Ore blending | `/blending` | Blend optimiser + risk cockpit |
| ↳ Mine twin | `/mine-twin` | Per-mine twin panel |
| ↳ Flood alert | `/flood-alert` | Location flood alert finder |
| **Method** | `/method` | Guardrails · backtest · architecture · model provenance *(renamed from `/evaluator`)* |
| **Account** `[◑]` | — | Profile · Admin *(role-gated)* · Sign out |

**Footer:** About · Data sources & guardrails · Version.

### 3.1 Responsive behaviour

| Width | Nav |
|---|---|
| ≥ 1024 | Full bar, all four items, dropdown for Operations |
| 768–1023 | Full bar, labels only, Operations still a dropdown |
| < 768 | Wordmark + account; everything else in a drawer opened by a labelled menu button |

The bar never clips, never overlaps content, and never renders items it cannot
fit — fixing N-1 and N-2. The drawer is a real disclosure (≤200ms, ease-out, no
bounce, disabled under reduced motion), not an overlay animation.

---

## 4. Two-click rule

The rule: **every capability is reachable within two clicks from any screen.**
A click is a navigation step. Controls *within* a screen a user has reached —
tabs, toggles, filters — are part of that screen, not further clicks.

| Capability | Path | Clicks |
|---|---|---|
| Portfolio shortfall risk | Console | **1** |
| Per-mine drill-down | Console → mine card | **2** |
| Track A prospectivity | Console → mine card *(Track toggle, in-screen)* | **2** |
| Track B forecast + interval | Console → mine card *(default track)* | **2** |
| Backtest evidence | Method | **1** |
| Guardrails & data sources | Method *(also in footer)* | **1** |
| Export CSV / PDF | Console *(in-screen)* | **1** |
| Production sentinel | Production | **1** |
| Ore blending | Operations → Ore blending | **2** |
| Mine twin | Operations → Mine twin | **2** |
| Flood alert | Operations → Flood alert | **2** |
| Profile | Account → Profile | **2** |
| Admin | Account → Admin | **2** |
| About | Footer → About | **1** |
| Sign in | `/login` *(redirect target when unauthenticated)* | **1** |

Maximum depth: **2**. No capability is deeper.

---

## 5. Route map

Every existing route accounted for. Nothing is silently dropped.

### 5.1 Kept

| Route | Change |
|---|---|
| `/` | Redesigned. Scroll-scrubbed hero removed; server-rendered content restored. |
| `/console` | **Promoted to product home** and added to the nav. Restyled to the system; behaviour unchanged. |
| `/production` | Restyled. Particles removed; "STREAMING" badge relabelled honestly. |
| `/blending` | Restyled; moved under Operations. |
| `/mine-twin` | Restyled; moved under Operations. |
| `/flood-alert` | Restyled; moved under Operations. |
| `/about` | Restyled; linked from the footer rather than the primary nav. |
| `/login` | **The single operator sign-in surface.** Restyled. |
| `/auth/callback` | Kept — OAuth callback. Restyled; raw Supabase errors given a real error state. |
| `/admin` | Restyled. |
| `/admin/setup` | Restyled. |
| `/admin/profile` | Restyled. |
| `/admin/login` | **Kept deliberately as a separate route.** Admin sessions are minted through a different signed-token path (`ADMIN_COOKIE` / `decodeAdmin`) than operator sessions (`SESSION_COOKIE` / `decodeSession`). Merging the two sign-in surfaces would be an authentication change, which is out of scope for a UI/UX phase. Restyled only. |

### 5.2 Renamed

| From | To | Reason |
|---|---|---|
| `/evaluator` | `/method` | "Evaluator" names an audience (hackathon judges), not a capability. The content — guardrails, backtest, architecture, model provenance — is the product's methodology and belongs to every user. Content preserved; the simulated training studio is relabelled as simulated rather than removed. |

### 5.3 Merged / redirected

| From | To | Reason |
|---|---|---|
| `/dashboard` | → `/login` (308) | It **is** the login screen (`before/dashboard@1280.png`), with no gating cue. The name promised a dashboard and delivered a form (N-5). The real dashboard is `/console`. |
| `/preview` | → `/login` (308) | Third login surface; composes the same `auth/LoginForm` with a different component vocabulary (N-6). |
| `/features` | → `/console` (308) | An index of feature routes — navigation rendered as a page. With a working nav it is redundant (N-3). |
| `/features/[id]` | → `/console` (308) | Loaded five heavy panels at once and duplicated `/production`, `/blending` and `/mine-twin` wholesale. Its genuine per-mine content **is** the console drill-down, which additionally carries provenance on every number. |
| `/loading` | → `/` (308) | A loading *state* published as a navigable route (N-4). Replaced by a real root `loading.tsx`. |

All merges are **redirects, not deletions**, so no existing link breaks.

### 5.4 Added — states, not features

| File | Why |
|---|---|
| `src/app/loading.tsx` | No root loading state existed; `/loading` was a route instead (N-4). |
| `src/app/not-found.tsx` | **No 404 design existed at all.** |
| `src/app/error.tsx` | Already present — restyled to the system. |

These are the states the framework already renders. Adding a designed 404 is not
a new feature; it is designing a screen users already reach.

### 5.5 Unchanged

The 23 API routes under `src/app/api/` are untouched. This phase changes no
endpoint, contract, payload or data model.

---

## 6. Orphans resolved

| Orphan | Resolution |
|---|---|
| `/console` — existed but was unreachable from the nav | Now the first nav item and the post-sign-in destination |
| `components/globe/IndiaMineGlobe.tsx` — imported by nothing, pointed at a non-existent `public/cesium/` | Removed (audit §4.2) |
| `/loading` — linked from nowhere meaningful | Redirected; real loading state added |

After this change every route is reachable from the nav, the footer, an
authentication flow, or a redirect. **Zero orphans.**

---

## 7. Page structure

Every screen uses the same skeleton, so the product feels like one thing:

```
┌─ App bar ───────────────────────────────────────────────┐
│  Wordmark · Nav · Account                               │
├─ Page header ───────────────────────────────────────────┤
│  Title            Context / filters      Primary action │
│  One sentence saying what this screen is for            │
├─ Content ───────────────────────────────────────────────┤
│                                                         │
├─ Integrity footer ──────────────────────────────────────┤
│  Guardrails · data sources · synthetic-data disclosure  │
└─────────────────────────────────────────────────────────┘
```

The **integrity footer is not optional.** `/console` already carries it —
guardrails stated in prose, and the sentence disclosing that operational data is
synthetic because MOIL's records are proprietary (PRD §8.2). It is promoted from
one screen to the shell, so no screen can present numbers without it.

Page headers carry a plain sentence of purpose. "Portfolio · shortfall risk by
mine" tells a user what they are looking at; "Orbital Console Login" does not.

---

## 8. Sequencing

| Stage | IA work |
|---|---|
| **1** (this branch) | App shell with the new nav; `/` and `/console` on it. Redirects and route renames **not yet applied** — old routes keep working untouched. |
| **2** (after approval) | Redirects, the `/evaluator` → `/method` rename, `loading.tsx` and `not-found.tsx`, and every remaining route moved onto the shell. |

Splitting it this way means Stage 1 changes no URL. The visual direction can be
reviewed without any link in `docs/DEMO.md` behaving differently.

---

## 9. Backlog

One improvement this IA wants but cannot build without new functionality:
**the console's `level`, `selected` mine and `track` are in-page state with no
URL representation**, so a specific mine's Track A view cannot be linked,
bookmarked, shared or restored on refresh. Recorded in `FEATURE_BACKLOG.md`
rather than implemented, because it is functionality rather than styling.
