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
