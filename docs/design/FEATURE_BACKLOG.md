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
