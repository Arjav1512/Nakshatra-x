# Decision Log

Why each non-trivial choice was made. Newest first.

---

## D-007 — Preserve response shapes; add provenance alongside
**Phase 1.** The telemetry response feeds several dashboard components. Moving
every scalar into an envelope would have been a wide, risky refactor in the
same change as the security fixes. Instead the existing flat fields are kept
and a parallel `provenance` map plus a `data_integrity` banner are added.
The evidence panel reads `provenance`; components keep working unchanged.
*Trade-off:* two representations of the same value until Phase 6 migrates the
UI. Accepted to keep the security fixes reviewable in isolation.

## D-006 — Nullable fields instead of placeholder numbers
**Phase 1.** Removing hardcoded ore grades and confidence scores left holes.
Filling them with `0` or `"N/A"` would reintroduce a number with no meaning.
Types are widened to `T | null` so TypeScript forces every consumer to handle
"not available" explicitly.

## D-005 — Real STAC query rather than deleting the scene panel
**Phase 1.** The invented scene IDs could have been deleted outright. Querying
Earth Search instead turns a fabrication into a genuine integration for the
cost of one HTTP call, and it is a public API needing no credentials. On
failure the list is empty and `stac_status.error` says why — never a fabricated
identifier.
*Dependency:* none added — plain `fetch`.

## D-004 — Seeded PRNG (mulberry32), not `Math.random`
**Phase 1.** Synthetic operational data is legitimate; MOIL's real data is
proprietary. What was illegitimate was *unseeded* randomness, which made values
change on every refresh while labelled live. Seeding on
`mine | channel | operating-day` gives values that are stable within a day,
reproducible for any day, and satisfy the Phase 2 "same input → same output"
requirement. mulberry32 is ~10 lines inline — no dependency.

## D-003 — `is_live` / `is_synthetic` computed, not passed
**Phase 1.** If callers could set these flags, a future edit could relabel
synthetic data as live — exactly the failure being fixed. They are derived from
`source_kind` inside `envelope()`, so mislabelling requires changing the
provenance module itself.

## D-002 — Fail closed without `SESSION_SECRET`
**Phase 1.** The alternative — falling back to a hardcoded key in production —
reproduces the forgeable-cookie defect with extra steps. In production a
missing secret throws; in development a fixed dev key keeps local work
frictionless. The failure is loud and its message states the fix.
*Trade-off:* deployments must set the variable or session routes return 500.
Documented in `.env.example` and `docs/SECURITY_FIXES.md`.

## D-001 — Rename fabricated models rather than implement them
**Phase 1.** `Prophet-XGBoost-...` and `TreeSHAP-...` named libraries that are
not dependencies and were never called; the code was hand-written arithmetic.
Two options: add the libraries, or rename the code to match what it does.
Renaming was chosen for Phase 1 because it is the honest, non-breaking change
and can ship immediately. A real gradient-boosting forecaster with a
rolling-origin backtest is Phase 4 — added because it is better, not to
retrofit a name.

Note on the attribution rename: the output is an **exact** additive
decomposition of a linear model. That is a stronger statement than a Shapley
approximation, so the honest name is not a downgrade.

## D-008 — Ventilation excluded from the constraint engine (PRD overrides the diagram)
**Traceability.** `SIH26009-Architecture.excalidraw` lists the constraint engine
as "shifts · blasting windows · equipment compatibility · relocation ·
**ventilation**". `SIH26009-01-PRD.md` §4 non-goal 6 makes "mine safety and
ventilation management" an explicit **non-goal**. Per the standing rule that the
PRD wins, ventilation is not implemented as a constraint dimension. The engine
covers shifts, blasting windows, equipment compatibility and relocation
feasibility. Recorded because the omission is deliberate, not an oversight.

## D-009 — A-5 ranks by evidence; expected information gain is optional
**Traceability.** EIG appears only in the diagram's LEGEND as a "★
differentiator" — a [P] proposal. PRD A-5 [D] P0 requires "rank candidate drill
targets **with the evidence that drove each ranking**". Building EIG in place of
evidence-backed ranking would miss the requirement, so ranking + evidence ships
first and EIG is attempted only if Phase 5 has room.

## D-010 — Track A adopts GBT + ordinary kriging, driven by A-4 not by the name
**Traceability.** The PRD names no algorithm for A-3. The diagram specifies
gradient-boosted trees plus a variogram + ordinary kriging resource model, and
PRD §12 describes the work as "mostly gradient boosting, classical
geostatistics". The deciding factor is **A-4** (per-cell uncertainty): kriging
variance yields it directly, whereas the current RandomForest emits only a
probability and a bucket label. Adopted for that reason.

## D-011 — Track A pilot AOI is opencast (Dongri Buzurg), not Balaghat
**Traceability.** PRD §13 Q4 recommends Balaghat for Track B and "an opencast
mine such as Dongri Buzurg" for Track A, because surface spectral work needs
exposed ground — Balaghat works at roughly 383 m depth. Balaghat remains the
Track B pilot per the roadmap; Phase 5 uses Dongri Buzurg.
## D-012 — Conformal intervals calibrated on recent history, not a random split
**Phase 4.** Raw quantile-GBT intervals were badly overconfident: 0.58 empirical
coverage against 0.80 nominal. Conformalising with a random calibration split
only reached 0.66, because conformal prediction assumes exchangeability and time
series violate it — the evaluation window spans the monsoon, when output spread
genuinely widens. Calibrating on the most recent slice of history instead
reached 0.812.

*Scope, added 2026-10-01:* those figures are the pilot mine on its 150-day
window. Portfolio-wide daily coverage is 0.761 [0.733, 0.786] and the 14-day
cumulative distribution is too narrow at 0.738 [0.700, 0.777]. The progression
above is real; the endpoint is not a system-wide calibration claim. See
`docs/CALIBRATION.md`.

*Trade-off:* MAPE worsens from 10.75% to 11.67%, because the temporal split
removes the most recent 25% of samples from the fit. Accepted: an interval that
claims 80% and delivers 66% is worse than useless to a planner sizing a risk,
while 0.9 points of MAPE is not decision-changing. No new dependency —
scikit-learn's `HistGradientBoostingRegressor` with quantile loss, plus about
twenty lines of conformal correction.

## D-013 — One model per mine, with grade as a feature
**Phase 4.** PRD B-5 requires per-mine per-grade forecasts. Fitting a separate
model per (mine, grade) would leave the smaller grades — dioxide is ~4% of
output — with too few rows to fit. Fitting one model per mine with `grade_code`
as a feature keeps forecasts grade-specific while sharing strength across
grades. A test asserts the grades genuinely produce different forecasts rather
than one number relabelled four times.

## D-014 — Plan targets are generated 90 days beyond the actuals
**Phase 4.** A forecast horizon necessarily extends past the last observed day.
With plan targets stopping at the data end, the tail of every horizon had no
target to be measured against and P(shortfall) came out trivially zero — the
forecast looked riskless. Targets now run 90 days forward, which also matches
how a mine plan is actually set: in advance.
## D-015 — rasterio added to read real Sentinel-2 pixels
**Phase 5.** Track A's central defect was that its "spectral" features were a
formula over distance to the mine coordinates. Fixing it requires reading actual
surface reflectance, which requires a raster library; `rasterio` does windowed
reads directly over HTTP so a 5×5 pixel sample costs a range request rather than
a scene download. This is the one heavy dependency added in the whole effort,
and it exists to replace fabricated data with measured data.

## D-016 — Sentinel-2 via Microsoft Planetary Computer, not Earth Search
**Phase 5.** Earth Search (already used for scene metadata) is reachable, but
its raster host `sentinel-cogs.s3.us-west-2.amazonaws.com` is not reachable from
this environment — a range request times out. Planetary Computer serves the same
Sentinel-2 L2A COGs and is reachable. Its per-asset signing endpoint rate-limits
at 429 after ~10 requests, so the collection-level token endpoint is used
instead: one token covers every asset for about an hour.

## D-017 — GSI lithology omitted, not substituted
**Phase 5.** PRD §8.3 names GSI Bhukosh for regional geology and boreholes. Both
`bhukosh.gsi.gov.in` and `geoportal.gsi.gov.in` are unreachable from this
environment. Lithology is therefore **not a feature**, rather than being filled
with a plausible-looking stand-in. It is the single most valuable addition to
this feature set when the portal is reachable, and the spectral-only ablation
(LOMO AUC 0.60) suggests why the geological signal currently looks weak.

## D-018 — Guarded suppression of a spurious BLAS warning
**Phase 5.** `matmul` in the kriging solve emitted divide-by-zero and overflow
warnings, but only inside FastAPI's thread pool and never on the main thread;
the kriging system is well conditioned (condition number ~285) and every value
was verified finite. This is macOS Accelerate setting FP status flags from its
vectorised inner loops. Rather than suppress blindly, the inputs and outputs are
asserted finite around a narrowly scoped `np.errstate`, so a genuine numerical
fault still raises.

## D-019 — Exports are CSV + browser print-to-PDF, no spreadsheet library
**Phase 6.** PRD D-8 asks for "export to PDF/Excel for planning meetings". A
real `.xlsx` writer means a spreadsheet dependency for what is a flat tabular
extract; CSV opens directly in Excel (UTF-8 BOM prepended so ₹ and × survive),
and the browser's own print-to-PDF against a print stylesheet produces a genuine
PDF. No new dependency for either. Every exported row carries `source`,
`source_kind`, `vintage`, `model_version`, `uncertainty` and `is_synthetic`, so
a figure pasted into a deck still states its origin (N-3).

## D-020 — A number cannot be rendered without provenance
**Phase 6.** N-3 sets 100% provenance coverage, which is an invariant, not a
review checklist. The console's `Metric` component is therefore the only way it
renders a number: given no envelope it prints "unavailable", and given a value
with no envelope it prints a visible "PRD N-3 violation" marker. The portfolio
risk strip renders numbers outside a tile, so it carries an inline source badge
for the same reason. This makes an unprovenanced figure hard to ship by
accident rather than relying on discipline.

## D-021 — The face/section level shows grades, not an invented face register
**Phase 6.** D-6 asks for portfolio → mine → face/section drill-down. The
ingestion contract's production grain is (mine × grade × period); there is no
face-level key, and MOIL has not supplied one. Rather than invent a face
register to satisfy the wording, the third level presents the grades actually
being worked plus measured site conditions. When MOIL supplies face-level rows
the contract gains a key and this level deepens without a redesign.

## D-022 — A new console route rather than refactoring mission-control
**Phase 6.** The existing mission-control surface is large and works. The demo
narrative needs one uninterrupted journey wired to the real endpoints, so Phase
6 adds `/console` and leaves the existing screens untouched — targeted change
over a risky rewrite. `/console` has no mock path: every panel calls the service
layer and renders "unavailable" with a reason when it cannot.

## D-023 — Biome replaces ESLint, because ESLint cannot run on TypeScript 7
**Phase 7.** The project had **no working lint command**: `npm run lint` invoked
`next lint`, removed in Next 16, which parsed "lint" as a directory and failed.
ESLint is not a usable replacement here — `eslint-config-next` requires
typescript-eslint, which refuses TypeScript 7 ("typescript-eslint does not
support TS 7.0"), and `@typescript-eslint/parser` will not install against it
either. Downgrading TypeScript to satisfy a linter is the wrong trade. Biome
parses TypeScript natively with no `typescript` dependency and runs the whole
`src` tree in ~50 ms. `tsc --noEmit` stays in the gate and is the stricter type
check.

## D-024 — The backtest is precomputed, not excluded from N-1
**Phase 7.** A rolling-origin backtest refits the model at every origin: 421 s
for the pilot mine. It cannot meet N-1's 2 s, and quietly excluding it from the
latency table would have hidden the miss. PRD N-2 already prescribes the answer
— "nightly batch; on-demand re-run available" — so `python -m app.api.batch
backtest` computes it and writes `backend/artifacts/backtests/*.json`, and the
endpoint serves that artifact. Measured: **421 s of compute → 2 ms served**. The
response carries `served_from` and `artifact_age_hours` so the UI states the
figure's age rather than implying it was just calculated, and a missing artifact
returns 503 with instructions instead of blocking for minutes.

## D-025 — Upstream weather and STAC responses are cached for an hour
**Phase 7.** `/telemetry` measured **4.0 s warm**, missing N-1, because it
re-queried NASA POWER and Earth Search on every request — there were no cached
results for N-1 to apply to. An hourly TTL is correct on the data's own terms,
not a latency trick: NASA POWER daily data changes once a day (and the client
already requests a window ending two days ago), and a Sentinel-2 revisit is
about five days, so the TTL cannot conceal a change that has happened. The
cached payload keeps its original `vintage`, so reported freshness remains the
observation's age, not the cache entry's. Failures are cached for 60 s so an
outage does not make every request pay a full timeout. Result: **4.003 s →
0.003 s warm**.

## D-026 — Nine frontend dependencies removed; one dev dependency added
**Redesign Stage 1.** Verified by import count before removal, not by
assumption:

- `three` (25 MB) and `react-globe.gl` (17 MB) — **zero imports** anywhere in
  `src/`. Dead weight.
- `cesium` (143 MB) and `@types/cesium` — one dynamic import, in
  `components/globe/IndiaMineGlobe.tsx`, which is itself imported by nothing and
  sets `CESIUM_BASE_URL = '/cesium/'`, a directory that does not exist in
  `public/`. The component could never have rendered, so removing it cannot
  regress a capability.
- `framer-motion` (5.6 MB) — its only four import sites were
  `AboutSection.tsx`, `StatsSection.tsx`, `FeaturesSection.tsx`,
  `ui/hyper-text.tsx` and `ui/text-effect.tsx`. All were orphans except
  `text-effect`, whose sole consumer used it for a staggered entrance animation
  the motion policy bans. `StatsSection` additionally animated `0 → value` over
  two seconds, displaying numbers that were never measured.
- `@reactflow/{background,controls,core,minimap}` — zero direct imports; the
  `reactflow` meta-package already installed re-exports them and declares them
  as its own dependencies, so they remain available transitively to the two
  `CausalMindMap` components that do use them.

Added: **`axe-core` (devDependency)**. The redesign's acceptance criteria
require an automated WCAG audit, and axe-core is the engine the criteria name.
It is driven through the existing `puppeteer-core` rather than adding Playwright,
so no second browser-automation stack enters the tree.

## D-027 — `cividis` is the sequential colormap, and colormap stops are the one
permitted colour literal
**Redesign Stage 1.** Continuous quantities on the map and in charts use
`cividis`, sampled from `matplotlib 3.11.2`. The choice is evidentiary rather
than aesthetic: the colormap's source paper (Nuñez, Anderton & Renslow, *PLOS
One* 2018) shows that rainbow/jet maps invent structure the data does not
contain — bright yellow bands read as high values regardless of position — and
that cividis is optimised so viewers with and without colour vision deficiency
interpret it near-identically. Its relative luminance increases strictly across
all nine sampled stops, so it also survives greyscale and print.

The design system forbids colour literals outside `tokens.css`. A colormap is
data, not theme, so its stops are the single documented exception and live in
one module. Two narrower exceptions exist and are commented in place: the
`@media print` block in `globals.css` (a dark token palette cannot be printed),
and `themeColor` in `layout.tsx` (Next serialises it into a `<meta>` tag at
build time, where a CSS custom property cannot resolve).

## D-028 — One mine register, one ID scheme: FastAPI's
**DEF-1 fix.** Two handlers answered `/api/v1/mines`. A Next route handler
returned its own hardcoded register keyed by slug (`id: 'balaghat'`) and
shadowed the FastAPI endpoint of the same path, which keys mines by integer.

The register was chosen as the single source of truth on FastAPI's side, and the
Next route is now a thin proxy with the duplicate deleted. Three facts made this
the small change rather than the large one:

- `MineRow` in `console-api.ts` already declared FastAPI's exact shape
  (`id: number`, `mine_code`, `latitude`, `target_tonnes`). The mismatch went
  unnoticed for the ordinary reason — `get<MineRow[]>` casts `res.json()`
  instead of parsing it, so TypeScript validated a promise, not a payload.
- `console-api.ts` was the only consumer of the endpoint. Mission Control reads
  a different one, `/api/admin/mines`.
- The `MOIL_MINES` constant the route exported was imported by nothing.
  `IndiaSatelliteMap` imports a same-named constant from
  `mission-control/data.ts`.

Keeping the frontend register instead would have meant teaching FastAPI about
slugs, which is the wrong direction: the models are fitted per mine id, and the
register the models were fitted against is the one the UI must read.

**Two failure modes, one cause.** The visible one: `forecast`, `backtest` and
`recommendations` validated the id with a slug-permissive schema and then called
`parseInt`, so `'balaghat'` passed validation and became `NaN` — the backend was
asked for `/api/v1/mines/NaN/forecast` and every call returned 503.

The invisible one was worse. `telemetry` computed `parseInt(id, 10) || 1`, and
`NaN || 1` is `1`, so a request for **any** mine returned **Balaghat's**
telemetry — with `served_by: fastapi`, `live_sources_ok: true` and no
degradation flag. Verified before the fix: `bharweli`, `ukwa` and `gumgaon` all
returned `MOIL-BAL-01`. That is the same defect class this project removed from
`EVIDENCE_DB` in an earlier phase — one mine's data under another mine's name —
surviving in a route's fallback expression rather than in a data file.

`MineNumericIdParamSchema` now parses the id at the edge, so a non-integer is a
400 rather than a silent substitution, and the `|| 1` / `?? 1` defaults in
`telemetry/route.ts`, `HotspotEvidence.tsx` and `mission-control/data.ts` are
gone. A mine that cannot be identified is reported, never guessed: degraded
telemetry now carries `-1` for "unidentified" instead of impersonating mine 1.

**Why it stayed hidden.** Every prior trace of these endpoints used numeric ids
— curl and route-level checks — which is the path that always worked. Nothing
exercised the path the browser actually takes: fetch the register, then use the
id it returns. The regression test added with this fix (`npm run test:e2e`)
drives the console in a real browser precisely so that a green API check can no
longer stand in for a working screen.

## D-029 — A request never computes a forecast; it serves an artifact or says "warming"

`/forecast` fitted a model inside the request. Four consequences, all observed:
a cold request took ~42 s; the request held its `Depends(get_db)` session for
the whole fit, so ten concurrent forecasts held ten idle connections and
`/mines` failed with `QueuePool limit of size 5 overflow 10 reached`; abandoned
requests kept computing, so repeated runs piled work onto the process until load
average reached 98.7 and a 42 s fit took 300 s; and two requests for the same
mine fitted the same model twice.

The rule is now absolute: **no forecast is computed on a request path.** A
request reads a persisted artifact or returns 503 `{status: "warming", eta}`.
Computation happens in a bounded background pool with one flight per mine.

The ten artifacts are committed (176 KB) because the generator is seeded and the
fit is deterministic, so a committed artifact is reproducible from the committed
tree rather than a snapshot of one lucky run. A freshly started backend serves
every mine in milliseconds.

**A bigger pool was not the fix.** The SQLite branch of `session.py` never
applied the configured `pool_size: 20` — it was set only on the else-branch — so
SQLite quietly ran on SQLAlchemy's default of 5. That is now corrected, but the
correction is the belt: the braces are that no request holds a session across a
computation (`resolve_mine_code` reads two strings and closes).

**Thread caps, not more workers.** Two warm workers each threading numpy and
scikit-learn across all cores oversubscribed the machine. Capping per-fit
threads (`OMP_NUM_THREADS` and friends, set before numpy is imported) took a fit
from 42 s to 24 s and left the event loop schedulable, so `/mines` stays
responsive while warming runs.

## D-030 — The synthetic end date is a generation-time parameter, not `date.today()`

A forecast's origin is the last day of generated actuals, so one constant
decides the window every committed artifact covers. Two requirements pull
against each other:

* **Reproducibility.** A committed artifact must be reproducible from the
  committed tree. `date.today()` would change the dataset — and therefore every
  forecast — overnight, on its own, with nothing in git to show for it.
* **Honesty on demo day.** A window fixed at a past date is a past window, and
  the UI must not present it as "the next 14 days".

**Chosen: a parameter with a committed default.** `DEFAULT_DATA_END_DATE`
(2026-09-20) is the committed value; `NAKSHATRA_DATA_END_DATE` overrides it at
*generation* time. Generation stays deterministic given (seed, end date), and
both are recorded in the artifact identity, so an artifact generated for a
different end date is refused rather than relabelled. The demo pre-flight
regenerates the day before (`docs/DEMO.md`, ~4 minutes for ten mines).

The rejected alternative was to label the forecast as a fixed reference scenario
and leave the dates alone. It is honest, and it is what the UI falls back to when
nobody regenerates — but a decision-support tool demonstrating a window that
ended last month invites the obvious question, and "that's a reference scenario"
is a weaker answer than a current one.

**The dates are never shifted without regenerating the forecast.** The console
reads the artifact's own `forecast_origin` and `window`, prints them
("forecast from 20 Sep, covering 21 Sep – 4 Oct"), and when the window has
passed says so in as many words instead of showing the figures as a plan.

## D-031 — Artifact identity covers the whole import chain, not a hand-picked list

Committed artifacts are only safe if they are provably the product of the code
that is running. The first version hashed three files — forecaster, generator,
`track_b` — which was already wrong when it was written: `constraints.py` gates
every recommendation and `schemas.py` defines the rows the generator emits, and
a change to either moves the numbers while leaving the fingerprint, and so the
committed artifacts, untouched.

Identity is now `{model_version, generator_seed, data_end_date, code_fingerprint,
library_versions}`, where the fingerprint hashes every module reachable from the
three entry points (currently eight files) and `library_versions` records the
third-party packages that chain imports — numpy, scikit-learn, pydantic.
scikit-learn's gradient-boosting output is not guaranteed stable across minor
versions, so the version is part of what produced the numbers. pandas is *not*
listed because the forecast chain does not import it; the list is derived from
the imports rather than typed by hand, which is the point.

The chain is walked statically from the source with `ast`, not read from
`sys.modules`: the modules present at runtime depend on what else the process has
touched, and a fingerprint that changed depending on whether pytest had imported
something would be worse than none.

A mismatch means the artifact is refused by `read_artifact`, reported by
`/readyz` with the reason, and recomputed by the warmer. It is never served under
the current `model_version`.

**One inconsistency this found.** `status()` derived freshness from the file's
mtime alone, so an artifact produced by an older model was reported `ready` by
`/readyz` while `/forecast` refused to serve it — the readiness endpoint
promising a green demo the forecast endpoint would not deliver. Both now apply
the same test.

## D-032 — A backend that is still computing is not an unreachable one

The screenshot asked for as evidence of the warming state showed the opposite:
against a genuinely cold backend the console said **"Forecast unavailable — the
FastAPI service layer could not be reached."** The backend had been reached. It
had answered, correctly and quickly, with

```
HTTP/1.1 503  retry-after: 38
{"status":"warming","mine_code":"MOIL-BAL-01","eta_seconds":38.5,"queued_ahead":8, ...}
```

`fetchFromBackend` collapsed every non-2xx into a single error string, so the
Next proxy never saw `status: "warming"` and emitted its own 503 with a fixed
note. Two things were wrong with that. The user was told the system was broken
when it was working as designed — and the note was a claim about the world that
the response in hand contradicted, which is the same failure mode as a
fabricated number, in prose.

`BackendResult` now carries the upstream `status` and parsed `body`;
`warmingPassthrough()` returns the backend's own answer with its `Retry-After`;
and the degraded note distinguishes "answered N" from "could not be reached".

`TrackBPanel` renders a warming state — accent-coloured, with the ETA and the
queue depth — and polls every 8 s until it resolves. The portfolio cards already
did this; drilling into a warming mine did not, so the one screen most likely to
be open during a cold start was the one that called it a failure.

Evidence: `docs/evidence/console-forecast-warming.png` (cold backend),
`docs/evidence/console-forecast-ready.png` (committed artifacts).

## D-033 — Artifacts are checked for completeness, not only for identity

Regenerating the artifacts revealed that the committed forecast for MOIL-BAL-01
— the first mine in the demo — was

```json
{"mine_code": "MOIL-BAL-01", "grades": [], "artifact_identity": {...}}
```

an empty stub with a *valid* identity block. It would have been served as a
complete forecast, and the console would have rendered Balaghat with no grades,
no trajectory and no shortfall.

It came from `test_single_flight_shares_one_computation`. That test waits on the
futures returned by `pool.submit(fs.warm, ...)` — but `warm()` *returns* a
Future, so the outer future resolves the moment the flight is registered, not
when it finishes. The test ended, `monkeypatch` restored the real
`FORECAST_DIR`, and the still-running flight wrote its stub payload into the
committed artifacts. The same race had already left a `MOIL-ABANDON_14d.json`
in the repository, and the runtime `.warm.lock` was tracked as well.

Three changes, because fixing the one test is necessary and not sufficient:

1. The test waits on the inner flights, inside the patched scope.
2. A session-scoped autouse fixture hashes the artifacts directory before and
   after the run and fails if anything changed. The next test to forget a
   `tmp_path` fails loudly instead of silently corrupting the demo.
3. `test_committed_artifacts_are_complete_forecasts` checks every artifact has
   grades, a window, an origin and a full-length dated trajectory. Identity says
   "this came from our code"; it says nothing about whether the code produced
   anything.

`.warm.lock` and `MOIL-ABANDON_*.json` are now untracked and ignored, and a test
asserts the directory tracks exactly the ten real mines.

## D-034 — One dataset identity, shared by every artifact derived from it

D-030 made the synthetic end date a generation-time parameter and put it in the
forecast artifacts' identity. That fixed the forecasts and left a gap: the
backtest artifact recorded only `data_window_end` — no seed, no fingerprint, no
library versions — and the exported sample CSVs recorded only the seed, though
every row in them carries a date out of the generated window.

So the three kinds could disagree. Regenerate forecasts for a new end date and
the committed backtest still claims `MAPE 11.67%` from the old dataset, the
samples still describe the old three years, and a screen showing a forecast next
to that MAPE compares two datasets under one label. **Nothing in the numbers
would look wrong.** That is the whole reason this is a test and not a convention.

`generator.dataset_identity()` is now the shared contract —
`{generator, contract_version, generator_seed, data_end_date}` — carried by all
three kinds. `forecast_store.artifact_identity()` extends it with the per-kind
`model_version`, `code_fingerprint` and `library_versions`.

**One command regenerates everything**: `python -m app.api.batch all` — samples,
forecasts, then the committed backtests — from one resolved end date, verifying
agreement at the end and printing the identity it used. `batch check` answers the
same question without regenerating, and `/readyz` checks it at runtime: a mine
whose artifact disagrees is reported `stale`, not `ready`, and the endpoint is
503.

**Backtests are regenerated for the mines that have a committed artifact**, read
from disk rather than from a list in the code, so the command stays correct when
that set changes. One backtest costs 216 s, so regenerating all ten would be 36
minutes of work for artifacts nothing serves — a mine without one already gets a
clear 503, which is the designed behaviour (the route defaults to
`compute=false`, and the console never overrides it).

**Track A is deliberately excluded.** Its model is trained on real Sentinel-2 and
SRTM data, not on the synthetic generator, so it has no seed or end date to agree
on. Forcing one onto it would be a fiction, and the consistency report says so
rather than leaving the absence to be guessed at.

**Rollback.** The previous set is committed in git, which is the fallback:
`git checkout -- backend/artifacts data/synthetic`. Every artifact — forecasts,
backtests and now the sample CSVs — is written to a temporary file and renamed
into place, so a crashed regeneration leaves the previous artifact intact rather
than a truncated one. `batch all` prints the rollback command if verification
fails.

**A measurement worth recording.** One `batch all` run took **5.8 hours** instead
of the usual 8 minutes, because macOS `mediaanalysisd` had been at 211% CPU for
seventeen hours. The output was byte-identical — same MAPE, same baseline, same
coverage — which is a useful demonstration that the pipeline is deterministic,
and a reminder that the standing "measure in a quiet environment" rule applies to
the machine's own background work, not only to ours. `docs/DEMO.md` now says to
check for this before regenerating.

## D-035 — The provenance guard reads the screen, because grep kept missing things

Every integrity sweep before this one was source-based. The map's six fabricated
layers survived the Phase 8 fabrication sweep *and* Stage 2's silent-default
sweep because their numbers were produced at render time by `sin()` and `cos()`
and never appeared as literals anywhere. They were found by looking at the
screen.

`frontend/tools/provenance-guard.js` (`npm run test:provenance`) walks the
rendered DOM of all 16 routes, finds text shaped like a measurement, and fails if
it is not inside an element carrying `data-provenance`. It clicks through the
map's layer switcher as well, because the original defect was behind one, and a
guard that only read the default view would have missed it for the same reason
every earlier sweep did.

It cannot tell a true number from a false one. What it makes mechanical is the
*absence of attribution*, which is where all of these hid.

**114 unattributed values at the start, 0 now.** Found on the way:

* `/mine-twin` drew a seven-day "Projected Haulage Output" chart from
  `Math.sin(i * 1.2) * 120` around a scalar. Same pattern as the removed map
  layers, same three sweeps survived. Replaced with the real Track B daily
  trajectory, which the forecaster already produces.
* `/mine-twin` seeded `simResult` with `{predicted: 16620, recovery: 2420,
  riskDelta: -0.05}`, so a complete "Digital Twin Result" was on screen before
  anyone pressed the button — and its `catch` block computed a "simulation" in
  the browser from hardcoded multipliers and rendered it through the same cards
  as a real backend result, with nothing to tell them apart.
* `/blending` seeded `blendResult` with a full optimiser solution naming
  "Balaghat High-Grade SP-1 (46.2% Mn)" and "Dongri Buzurg Med-Grade SP-2
  (37.5% Mn)" — ore grades attributed to named MOIL mines, the exact claim
  removed from the map popup in an earlier phase. The *request* payload had been
  corrected then; the seeded *result* was missed.
* `/method` said "725-point spatial grid" and "725 Inferences Computed". The
  model scores **1,710** cells. A wrong number, in prose, contradicting the live
  endpoint, invisible to grep because 725 is a plausible integer in a sentence.
  Now read from the endpoint, as are the AUC and CI that were typed beside it.
* Silent defaults removed: `|| 2420`, `|| 16620`, `|| 14200`, `|| 6240`.
* A comment describing the synthetic 1977-2026 history as "real", which the
  screen then repeated.

**The allowlist has 14 entries, each with a reason** — dates, versions, PRD
references, mine codes, clock times, and window phrases like "past 14 days" that
name the window a figure covers rather than being a figure. An allowlist without
reasons becomes a dumping ground and the guard stops meaning anything.

**Revert-proof.** A worktree at this branch with only `IndiaSatelliteMap.tsx`
replaced by its pre-fix version — everything else identical, so the failure is
attributable to one file — fails with **4,139 unattributed values**, including
`>14,000 T/m (42-46% Mn)`: a per-mine ore-grade band in the map legend.

*Limitation, stated.* I did not get the guard to open the six layers' Leaflet
popups in headless, where the `SWIR Mineral Ratio: 2.19` captions lived: they
need a generated circle clicked while that layer is active and a mine selected.
So the demonstrated catch is the legend's grade claim and the unattributed
register values, not the popup captions themselves.

## D-036 — The landing page's data stack is generated, not drawn

The landing page shows an exploded stack of three layers. Every mark in it is
output from the model that is actually loaded, generated by
`python -m app.ml.export_stack` into a 75 KB JSON: the 50 measured training
points, the kriged prospectivity surface over 1,710 cells, and the kriging
standard deviation for the same cells.

**`AI/outputs/prospectivity.geojson` was the obvious source and is wrong.** It
carries `dist_to_fault_km`, `temp_c` and `rainfall_mm` — features the honest
rebuild dropped because they leaked the labels or do not exist — and has 1,326
cells against the current model's 1,710. It is output from a superseded model,
and shipping it would put the previous pipeline's numbers under this one's name.

**There is no imagery layer, and the page says so.** A Sentinel-2 true-colour
layer means mosaicking L2A scenes across the belt; this pipeline reads bands per
training point, not per tile. A drawn one would be the fabrication the rest of
this work removed.

## D-037 — A mine without a backtest is a designed state, not a failure

A rolling-origin backtest refits the model at every origin: **216 s per mine**.
Only the pilot's artifact is committed, because regenerating all ten would be 36
minutes of demo-day prep for artifacts nothing serves.

For the other nine the console now says so — *"Validated on the pilot mine
(Balaghat)"* — with a link to it, in the ordinary surface colour rather than the
critical one, and with no control in the panel that could start a computation.
The endpoint carries the pilots and their ids so the UI does not hardcode
"Balaghat".

**404, not 503.** 503 promises that a retry will succeed; nothing computes a
backtest on request, so it never will. The artifact does not exist for that
mine, which is what 404 means. It also keeps a designed state out of the 5xx
class the browser regression suite watches — and that suite caught the wrong
code, which is how it came to be fixed.

`npm run test:pilot` asserts the state appears, names the pilot, links to a
rendered backtest, uses no failure language, is not styled as an error, offers
no button, and that no request ever asks the backend to compute one.

## D-038 — Landing figures are read from the same artifacts the console reads

The landing page asserted "LIVE SATELLITE TELEMETRY ACTIVE", "10 Active MOIL
Mining Sites" and "ISRO MOSDAC / BHUVAN ACTIVE" as hardcoded strings backed by
nothing. Stage 1 removed all of it and left the page with no numbers, which was
honest but said less than the work supports.

The numbers are back and none is a literal: the page is a server component that
reads `/api/v1/mines/1/backtest` and `/api/v1/prospectivity/metrics` at request
time, renders them into the HTML, and attributes each with its model version and
vintage. Because both screens read the same artifact, they cannot disagree —
`npm run test:pilot` asserts the landing MAPE equals the console MAPE, and that
the figure is present in the server-rendered HTML rather than appearing after
hydration.

The backtest is cited by name as the pilot mine's, because that is what it is.

## D-039 — Motion rules, and the one that nearly removed the content

GSAP with `useGSAP` and ScrollTrigger, transform and opacity only, native scroll,
`gsap.matchMedia()` for the reduced-motion and small-screen paths. No count-ups —
a number that spins up to its value is theatre applied to a measurement — and no
looping pulses, which read as a live feed when nothing here is live.

One bug worth recording because it is the failure mode of scroll animation in
general: `gsap.from(note, {opacity: 0})` applies its start state the moment the
tween is built, so every annotation on the landing page was invisible until its
ScrollTrigger fired — and in the 1280px capture the trigger never fired, so the
entire annotation column rendered blank. The content was in the HTML and the
motion took it away. `immediateRender: false` fixes it, and
`npm run test:motion` now asserts every annotation is visible before any
scrolling, under both motion and reduced-motion.

## D-040 — Pre-registered ship criterion for the cumulative calibration

**Written 2026-10-01T05:48:10Z, before any dense validation result was read.**
The validation run was 16 of 34 origins in at the time and had written no report
file. This entry is committed before the numbers exist so that the numbers cannot
choose the rule.

**What was already known when this was written**, disclosed because a
pre-registration that hides prior looks is worth nothing:

- The committed backtest artifact on main reports cumulative coverage **0.725**
  and tail frequency **0.175** for the pilot mine, 40 windows at 10 origin dates.
- Inside the conformal slice the same construction reports coverage **0.852** —
  too wide. That contrast is why the third block exists (D-040 mechanism, commit
  `dee2dd3`).
- One sparse run of the *branch's* backtest, same single mine and 10 origin
  dates, reported the uncalibrated arm at **0.825** and the calibrated arm at
  **0.975**. On an instrument whose resolution is 1/40 = 0.025 per window that is
  three windows of movement, which is why it is not being treated as the result —
  but it was seen, and it says the loading may overshoot.
- Per-mine loadings from the full fit: 0.00 to 0.50, three mines at 0.00 because
  their block said the cumulative was already too wide.

### Primary metrics

Pooled across all ten mines, on held-out origins only:

- `coverage_80` of the cumulative 10–90 band, nominal 0.80;
- `pit_at_extremes`, the share of windows in the outer 10% tails, nominal 0.10.

Both are reported as distances from nominal, so "better" is unambiguous:

```
d_cov  = |coverage - 0.80|
d_tail = |tail      - 0.10|
```

### Improvement statistics

Paired on identical windows, loading on versus loading off:

```
Δ_cov  = d_cov(rho = 0)  - d_cov(calibrated)      positive = better
Δ_tail = d_tail(rho = 0) - d_tail(calibrated)     positive = better
```

### Uncertainty — clustered, never binomial

The windows are not independent: consecutive origins share 13 of 14 days, and
every mine is evaluated at the same origin dates, so weather and equipment state
are common across a date's windows. A binomial interval on ~1,156 windows would
claim a precision the design does not have.

So every coverage and tail figure, and every Δ, carries a **95% percentile
interval from a cluster bootstrap that resamples whole origin dates with
replacement** — cluster = origin date, all mines and grades at that date moving
together — 2,000 resamples, fixed seed.

Effective sample size is reported as the design effect against the independent
case:

```
ESS = n_windows x Var_binomial(coverage) / Var_bootstrap(coverage)
```

### Ship criterion

Ship the loading **enabled** only if all of:

1. `Δ_cov >= 0` and `Δ_tail >= 0` — neither metric moves away from nominal;
2. at least one of `Δ_cov`, `Δ_tail` has a 95% CI excluding zero;
3. daily interval coverage and the point forecast are **unchanged** by the
   loading. This holds by construction — the loading never enters `predict` —
   so it is verified as an identity, not as an approximation: MAPE, sMAPE, MAE
   and daily `coverage_80` must be bit-identical between the two arms.

Otherwise: ship the mechanism **disabled**, default loading zero, and report the
result as negative. The measurement script and the three-block split stay either
way, because a negative result that is measurable is worth more than an
unmeasured positive one.

### Pooled versus per-mine loading

Both are evaluated on the same held-out windows. The choice rule, fixed here:

```
Δ_disp = |sd(PIT) - 1/sqrt(12)| for pooled
       - |sd(PIT) - 1/sqrt(12)| for per-mine
```

Per-mine is used **only if** the 95% cluster-bootstrap CI of `Δ_disp` is strictly
above zero — that is, only if per-mine beats pooled by more than the uncertainty.
Otherwise the pooled loading is used, because a single number fitted on ten times
the windows is the more defensible default and ten separate numbers each fitted
on ~100 windows invite exactly the overfitting this entry exists to guard
against.

The `direction` field stays on every mine either way, so the three mines whose
cumulative is already too wide keep saying so rather than showing a bare 0.00.

### Three arms, identical origins

The change is two changes, and they are reported separately:

| arm | what it is |
|---|---|
| `main` | `b045369`, two-block split, no loading |
| `split only` | this branch, three-block split, loading forced to 0 |
| `split + loading` | this branch as it would ship |

`main` versus `split only` is the split's effect. `split only` versus
`split + loading` is the loading's effect. Reporting one number for both would
credit the loading with whatever the split did.

The split changes the quantile fits' calibration inputs, so unlike the loading it
*may* move MAPE and daily coverage. Whatever it does is reported; the model must
still beat the seasonal-naive baseline and daily coverage must stay within the
gap already documented, or the split is wrong too.

### D-040 addendum — the model change was declined (2026-10-01T06:27:17Z)

**Written after the results, which the rule above was written before.** Stating
that plainly matters: everything in this addendum is post-hoc, and the only
reason it is legitimate is the direction it goes.

**The decision: the cumulative calibration does not ship.** The model returns to
`b045369` byte-for-byte.

**Why the pre-registered rule did not settle it.** The rule judged the loading
against `rho = 0` *on this branch*, and by that comparison the loading works:
+0.0355 coverage and +0.0196 tails, both intervals excluding zero. It passed.
What the rule never asked was whether the branch beats **main**, and it does not:

| versus main `b045369` | coverage | tails | PIT dispersion |
|---|---|---|---|
| split only (`rho = 0`) | −0.0331 [−0.0711, 0.0049] | −0.0061 [−0.0466, 0.0306] | −0.0033 [−0.0145, 0.0079] |
| split + pooled (would have shipped) | +0.0025 [−0.0368, 0.0417] | +0.0135 [−0.0196, 0.0453] | +0.0040 [−0.0077, 0.0156] |
| split + per-mine (not selected) | +0.0294 [−0.0061, 0.0625] | **+0.0404 [0.0123, 0.0711]** | **+0.0148 [0.0025, 0.0246]** |

The loading recovers what the three-block split costs, and nets to nothing
measurable. Daily coverage also dips, 0.7607 → 0.7512, with MAPE flat
(10.000% → 10.050%).

**Why this is not post-hoc selection.** Declining to ship keeps the status quo.
A pre-registration protects against choosing the analysis that makes a change
look good; it does not oblige shipping a change whose only measured effect is
added complexity. The asymmetry is the point — the rule can license a change, and
refusing to use that licence costs nothing it was protecting.

**What "disabled" had to mean.** The rule's fallback was "ship disabled with the
mechanism retained". That wording assumed `rho = 0` was neutral. It is not: the
split alone is worse than main by −0.0331 on coverage. So "disabled" could only
mean *main's exact behaviour*, and the cleanest way to deliver main's exact
behaviour is to be main. A flag defaulting to it would need the two-block index
split restored as a second path and the new artifact fields suppressed when off —
a dormant branch whose sole purpose is reproducing main. Reverted instead; the
mechanism is at `dee2dd3` and `cef2801` in this branch's history and every number
it produced is in `docs/CALIBRATION.md`.

**The per-mine result is recorded, not adopted.** It is the one arm that beat
main with intervals excluding zero. It was rejected by the pre-registered
deciding statistic (PIT dispersion, +0.0108, CI [−0.0005, 0.0155]) by 0.0005, and
adopting it now on the strength of metrics the rule did not nominate would be
exactly the move the rule exists to block. It goes to the backlog as a fresh
pre-registered replication on an **independent synthetic seed** — not these
origins, because a result selected on a sample cannot be confirmed on it — judged
against main rather than against `rho = 0`.

**What the rule should have said**, for next time: the comparison that decides is
against the current shipped behaviour, not against a within-branch baseline.

## D-041 — Staleness is identity, not age

An artifact is stale when its dataset identity or code fingerprint no longer
matches the running code, and only then. Freshness used to be a 24-hour window
on the file's modification time, which was wrong both ways: following
`docs/DEMO.md` and regenerating the day before put every artifact past the window
by demo time, so the backend refitted all ten forecasts at startup for
byte-identical numbers under a new `vintage`; and a checkout resets file times,
so artifacts generated weeks earlier counted as brand new.

Three rules follow, each tested in `backend/test_staleness.py`:

- **Identity decides.** `/readyz`, the startup warmer and `batch` all ask the same
  question. Age is reported (`artifact_age_hours`, from the artifact's own
  `vintage`) and `/readyz` warns above 48 h, but neither affects readiness or
  causes a recompute.
- **Identical output is not rewritten.** Every writer — forecasts, backtests,
  calibration, sample CSVs — compares what it would write with what is there,
  ignoring only the generation stamps (`vintage`, `computed_at`, `generated_at`,
  and each sample row's `ingested_at`). Content is compared rather than identity
  alone, so an input the identity fails to capture still reaches disk.
- **`batch` skips what matches.** `--force` recomputes anyway, as a determinism
  check; identical output is still left as it was. The calibration artifact also
  records the harness's own fingerprint, because the harness sits outside the
  forecast's import chain and a change to it would not move `artifact_identity`.

The tile cache manifest is out of scope: it is a download log whose per-run
counts change legitimately, and its date label already comes from the tiles'
own modification times.

## D-042 — An unset end date means the dataset `batch all` last generated

D-030 made the synthetic end date a generation-time parameter, and DEMO.md's
"day before" step regenerates everything for a new one. The cold-start rehearsal
then followed the document word for word and found that the parameter never
reached the server: the pre-flight starts the backend without
`NAKSHATRA_DATA_END_DATE`, and it could not carry it anyway — `$(date +%F)` on
demo day is a different date. So the backend judged every regenerated artifact
stale against the committed default, refitted all ten forecasts for the old,
already-ended window over the new ones, and `/readyz` stayed 503 indefinitely,
because the backtest, calibration and samples still described the new date.
Following the document undid the step it exists for.

`batch all` already records the end date it used, with the rest of the dataset
identity, in `data/synthetic/_dataset_identity.json`. An unset variable now means
that record (`app/core/served_dataset.py`), in the server and in every `batch`
command; an explicit value still wins. The record travels with the artifacts, so
`git checkout -- backend/artifacts data/synthetic` restores the committed default
with them. The module sits outside the forecast's import chain, so no
artifact's code fingerprint moved.

## D-043 — Quantile crossing: what is measured, what is changed, and the rule it must pass

**Written 2026-10-07T11:21Z, before any measurement in this change.** Nothing
below has been run on the fixed code. This entry is committed and pushed before
the crossing count, the fix, or any calibration figure exists, so that the
numbers cannot choose the rule.

### What was already known when this was written

Disclosed, because a pre-registration that hides prior looks is worth nothing.
All of it comes from the read-only diagnosis of 2026-10-07 on main's forecaster
(the code this entry changes), with a script that reproduced the served residual
series exactly:

- **The defect.** On the dataset ending 2026-10-06, Balaghat's 14-day
  block-bootstrap distribution was *narrower* than independent days for all four
  grades (ferro manganese sd 45 vs 106 t); Beldongri for one grade of three; the
  other eight mines not. `test_track_b.py::test_cumulative_aggregation_beats_independent_days`
  failed there and passes on the dataset ending 2026-09-20.
- **The row behind it.** Balaghat dioxide, origin 2026-07-10, target 2026-07-11:
  actual 26.0 t, q10 30.6, q50 33.4, q90 30.6. The three quantile models are
  fitted independently and **crossed**: q90 fell below q50 and onto q10, an "80%
  band" 0.03 t wide with the median outside it. Its log-space sigma 0.000398 gave
  a raw residual of −626.6 and, after dividing by the mine's residual sd, −26.47.
  That sd was 23.67 with the row and 3.24 without it, so every other residual was
  shrunk about 7×. Other crossed rows were visible in the same listing
  (2026-07-09 dioxide q50 40.1 > q90 35.5; 2026-09-29 blast furnace q50 181.0 <
  q10 190.0). The actual is 78% of q50: an ordinary day, not a generated event.
- **Sigma statistics seen.** Balaghat one-step log-sigma, 6 Oct: median 0.0967,
  5th percentile 0.0381, minimum 0.000398. 20 Sep: median 0.1041, 5th percentile
  0.0558, minimum 0.0118. The floor below was chosen with these in view; no
  calibration or coverage outcome of any fixed variant has been seen.
- **Pearson lag-1** of Balaghat's residual series: 0.002 on 6 Oct (rank 0.594),
  0.501 on 20 Sep.
- **The residual series interleaves grades.** It is built from the one-step
  calibration rows of all of a mine's grades, sorted by origin: three or four
  rows per day, not "one observation per origin" as the code comment says.
- **Main's figures** (the comparison point). Dataset ending 20 Sep: 14-day
  coverage 0.738 [0.700, 0.777], tails 0.165, Balaghat 0.667; daily coverage
  0.761 [0.733, 0.786], MAPE 10.00%; pilot backtest MAPE 11.67% vs 14.81%,
  coverage 0.812. Dataset ending 6 Oct: 14-day coverage 0.683 [0.636, 0.728],
  tails 0.208, Balaghat 0.677; pilot backtest 11.00% vs 13.22%, 0.819.

### 1. Measure crossing first, on main's code

`backend/measure_quantile_crossing.py`, on both datasets (ending 2026-09-20 and
2026-10-06), before any fix. For each row (q10, q50, q90) it counts three kinds
of crossing: q10 > q50, q50 > q90, q10 > q90. Reported as counts and shares, in
three places:

- **fit-time calibration rows** — the one-step rows of the served forecaster's
  calibration slice, where the residuals come from;
- **served forecasts** — every mine, grade and horizon 1–14 at the dataset's end
  date;
- **backtest predictions** — the calibration harness's design: 24 origins,
  step 14 days, every mine, grade and horizon 1–14.

For served and backtest rows, both **before** the conformal adjustment (the raw
model outputs) and **after** it (as `predict` returns them: sorted, widened by
the conformal width, clipped at zero). The conformal width can be negative, which
moves the endpoints towards each other and can cross them again.

Reported, not a gate.

### 2. The change — three parts

**F1. Monotone rearrangement** (Chernozhukov, Fernández-Val & Galichon, 2010).
Every row's three predicted quantiles are sorted before they are used for
anything — the conformity scores and the residuals in `fit`, and the interval in
`predict` (which already sorts there). After the conformal adjustment they are
sorted again. Sorting is the monotone rearrangement for three quantiles; it never
moves a quantile further from the truth on average, and it changes nothing on a
row that did not cross.

**F2. A sigma floor, relative to the mine.** In the residual standardisation a
row's log-space sigma is `max(sigma, 0.25 × m)`, where `m` is the median sigma of
that mine's one-step calibration rows after rearrangement.

- **Why 0.25.** It is a guard, not a calibration lever. A band a quarter of a
  mine's typical width is still a confident forecast. One narrower than that,
  from independently fitted quantile models, is far more likely a near-crossing
  than information. The failing row sat at 0.4% of its mine's median.
- **Chosen as a round fraction, before any outcome.** With the sigma statistics
  above in view (Balaghat's only — no other mine's were looked at): 0.25 is below
  the ratio of the 5th percentile to the median on both datasets (20 Sep
  0.0558 / 0.1041 = 0.54; 6 Oct 0.0381 / 0.0967 = 0.39). So for Balaghat it
  touches fewer than 5% of rows on either: a tail, not the body.
- **Never tuned.** If the rule below fails, 0.25 is not adjusted to make it pass.

**F3. Residual blocks by day, not by row.** Each mine's residuals become a table:
one row per target day, one column per grade. A day enters only if every grade
has a residual that day (complete cases); the days dropped are counted and
reported. One standardisation scale per mine, as before.

A simulated 14-day path draws one block of 14 consecutive days (circular), the
same block for every grade of the mine (common draws, one seed). Grade *g* uses
its column. So persistence across days and correlation between grades on the
same day are both what gets resampled.

No served figure today sums grades jointly; the between-grade correlation is
carried for when one does. The code comment that called the old series "one
observation per origin" is corrected.

**Ablation arms**, each measured on both datasets:

| Arm | F1 + F2 (crossing fix) | F3 (day blocks) |
|---|---|---|
| main | — | — |
| crossing fix only | yes | — |
| day blocks only | — | yes |
| both (ships) | yes | yes |

### 3. Acceptance rule — all must hold for "both" to ship

**A1. No crossed interval is served.**
- A test asserts `0 ≤ q10 ≤ q50 ≤ q90` for every mine, grade and horizon of
  every committed forecast artifact, and in every backtest prediction row the
  harness records for "both".
- A browser assertion checks that the forecast chart's median line never
  renders outside its band.

**A2. `test_track_b.py` passes in full on both datasets.**
- In `test_cumulative_aggregation_beats_independent_days` the precondition stays
  **Pearson** lag-1 autocorrelation.
- The series it is computed on changes, because F3 changes what the residuals
  are. It becomes each grade's daily residual series (a column of the day
  table), and the precondition is that the mean over the mine's grades exceeds
  0.2.
- Justification, independent of any result: the old series interleaved three or
  four grades per day. Its lag-1 therefore measured same-day correlation between
  grades as much as persistence across days, and the assertion is about
  persistence across days.
- The statistic is not changed to rank correlation: the outlier is removed by
  F1/F2, not by choosing a statistic it cannot move.
- "Correlated aggregation is wider than independent days, for every grade" stays
  a separate assertion, unchanged.

**A3. The 14-day calibration is no worse than main's on either dataset.**
- **Measured with** the existing harness, unchanged in design: span 340 days,
  step 14, 24 origins, all mines, the shipped arm.
- **Compared** paired on identical (origin, mine, grade) windows, with the
  distances of D-040:
  ```
  Δ_cov  = |cov_main − 0.80| − |cov_branch − 0.80|      positive = branch closer
  Δ_tail = |tail_main − 0.10| − |tail_branch − 0.10|
  ```
- **Intervals** are 95% cluster-bootstrap intervals over origin dates (2,000
  resamples, fixed seed).
- **The rule:** "both" fails if, on either dataset, either interval lies
  entirely below zero — the branch shown worse.

**A4. Daily marginals.**
- q50 is unchanged from main on every daily row where main's raw quantiles did
  not cross. The number of rows whose q50 changed must not exceed the number of
  crossed rows.
- The intervals' endpoints may move everywhere, because the conformity scores
  are computed from rearranged quantiles. Daily coverage is therefore compared
  paired on identical (origin, mine, grade, horizon) rows, with the same
  cluster-bootstrap rule as A3 on `|coverage − 0.80|`.
- Daily MAPE is reported.

**A5. No single residual dominates.** On both datasets, for every mine, removing
the day with the largest absolute standardised residual from the table changes
each grade's simulated 14-day sd (seeded, at the end-date origin) by less than
5%.

**A6. Sanity across end dates.** Eight datasets:
- **The end dates:** 2025-12-15, 2026-01-31, 2026-03-15, 2026-04-30,
  2026-06-15, 2026-07-31 — spread over a year, monsoon included — plus
  2026-09-20 and 2026-10-06.
- **Per date,** with the forecaster fitted at the end date:
  - (i) every mine and grade: correlated 14-day sd ≥ 0.9 × the independent-days
    sd ("never pathologically narrower");
  - (ii) at least 80% of (mine, grade) pairs have P(shortfall) in
    [0.001, 0.999] ("no saturation" — the original bug put nine of ten at
    1.000);
  - (iii) every mine: the residual scale changes by less than 10% when its single
    largest absolute raw residual is removed ("no single-residual domination").
- **Where it runs** — decided by measurement, by this rule: if the check takes
  at most 6 minutes on this 8-core machine (about 15 on a CI runner, at the 2.5×
  ratio measured for Track B), it is a CI job on every pull request. Otherwise it
  runs nightly on a schedule.

**A7. The ablation is reported** for both datasets: every arm's 14-day coverage
and tails with intervals, daily coverage and MAPE. Not a gate.

### Amendment to A4 — written after part 1's counts, before any measurement of the fix

**Written 2026-10-07T11:49Z.** Part 1 had run (`docs/QUANTILE_CROSSING.md`); no
fixed variant had.

A4's first clause said q50 may change only where *main's raw quantiles* crossed.
But part 1, in this same entry, defines crossing in two places: in the raw
outputs, and after the conformal step. On main the conformal step produced
crossed intervals of its own — 2 backtest rows of 11,424 on 20 Sep and 16 on
6 Oct. Read literally, A4 would count reordering one of those, which is
precisely the fix, as a violation.

A4 now reads: q50 may differ from main's only on a daily row where a crossing
entered it. That means one of:
- its raw quantiles crossed;
- main's returned interval was crossed after its conformal step;
- the branch's interval crossed after its conformal step, before the second
  sort.

The harness records the first and the last for every daily row, and main's
records show the second. The count of rows whose q50 changed for any other
reason must be zero. Nothing else in A4, or anywhere in D-043, changes.

### Amendment 2 — which arm ships, and what the checks measure

**Written 2026-10-07T12:16Z, while the formal measurement was running and before
any of its output was read.** The runs started at 11:57Z
(`scratchpad/d043/runs/run_all.sh`: harness × four arms × two datasets, then
`test_track_b.py` on both datasets, the multi-date and artifact tests). No
output file or log of it had been opened; only the start line of its progress
file, for the time above.

**Seen before writing this, and disclosed:** the Balaghat smoke result recorded
in `12f9c4d`.
- With both switches on, 6 Oct: max |z| 6.03, but three grades' 14-day spread
  is still narrower than independent days, and per-grade day lag-1 is −0.14
  to 0.05.
- On main's construction, the interleaved series' lag-1 of about 0.5 is mostly
  same-day correlation between grades (0.68–0.81); per-grade persistence across
  days is 0.02–0.30.
- Both suggest "both" may fail A2 and A6.

**What P(shortfall) is computed on.**
- **Per grade.** Each grade's 14-day total is simulated against that grade's
  plan target. The mine card shows the worst grade's figure.
- **The mine total** carries expectations only — summed means, no
  distribution — so no served figure today depends on the correlation between
  grades.
- **Every acceptance check is per grade** (A2–A6), on (origin, mine, grade)
  windows or each mine's grades, never mine totals.
- **If a mine-total distribution is ever served,** the same-day correlation
  between grades is real for it and must be kept. F3's common draws keep it,
  and any arm without them must not be used for that.

**Which arm ships.**
1. **The arm that passes every acceptance criterion against main on both
   datasets ships.**
2. **If several pass, the simplest:** crossing fix only, then day blocks only,
   then both.
3. **If none passes, served P(shortfall) is not changed,** and the result is
   reported as negative. The user-visible guarantee and its tests still ship:
   - `predict`'s sort after the conformal step;
   - the artifact test and the browser assertion (A1).

   That sort touches no fitted quantity (conformity scores, widths, residuals),
   and at the served end dates on both datasets no interval was crossed after
   the conformal step (part 1). So served P(shortfall) is unchanged by it.

**How each criterion reads for an arm other than "both"** — the same
statistics, applied to what that arm actually does:
- **A1:** the arm's backtest rows in its harness run must be uncrossed.
- **A2:** `test_track_b.py` in full with the arm's switches, set by a pytest
  plugin that changes the forecaster's defaults, not the code.
  - The precondition is the same statistic for every arm: the mean over grades
    of the Pearson lag-1 of each grade's column of `residual_days` (every arm
    builds it), above 0.2. It asserts persistence across days, whatever series
    the arm resamples, and the interleaved series' own lag-1 is now known to
    measure something else.
  - "Wider than independent for every grade" uses the residuals the arm's
    aggregation uses (`residual_block`).
- **A3, A4:** the arm's harness run paired with main's.
- **A5:** for an arm without day blocks, the largest day's rows are removed
  from the interleaved series it resamples.
- **A6:** `test_track_b_dates.py` with the arm's switches, by the same plugin.

**If A2 or A6 fails on the persistence premise,** it is reported as negative and
nothing above is adjusted. The question it raises gets its own change, with its
own pre-registration: whether the dependence that matters for a 14-day total is
the correlation across horizons 1–14 within one origin's forecast path, rather
than one-step residual persistence — and whether that explains the 2.5–3.4×
understatement of cumulative spread measured in #20.

### If the rule fails

"Both" does not ship as it is. The failure is reported with its numbers; neither
0.25 nor any threshold above is adjusted. A different fix is a new entry, written
before it is measured.

### After it passes

- Regenerate every artifact: the forecaster changes, so the code fingerprint
  moves.
- Re-measure the calibration figures. They were computed with crossed quantiles
  in the data, so they are expected to move; the new numbers are stated.
- Freeze the pitch dataset on 2026-10-06 — yesterday, the latest end date
  docs/DEMO.md permits — and write docs/PITCH_FIGURES.md from it.

### Result — no arm passed; served P(shortfall) unchanged

Measured 2026-10-07 by the rule above and both amendments. All the figures are
in `docs/QUANTILE_CROSSING.md` §2.

- **crossing fix only:**
  - **passes** A1 and A3: 14-day coverage 0.738 → 0.812 and 0.683 → 0.770;
    tails 0.165 → 0.105 and 0.208 → 0.110;
  - **fails** A2 (per-grade daily persistence 0.126 / −0.035), A4 on 20 Sep
    (daily coverage 0.761 → 0.756, CI [−0.0077, −0.0031]), A5 and A6.
- **day blocks only:** fails A1, A2, A3, A5 and A6.
- **both:** fails A2, A3, A4 (20 Sep), A5 and A6.

**What shipped,** as amendment 2 says:
- nothing that changes served P(shortfall): `rearrange` and `day_blocks`
  default off, and the regenerated artifacts match main's figure for figure;
- the interval guarantee: `predict` sorts after the conformal step, plus the
  artifact test and the browser assertion.

**What the measurement established.** The block bootstrap's premise does not
hold: one-step residuals carry little persistence across days. The apparent
persistence of the interleaved series was same-day correlation between grades.
Main's construction fails the sanity checks on all eight datasets measured.
These are recorded as strict xfails (`test_track_b.py`,
`test_track_b_dates.py`).

**No pitch dataset is frozen.** The follow-up — dependence across horizons
1–14 within a forecast path, per grade and for mine totals, and whether it
explains #20's 2.5–3.4× gap — is its own change, with its own pre-registration.

## D-044 — P(shortfall) is withdrawn from the stage, and the freeze rule is amended

**Written 2026-10-07T20:24Z (2026-10-08 01:54 IST), before the freeze dataset
was generated and before any check was run on it.** This entry is committed and
pushed before `batch all` runs for the new date. D-043 found the 14-day
aggregation behind P(shortfall) unsound on every dataset measured, and no fix
has passed. Until one does (D-045, next), the console stops presenting it, and
a figure that is not presented no longer holds up the freeze.

**Seen before writing this, and disclosed:**
- the committed forecasts (dataset ending 2026-09-20): every mine's worst-grade
  P(shortfall) is between 0.88 and 1.00, and the per-grade and mine-level
  expected shortfalls quoted below;
- everything in D-043 and `docs/QUANTILE_CROSSING.md`.

Nothing has been generated or measured on the dataset this entry freezes.

### 1. Hidden, not labelled

The other option was to keep the figure on screen, marked "under validation —
not calibrated". It is hidden instead, because:

1. **The defect has no direction a reader could allow for.** It is not a known
   bias of known size. On the eight datasets D-043 measured, the 14-day
   distribution was:
   - narrower than independent days on five, which makes P overconfident;
   - saturated on two;
   - moved by 10% or more by a single residual on all eight.

   Next to a label, 0.97 still reads as 0.97, and nobody can say whether the
   truth is higher or lower.
2. **A number on a projected screen travels without its label:** in a photo, in
   a judge's notes, in the CSV export.
3. **It ranks almost nothing.** Worst-grade P is between 0.88 and 1.00 on all
   ten mines in the committed forecasts. The tonnes already order them.
4. **Hiding costs the follow-up nothing.** The API still computes and serves
   `p_shortfall` and `delta_shortfall_probability`, unchanged. D-045 compares
   against exactly the construction main serves, and putting P back is a
   console change made after a pass.

**What leaves the screen:**
- every P(shortfall), on the portfolio cards, the mobile summary, the mine's
  answer row and the per-grade chips;
- the risk band (colour, and high / elevated / low), which was a set of
  thresholds on P;
- ΔP(shortfall) on corrective actions, which is derived from P;
- the 14-day calibration panel, which described P's distribution.

Where P was, the console says it is withdrawn while under validation, shows no
number, and links to `docs/QUANTILE_CROSSING.md`. No other figure derived from
the 14-day distribution is displayed: the cumulative p10 and p90 never were.

### 2. What the console presents instead

**The focal number is expected shortfall in tonnes, summed over grades:**
Σ over grades of max(0, plan − expected production).

It is not the mine-level figure in the API's `portfolio` block, which is
max(0, Σ plan − Σ expected). That one lets a surplus in one grade cancel a
deficit in another, and PRD §3 says grades are not fungible. The console's own
grade panel says the same. On the committed forecasts the two differ at four
mines:

| Mine | Netted (served today) | Summed over grades |
|---|---|---|
| Beldongri | 0 t | 0.5 t |
| Gumgaon | 0 t | 10.2 t |
| Mansar | 128.0 t | 150.5 t |
| Chikla | 164.4 t | 169.9 t |

The sum is computed in the console from the per-grade figures the API serves.
No fingerprinted module changes, so no artifact moves because of it.

**It sits with the daily 80% intervals, as now, and their measured
calibration.** That calibration replaces the 14-day panel:
- daily coverage across all ten mines, and for the open mine, each with its 95%
  cluster-bootstrap interval;
- read from the calibration artifact's `daily` block, which is already served.

**Why expected shortfall can be shown when P cannot.** It is a mean. By
linearity it does not depend on how the days are correlated, which is the
premise D-043 falsified; it depends only on each day's marginal distribution. A
check is added for this, below, so it is tested rather than argued.

### 3. The freeze rule, amended

This replaces `docs/DEMO.md`'s "a dataset a test fails on is not frozen":

- **A dataset is frozen when every check covering a presented figure passes on
  it.**
- **Figures that are not presented don't block a freeze.** If a check covering
  only withdrawn figures fails on the frozen dataset, that failure is recorded,
  not loosened:
  - it is marked strict xfail, conditioned on that dataset's end date only;
  - its assertion and threshold are unchanged;
  - its failure message is quoted in the PR.
- **P(shortfall) and the 14-day cumulative figures** — coverage, interval,
  tails, and each mine's 14-day coverage — **are excluded from
  `docs/PITCH_FIGURES.md` until a fix passes its pre-registered test** (D-045).
  A test enforces the exclusion, so a figure cannot drift back in unnoticed.
- **The strict xfails already in place stay as they are.** If one of them passes
  on the frozen dataset (it is strict, so CI fails), that is reported, and the
  freeze is not committed in this change.

**Presented figures, and the checks that cover them** — all must pass on the
frozen dataset:

| Presented | Checks |
|---|---|
| Expected shortfall (tonnes), plan target, expected production | `test_track_b.py`: grade-aware, no future information, and the new check below; `test_served_intervals.py`; `batch check`; `test:e2e`, `test:dates`, `demo-walk` |
| Daily 80% intervals | `test_served_intervals.py`; `test:band` |
| Daily calibration (portfolio, each mine) | `test_calibration_harness.py`; `batch check`; `pitch-check` |
| Pilot backtest: MAPE vs baseline, daily coverage | `test_track_b.py::test_backtest_gbt_beats_baseline_and_is_calibrated`; `pitch-check` |
| Corrective actions | `test_track_b.py` constraint tests; `test_api*.py` |
| Track A AUC, CI, ablation | `test_track_a.py`; `pitch-check` |
| Anything rendered | `provenance-guard`, `test_api_provenance.py`, `lint:literals` |

The rest of the backend suite and the browser console group run too, as on any
change.

**Withdrawn figures, and their checks** — these don't block the freeze:
- `test_track_b.py::test_shortfall_probability_is_a_probability`;
- `test_track_b.py::test_cumulative_aggregation_beats_independent_days`;
- `test_track_b.py::test_backtest_reports_cumulative_calibration`;
- `test_track_b.py::test_residuals_persist_across_days`, already a strict xfail;
- `test_track_b_dates.py`, strict xfails on fixed dates, so unaffected by the
  freeze.

**The new check.** On the frozen dataset, for each of the pilot's grades:
- compute the exact expectation of the 14-day total, Σ over days of the mean
  over residuals r of exp(μ_d + σ_d r);
- the served `expected_cumulative_tonnes` must lie within four Monte Carlo
  standard errors of it, plus 0.05 t of rounding. The standard error is the
  sd of the same 4,000 paths divided by √4000.

Four standard errors, and not a tolerance tuned to the data: a correct
implementation fails it about once in 16,000 grades.

### 4. The freeze

- **End date: 2026-10-07**, the latest DEMO.md permits (yesterday, IST). The
  forecast window is 8–21 October 2026.
- **One date.** It was chosen before anything was generated, and no other date
  will be tried. If a check covering a presented figure fails, nothing is
  frozen and the failure is reported.
- **`docs/PITCH_FIGURES.md` will hold:**
  - the pilot backtest: MAPE against the baseline, daily coverage, predictions,
    origins;
  - across all ten mines: daily coverage with its 95% interval, and daily MAPE;
  - Balaghat's daily coverage with its 95% interval, from the calibration
    artifact;
  - Track A: leave-one-mine-out AUC with its 95% interval, the ablation, and the
    random split for contrast.

### Result — frozen on 2026-10-07

Generated 2026-10-08 with `batch all` for the one pre-registered date.

**The first run was stopped.** It was killed at the one-hour background limit
after eight forecasts. From the sixth on, each fit took 15–22 minutes instead
of about 24 s, with swap at 7.5 of 8 GB. The machine was paging, not the code
looping. The re-run, in a fresh process, skipped the eight forecasts already
written for this date and fitted each remaining one in 26–28 s. It finished in
944 s with every artifact verified on one dataset. The run dumped Python stacks
every ten minutes; the one dump fell inside the calibration subprocess, and
nothing hung.

**Checks covering presented figures:**
- `batch check` passes.
- The fast backend suite fails twice; both are covered below.
- `test_track_b.py`: 12 passed, 1 xfailed. The xfail is the strict one already
  in place, still failing as recorded. The new expected-shortfall check passes
  on every grade, with differences of 1.05–6.60 t against allowances of
  4.35–13.59 t. The backtest test gives MAPE 10.52% against 13.55%.
- `test_track_b_dates.py`: 10 xfailed. The dates are fixed, so the freeze cannot
  change it.

**Checks covering withdrawn figures** — wider-than-independent, and the
backtest's cumulative calibration — both *pass* on this dataset. No new strict
xfail was needed.

**The two fast-suite failures:**
1. **`test_pitch_figures.py`**, as expected before `batch pitch` rewrote
   `PITCH_FIGURES.md`. It passes after.
2. **`test_served_dataset.py::test_the_committed_record_is_the_committed_default`.**
   It pinned the committed dataset record to the generator's built-in default
   (2026-09-20). Any committed freeze breaks that, because DEMO.md step 5
   commits the new record. No freeze had been committed before, so nothing had
   hit it.

   **Restated after seeing the failure, and disclosed as such.** It now asserts
   what D-042 needs: the record and every committed artifact name one dataset.
   It fails on a record that disagrees with the artifacts, which was checked by
   pointing it at a 2026-09-20 record. The other option was to move the default
   in `generator.py`. That module is fingerprinted, so every freeze would have
   invalidated every artifact.

**What moved:**

| | 20 Sep dataset | Frozen (7 Oct) |
|---|---|---|
| Pilot MAPE | 11.67% | 11.50% |
| Pilot baseline MAPE | 14.81% | 12.85% |
| Pilot daily coverage | 0.812 | 0.806 |
| Portfolio daily coverage | 0.761 [0.733, 0.786] | 0.785 [0.761, 0.808] |
| Balaghat daily coverage | 0.792 | 0.802 [0.742, 0.862] |

The portfolio interval now includes 0.80, so the console's verdict reads
"consistent with nominal". The docs say "close to calibrated", not
"calibrated", because the previous window was below it.

**Withheld, but measured on this dataset:** 14-day coverage 0.717
[0.680, 0.749], tails 0.163.

**The grade sum matters more here than on the committed forecasts.** Balaghat
nets to 18.3 t against 95.5 t summed over grades, and Bharweli to 374.0 t
against 746.0 t.

**P(shortfall) contradicts its own mean.** Chikla's worst-grade P(shortfall) is
0.968 while its expected shortfall is 0 t in every grade.

### At the source (#31)

The summed figure moved from the console into the API.

- **What is served:** `track_b.mine_shortfall_tonnes` sums each grade's own
  max(0, plan − expected), and the forecast's `portfolio.expected_shortfall_tonnes`
  is that sum. The netted figure is not served under any name.
- **The recommendation engine sizes its actions from it.** Balaghat's
  candidates are now sized from 95.5 t, not 18.3 t.

`track_b.py` is fingerprinted, so every artifact was regenerated on the same
frozen date, 2026-10-07, in 1,116 s, each forecast fitted at its usual 24–28 s.
Compared with main value for value, ignoring only identity and timestamp
fields:

| Mine | Netted (main) | Summed over grades |
|---|---|---|
| Balaghat | 18.3 t | 95.5 t |
| Bharweli | 374.0 t | 746.0 t |
| Gumgaon | 64.4 t | 68.9 t |
| Ukwa | 134.9 t | 136.7 t |
| Beldongri | 109.6 t | 109.5 t |
| Kandri | 160.8 t | 160.7 t |

- **What moved:** only these six mines' `portfolio.expected_shortfall_tonnes`.
  The last two differ by 0.1 t: grade figures rounded before they are added. Each
  is the figure the console already showed.
- **Nothing else moved:** not the backtest, the calibration, any other forecast
  field, the sample data or Track A.
- **`PITCH_FIGURES.md` changed in three lines only,** the code fingerprint
  (b69dccc782e56f1f → 2728774fd1d66412). `pitch-check` compares identity as well
  as values, so it would fail otherwise. Every figure row is unchanged. This is
  not a re-freeze: same date, same figures.

**The memory check was not passing during the run,** and the run went ahead
anyway, disclosed. `scripts/check_memory.sh` reported pressure "warn" with 43%
free.
- **Why it went ahead:** the output is seeded, so memory changes how long it
  takes, never what it produces, and every value was compared with main.
- **How it was watched:** a sampler logged the process's memory and swap every
  20 s. The process held at most 0.53 GB, so it was not accumulating memory
  itself; the paging on 2026-10-08 came from the rest of the machine.
- **What it showed about the guidance.** Swap grew from 8.5 to 10.0 GB during
  this run, while every forecast fitted in 24–28 s. So DEMO.md's mid-run signal
  is the per-forecast time `batch all` prints, not swap. The first draft of
  that guidance used swap growth. DEMO.md's draft was corrected before it was
  committed; the script's comment had already been committed (`2bdc703`) and is
  corrected in a later commit.

## D-046 — The committed artifacts are guarded at the write, not at each caller

*(D-045 is the number reserved for the P(shortfall) follow-up, referenced before
this was written, so this entry precedes it in the file.)*

**The class:** a write into the committed artifacts — `backend/artifacts/`, the
set the demo serves — that nobody chose. This is the fourth occurrence:

1. **D-033.** A test's still-running warm flight wrote an empty Balaghat stub,
   with a valid identity, into the committed set.
2. **`backend/conftest.py`.** The test client's startup warmer overwrote two
   committed forecasts (TIR-04 and UKW-03), and the guard of the time hashed
   too early to see it.
3. **D-042.** The backend, started without the end date, refitted all ten
   forecasts for the old, ended window over the new ones.
4. **#31.** A script that imported `app.api.track_b` built the generator's
   default dataset (2026-09-20), because only `app.main` adopts the record.
   Asking for Balaghat found no matching artifact, and the warmer wrote a
   20 September forecast over the frozen 2026-10-07 file. A value-for-value
   comparison caught it, and `batch all` restored it before anything was
   committed.

**Each fix guarded the caller that had just failed:**
- tests got a session copy and a hash that waits for flights;
- the server and `batch` adopt the record;
- scripts got nothing, which is how the fourth happened.

A fifth caller would be unguarded again. Every writer passes through one place
— the write — and one file says which dataset the committed set serves:
`data/synthetic/_dataset_identity.json`. So the rule lives there, and no longer
depends on each caller resolving the served dataset correctly.

**The rule** (`app/core/artifact_guard.py`):
- **Before anything is written under `backend/artifacts/`,** its dataset
  identity — generator, contract, seed, end date — is compared with the record.
  That covers a forecast (`forecast_store.write_artifact`), the backtest
  (`track_b.compute_backtest`) and the calibration
  (`measure_cumulative_calibration.py`). A mismatch raises
  `ArtifactWriteRefused` naming both datasets and the one command that moves the
  committed set. Nothing is written silently: `batch` prints a `REFUSED` line
  and stops, and the warmer logs it.
- **The record moves only through `batch all` with an explicit
  `NAKSHATRA_DATA_END_DATE`.**
  - `export_samples` checks before it writes any sample or the record, so a
    refusal leaves both as they were.
  - `batch.main` reads whether the date was set by the caller *before*
    adopting the record, because adopting sets the variable.
  - With an explicit date, `all` writes the record first, so every artifact
    written after it matches.
- **Computing for another date is still allowed.** The warmer keeps a refused
  forecast in memory, and `forecast_mine` serves it when no artifact matches.
  In a process serving the recorded dataset — every app and `batch all` run —
  nothing is ever refused, so nothing there changes.

**What it does not catch,** said plainly. It compares *dataset* identity, so a
write for the recorded dataset passes it whoever makes it. Occurrences 1 and 2
came from test processes. Those stay covered by the conftest's session copy and
hash, and by D-033's completeness check: an empty stub with a valid identity
passes a dataset comparison. Writes outside `backend/artifacts/` — a test's
temporary copy, a calibration `--out` — are not its business.
`docs/PITCH_FIGURES.md` is a document, checked by `pitch-check`.

**The guard is in the forecast's import chain, deliberately.** It decides what
reaches the committed set, so it is part of the code fingerprint
(`2728774fd1d66412` → `26668cae85f17dfc`). That moved every artifact's identity,
so `batch all` regenerated the set on the frozen date, 2026-10-07, with an
explicit date. It is also the sanctioned path, run end to end under the guard:
1,184 s, no refusal, no failure.
- **Nothing moved:** compared with main value for value, ignoring identity,
  timestamps and the calibration's harness fingerprint, nothing moved — the
  forecasts, the backtest (MAPE 11.50% against 12.85%, coverage 0.806), the
  calibration, the samples, and Track A.
- **`PITCH_FIGURES.md` changed in its three code-fingerprint lines only.**
- **The memory check reported "warn" (41% free)** and the run went ahead,
  watched by its per-forecast times: 25–31 s each.

**Tests** (`backend/test_artifact_write_guard.py`):
- **The rule:**
  - a write for another dataset is refused, naming both;
  - one for the recorded dataset passes;
  - other paths are ignored;
  - the record moves only when allowed;
  - only an explicit date sets the flag.
- **End to end,** in a subprocess against a temporary copy of the code, the
  artifacts and the record:
  - **the #31 incident step for step.** On main (`a8c5ed1`) it overwrites the
    committed Balaghat forecast; here it is refused, and the forecast is served
    from memory for 2026-09-20.
  - **`batch all` through its own entry point,** narrowed to one mine, with an
    explicit new date. The record moves, and the forecast is written for that
    date; `batch forecast` with the same date and no record move is refused.
  - **the app**, warming a deleted forecast and writing it for the recorded
    dataset.
