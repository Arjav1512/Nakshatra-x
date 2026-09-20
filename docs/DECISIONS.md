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
