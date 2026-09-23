# Feature Backlog — surfaced by the redesign

Design needs that require **data or functionality that does not exist**. Per the
redesign brief these are logged, not built: this phase changes UI/UX only, with
no backend, API, data-model or contract changes.

Each entry states what the design wanted, what is actually available today
(verified in code, with the file), and what would have to exist.

---

## B-1 — Console state has no URL representation

**Design wanted:** a linkable, bookmarkable view. "Send me Balaghat's Track A
view" should be a URL, and a refresh should not throw the user back to the
portfolio.

**Today:** `DecisionConsole.tsx:46-48` holds the entire navigation state in React:

```ts
const [selected, setSelected] = useState<MineRow | null>(null)
const [level,    setLevel]    = useState<Level>('portfolio')
const [track,    setTrack]    = useState<'B' | 'A'>('B')
```

Nothing is reflected in the URL. The drill-down and the Track A ⇄ B toggle are
invisible to the router, so the view cannot be linked, shared, bookmarked, or
restored on reload, and the browser back button leaves the console entirely
instead of returning to the portfolio.

**Would need:** routing work — either `/console/[mineId]?track=a` as real routes
or search-param-backed state, plus server-side resolution of the mine id. This
is functionality, not styling.

**Design impact:** moderate. The IA's two-click guarantee still holds; what is
lost is shareability of a specific finding, which matters for a decision-support
tool whose output is meant to be handed to a qualified person.

---

## B-2 — "Warming" and "failed" are indistinguishable

**Design wanted:** a cold backend should read *"Computing — first forecast takes
about a minute"*, visually distinct from *"Forecast unavailable"*. These are
opposite messages: one says wait, the other says something is wrong.

**Today:** `console-api.ts` returns a discriminated result carrying the status
code:

```ts
export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number }
```

but `DecisionConsole.tsx:80` collapses every failure to one literal:

```ts
: 'err'
```

rendered at line 226 as `forecast unavailable`. A 503 from a cold start, a
network error (`status: 0`) and a genuine model failure are the same pixel.

This is why `docs/design/before/console@1280.png` shows all ten mines reading
"forecast unavailable" — the harness waits 1.2s and `/forecast` costs ~96.5s
cold. The screen was not broken; it had no way to say so.

**Partly in scope:** `status` is already available, so the UI *can* separate a
503 from a network error, and this redesign does. What it cannot do is tell a
*warming* backend from a *broken* one.

**Would need:** a backend signal — `Retry-After`, or a `warming: true` flag, or a
readiness endpoint the client can poll.

**Design impact:** high. This is the first screen an evaluator sees, and today it
reports failure while working correctly.

---

## B-3 — No screen-level "data as of"

**Design wanted:** a staleness statement in the app shell — *"Weather measured
2026-09-23 06:00 · operational data synthetic · model v1.4"* — so guardrail (d)
("degrade gracefully and state staleness") is visible on every screen rather
than per-number.

**Today:** the provenance envelope carries `vintage` and `model_version`
**per metric**, which is exactly right and must not change. There is no
aggregate: no endpoint reports the oldest vintage across the sources backing a
screen, so the shell cannot state staleness without fetching every metric and
computing a minimum client-side — which would mean issuing requests purely to
render a caption.

**Would need:** a small read-only aggregate (oldest `vintage`, set of
`source_kind`s, `model_version`) per screen or per mine.

**Design impact:** moderate. Guardrail (d) is still honoured per-number by
`Metric`; what is missing is the at-a-glance statement.

**Explicitly not done here:** the shell will **not** display a hardcoded or
client-guessed timestamp. A fabricated freshness claim is precisely what this
project spent Phase 8 removing.

---

## B-4 — Degraded mode loses nine of ten mines

**Design wanted:** when the backend is unreachable, still show all ten mines with
`--status-unknown`, so the portfolio's shape is preserved and the user can see
what is missing rather than what remains.

**Today:** `mission-control/data.ts:14-16`:

```ts
export const FALLBACK_MINES: MineInfo[] = [
  { id: 'balaghat', numericId: 1, name: 'Balaghat', … },
]
```

One mine. If `/api/admin/mines` fails, the portfolio silently shrinks from ten to
one, and nothing says the other nine are missing rather than absent.

**Would need:** the mine register available without the backend — a build-time
constant or a cached list. It is reference data (names, codes, coordinates,
targets), not measurements, so caching it introduces no fabrication risk; but it
is a data-availability change and therefore out of scope here.

**Design impact:** moderate, and it is an integrity issue as much as a design
one: a shrinking list reads as "ten mines, one at risk" when the truth is "nine
unknown".

---

---

# Defects found during the redesign

Not design gaps — existing bugs the redesign surfaced. Logged rather than fixed,
because this phase makes no backend or API changes.

## DEF-1 — The decision console cannot render a single forecast (pre-existing) — ✅ FIXED 2026-09-24

**Severity: high.** `/console` is the product's primary screen. Every mine on it
reports a failed forecast, and has done since before this branch.

**Cause — two different `/api/v1/mines` answer the same path.**

`frontend/src/app/api/v1/mines/route.ts` is a Next route handler that returns a
hardcoded register and never proxies the backend. It shadows the FastAPI
endpoint of the same path, and the two disagree about the primary key:

```
GET :8000/api/v1/mines   (FastAPI)  ->  { "id": 1,          "mine_code": "MOIL-BAL-01", ... }
GET :3000/api/v1/mines   (Next)     ->  { "id": "balaghat", "numericId": 1, "code": "MOIL-BAL-01", ... }
```

`console-api.ts` fetches the register, then builds
`/api/v1/mines/${mineId}/forecast`. It receives the string id and asks for
`/api/v1/mines/balaghat/forecast`, which the backend cannot resolve:

```
$ curl -o /dev/null -w "%{http_code}" :3000/api/v1/mines/balaghat/forecast?horizon_days=14
503
$ curl -o /dev/null -w "%{http_code}" :3000/api/v1/mines/1/forecast?horizon_days=14
200
```

The Next route carries `numericId`, which is the value the backend wants — so
the data to fix this is already in the payload.

**Pre-existing, verified two ways.** `docs/design/before/console@1280.png`, taken
from `main` before any redesign work, shows the same ten failures. And:

```
$ git show 5c817bb:frontend/src/app/api/v1/mines/route.ts | grep -c "id: '"
10
$ git diff 5c817bb..HEAD -- frontend/src/app/api/v1/mines/route.ts frontend/src/lib/console-api.ts
  (no output — this branch changed neither file)
```

**Why it was invisible before.** The old console collapsed every failure to the
literal `'err'` and printed "forecast unavailable", which reads like missing
data. The redesign prints the status code, so the screen now says
"Forecast unavailable (503)" — and a 503 on every mine is obviously a wiring
fault rather than absent data. The bug did not appear; it became legible.

**Not fixed here.** The fix touches an API route, and this phase is UI/UX only.
It is one line at the call site (use `numericId`) or a decision to delete the
shadowing Next route and let the backend serve the register. Which of those is
correct is an API question, not a design one.

**Consequence for the Stage 1 PR.** `docs/design/after/console@*.png` showed the
console in its real state at that time: correct layout with no forecast values,
because there were none to show.

---

### Resolution — `fix/console-mine-id`, 2026-09-24

`/api/v1/mines` is now a thin proxy of FastAPI's register and the duplicate is
deleted; `MineNumericIdParamSchema` parses the id at the edge; the `|| 1` and
`?? 1` mine defaults are gone. Full reasoning in `docs/DECISIONS.md` D-028.

**Every mine-keyed call from the UI, audited.** Status measured against a
running stack, slug id vs numeric id, before and after.

| # | Call site | Endpoint | Before | After |
|---|---|---|---|---|
| 1 | `console-api.ts:39` `fetchMines` | `GET /api/v1/mines` | **200, wrong shape** — served by a Next handler with slug ids, shadowing FastAPI | **200**, proxied from FastAPI, `id: 1` |
| 2 | `console-api.ts:139` `fetchForecast` | `GET /mines/{id}/forecast` | **503** (slug → `parseInt` → `NaN`) | **200** |
| 3 | `console-api.ts:142` `fetchBacktest` | `GET /mines/{id}/backtest` | **503** | **200** |
| 4 | `console-api.ts:145` `fetchRecommendations` | `GET /mines/{id}/recommendations` | **503** | **200** |
| 5 | `console-api.ts:148` `fetchTelemetry` | `GET /mines/{id}/telemetry` | **200 — WRONG MINE.** `NaN \|\| 1` returned Balaghat for every id | **200**, correct mine |
| 6 | `HotspotEvidence.tsx:85` | `GET /mines/{id}/telemetry` | **200 — WRONG MINE** for any slug outside `SLUG_TO_ID` (`?? 1`) | **200**, or a stated error for an unknown mine |
| 7 | `mission-control/data.ts:50` | `GET /mines/{numericId}/telemetry` | **200**, correct — this path already used numeric ids | **200**, and now throws rather than defaulting to mine 1 |
| 8 | `console-export.ts` CSV / PDF | derived from 2 + 5 | **empty** — nothing upstream resolved | **populated**, with provenance columns |

Bad ids now fail loudly instead of degrading:

```
/api/v1/mines/balaghat/forecast   400   (was 503)
/api/v1/mines/balaghat/telemetry  400   (was 200 with Balaghat's data)
/api/v1/mines/0/telemetry         400
/api/v1/mines/99/forecast         503   (valid id, no such mine — backend's answer)
```

**Drill-down, browser-verified.** Portfolio → mine → Track B / Track A all
render; opening the *second* mine now shows the second mine. `npm run test:e2e`
asserts this and 17 other things, and reports 3/18 against the reverted register.

**Two things this fix did not resolve**, logged rather than papered over:

- The constraint engine's rejection panel is still unexercised —
  `rejected_actions` is empty at all ten mines, so the "rejected with the rule it
  broke" path has never been seen with real data. `docs/DEMO.md` was corrected;
  it had told the presenter to scroll to a block that would not be there.
- `/evaluator` renders a hardcoded feature-importance chart
  (`JudgesArchitectureDeck.tsx:10`) with no provenance. Found while re-checking
  A-7 in a browser; recorded in `docs/READINESS.md` §5 and left for the Stage 2
  redesign, which rewrites that screen.

## Not backlogged

For the record, these were considered and are **in scope**, handled by the
redesign itself:

- Removing the six hardcoded LIVE/ACTIVE/STREAMING labels — deleting a false
  claim needs no new data.
- Removing the count-up in `StatsSection.tsx` — the measured value is already
  available; only the animation goes.
- Distinguishing a 503 from a network error — `status` already exists (B-2).
- A designed 404 and loading state — the framework already renders these; they
  simply had no design.
