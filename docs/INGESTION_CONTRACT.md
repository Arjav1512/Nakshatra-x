# Ingestion Contract v1.0.0

**Status:** published · **Contract version:** `1.0.0` · **Working CRS:** `EPSG:32644` (WGS 84 / UTM 44N)

---

## Why this document exists

PRD §8.2 identifies data access as the central feasibility constraint of this
project:

> MOIL's borehole logs, assay databases, block models, HEMM downtime records and
> blasting logs are **proprietary and not publicly available**. No dataset was
> found attached to this PS.

and prescribes the response:

> The system must be built against a **documented ingestion contract** — a
> published schema that MOIL can map its real data onto. **The contract is a
> deliverable in its own right.**

This is that contract. It defines seven entities covering PRD **A-1**
(geological inputs) and **B-1, B-2, B-3** (production, equipment, blasting).
Until MOIL supplies real data, a calibrated generator fills the same schemas and
every row is flagged.

> PRD §8.2 on how to present this: *"A team that says 'here is the exact schema
> MOIL plugs into, here is our synthetic generator calibrated to published
> production figures, and here is what changes when real data arrives' is more
> credible than one implying it has data it does not."*

---

## The seven entities

| Entity | PRD | Grain | Rows in the sample dataset |
|---|---|---|---|
| `borehole` | A-1 | one per drill collar | 120 |
| `assay` | A-1 | one per downhole interval | 6,546 |
| `lithology` | A-1 | one per logged interval | 1,192 |
| `production_by_mine_grade_period` | B-1 | **(mine × grade × period)** | 37,264 |
| `equipment_event` | B-2 | one per event, not a daily roll-up | 796 |
| `blast_record` | B-3 | one per blast | 10,907 |
| `plan_target` | B-6 | (mine × grade × month) | 1,258 |

JSON Schema for each is published under [`docs/schemas/`](schemas/), plus a
combined bundle at `docs/schemas/ingestion-contract.schema.json`. Sample CSVs
are under [`data/synthetic/`](../data/synthetic/).

### Fields every row carries

```jsonc
{
  "contract_version": "1.0.0",   // schema version this row was written under
  "is_synthetic": true,          // REQUIRED — no default. See below.
  "source": "nakshatra-synthetic-v1",
  "ingested_at": "2026-09-21T..."
}
```

**`is_synthetic` has no default.** A producer must state it. This is deliberate:
a dataset that cannot say which rows are real is not usable for a decision a
mine manager has to defend, and PRD N-3 requires every displayed number to carry
its provenance. Generator output sets it `true`; MOIL's own exports set it
`false`, and the flag flows through to the UI.

### Grade is first-class

`production_by_mine_grade_period` and `plan_target` are keyed by `grade`
(`ferro_manganese`, `silico_manganese`, `blast_furnace`, `dioxide`), because
PRD §3 is explicit:

> **Grade matters: a shortfall in one grade is not fungible with a surplus in
> another.** Forecasting must be grade-aware.

PRD **B-5** makes per-grade forecasting a **P0** requirement, not an extension.

### Projection

PRD §8.4 requires that *"area and tonnage computations [use] an equal-area or
appropriate UTM projection, **never in degrees**."* `borehole` therefore carries
both geographic coordinates (for display) and optional projected
`easting_m` / `northing_m` in `EPSG:32644` for any length, area or tonnage
arithmetic.

### Missing data

PRD §8.4: *"Missing-data policy stated per field. Never impute silently."*
Optional fields are genuinely optional and arrive as `null`. Nothing in the
pipeline fills a gap with a default and presents it as a value.

---

## What MOIL needs to do

1. Map each internal export onto the matching entity. Field names need not
   match; the JSON Schemas define types, units and ranges.
2. Set `is_synthetic: false` on every real row.
3. Set `source` to something traceable, e.g. `"MOIL CMMS export 2026-03"`.
4. Keep `contract_version` as supplied, so a stored dataset can be read back
   with the schema it was written under.

Nothing else changes. The models read from these schemas, not from the
generator, so real rows displace synthetic ones entity by entity — Track B can
run on real production while Track A is still on synthetic assays.

---

## The synthetic generator

`backend/app/ingestion/generator.py`. Regenerate everything with:

```bash
cd backend && python -m app.ingestion.export
```

### What is calibrated, and what is invented

**Calibrated to public figures:** total annual production is anchored to MOIL's
published scale of roughly **1.1–1.3 Mt of manganese ore per year** across about
ten mines, and Balaghat is the largest producer.

**Invented but plausible:** the per-mine split, grade mix, seasonal amplitudes,
equipment failure rates, blast cadence, and every coefficient in the production
model. **These are not MOIL's figures** and must never be presented as
measurements of MOIL's operations.

Verified by test:

```
✓ Annual totals within MOIL's published scale: 2024=1,098,143 t, 2025=1,122,772 t
```

(Totals land slightly under the 1.2 Mt anchor because the drag terms suppress
output — plan versus actual, which is the point of B-6.)

### The data-generating process

```
tonnes = base(mine, grade)
       × trend(year)
       × seasonality(day-of-year, mine_type)
       × (1 − rain_drag − downtime_drag − blast_drag)
       × lognormal noise
```

The drag terms are computed from the `equipment_event`, `blast_record` and
rainfall rows emitted alongside, so **the covariates a model sees are the ones
that actually generated the target**.

This matters for Phase 4. A seasonal-naive baseline can recover trend and
seasonality but not year-specific weather and equipment shocks; a model given
those covariates can. That is why a gradient-boosting forecaster is expected to
beat the baseline on this data — and it is a property of this DGP, **not
evidence about MOIL's operations**. Noise (σ = 0.085 on daily output) is
deliberately large enough that the improvement is modest rather than artificial.

Verified by test:

```
✓ Rainfall genuinely suppresses output: removing it lifts total production by 5.3%
```

Opencast mines are markedly more rain-sensitive than underground ones
(`RAIN_DRAG_OPENCAST` 0.0042 vs `RAIN_DRAG_UNDERGROUND` 0.0016), per PRD §13 Q5.

### Determinism

All randomness comes from `numpy.random.default_rng(seed)`. The same seed
reproduces the dataset exactly (PRD **N-4**):

```
✓ Generator reproducible: 58,083 rows identical for seed 20260921
✓ A different seed produces a different dataset
```

This is a separate stream from the live operational generator in
`app/core/synthetic.py`, which must stay bit-compatible with its TypeScript twin.
Batch generation has no such constraint and uses PCG64 for speed.

---

## What this replaced

`frontend/src/lib/historical-database.ts` held a hand-written 1977–2026 table
declaring **"AUTHENTIC DATA SOURCES"** and naming MOIL Annual Reports, the IBM
Indian Minerals Yearbook, GSI Bhukosh and IMD as the origin of per-year
production, drill-hole counts, *"UNFC 111 proved reserves"* and monsoon rainfall.

Those numbers were not taken from those publications. Attributing invented
figures to named government authorities is the most serious form of fabrication
available to this project, particularly before a PSU jury. 554 lines of
hand-written records were removed and replaced with generator output carrying
its own provenance notice.

Two fields were renamed in the process:

| Before | After | Why |
|---|---|---|
| `unfc111ProvedReservesTonnes` | `indicativeResourceBaseTonnes` | Guardrail — PRD §2.4 and §4 non-goal 1: no statutory reserve figures |
| `gsiCoreDrillHoles` | `syntheticBoreholeCount` | GSI did not supply this count |

`OFFICIAL_DATA_SOURCES` was kept but relabelled: it now describes the sources
this system is **designed to ingest** (PRD §8.3), not the provenance of anything
on screen, and its `verifiedParameters` field — nothing had been verified — is
now `parametersAvailable`.

A comment claiming the forward trajectory used *"Holt-Winters / ARIMA + XGBoost
residual estimation over a 50-yr historical dataset"* was removed; none of those
methods exist in this codebase.

---

## Test coverage

```
$ python backend/test_ingestion.py
✓ 7 entities have JSON Schemas, all requiring is_synthetic
✓ Schemas reject inverted intervals, impossible assays, inverted periods, missing is_synthetic
✓ Generator reproducible: 58,083 rows identical for seed 20260921
✓ A different seed produces a different dataset
✓ All 58,083 rows carry is_synthetic=True, a source and a contract version
✓ Annual totals within MOIL's published scale: 2024=1,098,143 t, 2025=1,122,772 t
✓ Production is grade-split for all 10 mines (e.g. ['blast_furnace', 'dioxide', 'ferro_manganese', 'silico_manganese'])
✓ Rainfall genuinely suppresses output: removing it lifts total production by 5.3%

ALL INGESTION CONTRACT TESTS PASSED.
```

---

## Requirements closed

| Req | Tag | Status | Note |
|---|---|---|---|
| A-1 | [PS] P0 | schema published | `borehole`, `assay`, `lithology`; persistence is Phase 5 |
| B-1 | [PS] P0 | **closed** | grade-split production, generated and flagged |
| B-2 | [PS] P0 | **closed** | per-event equipment records, MTBF/MTTR derivable |
| B-3 | [PS] P0 | **closed** | blast schedule, delay and outcome |
| B-6 | [PS] P0 | input ready | `plan_target` supplies the target a shortfall is measured against |
| B-9 | [D] P1 | input ready | grade is a first-class key |
| N-4 | [D] | **closed** for generated data | same seed, same dataset |
