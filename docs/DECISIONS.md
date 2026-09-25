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
