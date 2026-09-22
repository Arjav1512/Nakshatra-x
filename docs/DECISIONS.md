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
