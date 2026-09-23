# Readiness Assessment — Nakshatra-X (SIH26009)

**Assessed against:** `main` @ `34e99d4` (Phases 1–7 merged) plus this branch's sweep fixes.
**Date:** 2026-09-22 · **Assessor:** Phase 8 re-traceability
**Revised:** 2026-09-24 — dashboard rows re-checked in a real browser after DEF-1
(`DECISIONS.md` D-028). Rows whose evidence had been API-level only are now
marked *browser-verified* with a date; two findings added to §5; score recomputed.

> This is an honest assessment, not a pitch. Where evidence is incomplete it says
> so. The score is a **target estimate**, not a claim of what a jury will award.

---

## 1. Headline

| | |
|---|---|
| **Weighted score (target)** | **74 / 100** — recomputed 2026-09-24, see §4 |
| Requirements fully met | **25 / 44 (57%)** |
| Partial | **14 / 44 (32%)** |
| Missing | **5 / 44 (11%)** — 4 of them deferred past Phase 1 by PRD §10 |
| Broken | **0** — but **1 was broken and undetected until 2026-09-24** (DEF-1, §5) |
| Fabrications found this phase | **6 clusters** fixed · **1 more found 2026-09-24**, not yet fixed (§5) |
| Browser-verified requirement rows | **6**, by `npm run test:e2e` |

**The single most important fact about this project:** its operational data is
synthetic, generated to a published ingestion contract, because MOIL's records
are proprietary (PRD §8.2). Weather and satellite imagery are genuinely
measured. Everything in the UI states which it is.

**The most important lesson from this revision:** every dashboard requirement in
§2 was once marked met on the strength of a component, an endpoint or a curl —
and for months the console could not render a single number, because all of
those checks used the one id format that worked. Evidence that a thing exists is
not evidence that it works. Six rows now say *browser-verified*, and a test
asserts them.

---

## 2. PRD → code traceability

Status: **fully** / **partial** / **missing** / **broken**. Every row cites
file:line, a test name, or a measured number.

### 2.1 Track A — Reserve identification (PRD §6.1)

| ID | Pri | Status | Evidence |
|---|---|---|---|
| A-1 ingest borehole/assay/lithology | P0 | **partial** | Schemas published: `backend/app/ingestion/schemas.py`, contract `1.0.0`, entities `borehole, assay, lithology`. JSON Schema in `docs/schemas/`. **No persistence layer** — rows validate but are not stored in a database. |
| A-2 satellite surface indicators | P0 | **fully** | `AI/scripts/sentinel_features.py`. 50 points, **all `is_synthetic=False`**, max cloud **1.0%**, real Sentinel-2 L2A via Planetary Computer + SRTM. `test_track_a.py::test_features_are_real_measurements`. |
| A-3 gridded prospectivity surface | P0 | **fully** | `backend/app/ml/prospectivity.py::rank_drill_targets` over a 1,710-cell grid; `GET /api/v1/prospectivity/drill-targets`. |
| A-4 per-cell uncertainty | P0 | **fully** | Ordinary kriging, `AI/scripts/kriging.py`. Measured: sd **0.000** at an observation vs **0.297** far outside. `test_track_a.py::test_kriging_uncertainty_rises_away_from_data`. |
| A-5 ranked drill targets with evidence | P0 | **fully** | `rank_drill_targets()` returns rank, score, uncertainty and an `evidence` string per target. Rendered in `TrackAPanel.tsx`. |
| A-6 tonnage/grade over a drawn zone | P1 | **partial** | `compute_borehole_spatial_model` returns in-situ tonnage and weighted grade from supplied boreholes, but **not over a user-drawn zone** and not from an interpolated resource model. |
| A-7 feature attribution | P1 | **fully** | Genuine implementation: `/api/v1/prospectivity/metrics` returns `feature_importance`, rendered as a bar list from live model output in `RealtimeMLTrainingStudio.tsx` — **browser-verified 2026-09-24**. ⚠ Separately, `/evaluator` renders a second "Geological feature importance breakdown" chart (30.2% / 21.9% / 16.4% / 13.7% / 10.0% / 7.9%) from a **hardcoded array** in `JudgesArchitectureDeck.tsx:10`, with no provenance envelope. The requirement is met by the first; the second is a fabrication-class defect logged in §5. |
| A-8 versioned reproducible runs | P1 | **partial** | `model_version: track-a-gbt-lomo-v1` returned; features seeded and reproducible (`features.py::_rng_for`). **No run registry or input manifest.** |
| A-9 InSAR subsidence | P2 | **missing** | Not implemented. PRD §10 defers it past Phase 1. |
| A-10 export GeoJSON/shapefile | P1 | **partial** | GeoJSON export works (`05_export_geojson.py`, path fixed in Phase 2). Exports **cells, not ranked targets**; no shapefile. |

**Track A: 5 fully · 4 partial · 1 missing**

### 2.2 Track B — Production shortfall (PRD §6.2) — *the spine*

| ID | Pri | Status | Evidence |
|---|---|---|---|
| B-1 production by mine/grade/period | P0 | **fully** | `ProductionByMineGradePeriod` keyed (mine × grade × period); 37,264 generated rows, all flagged. `test_ingestion.py::test_production_is_grade_aware`. |
| B-2 equipment records | P0 | **fully** | `EquipmentEvent`, per-event not rolled up, so MTBF/MTTR are derivable. |
| B-3 blast records | P0 | **fully** | `BlastRecord` with schedule, delay, fragmentation, outcome. |
| B-4 weather observed + forecast | P0 | **fully** | NASA POWER (`is_live: True`, verified 85.4 mm identical at UI→FastAPI→source) and Open-Meteo past/forecast split. NDVI/LST **not** ingested — see limits §5. |
| B-5 forecast per mine **per grade** | P0 | **fully** | `backend/app/ml/forecaster.py`, grade is a model feature. Four distinct grade forecasts for Balaghat; `test_track_b.py::test_forecaster_is_grade_aware` asserts they differ. |
| B-6 shortfall probability + band | P0 | **fully** | `shortfall_probability()`, Monte Carlo over conformalised per-day predictives. Balaghat P(short) 0.63–0.99 by grade. `test_shortfall_probability_is_a_probability`. |
| B-7 attribution to constraints | P0 | **fully** | Exact additive decomposition, `additive-driver-attribution-v1`. Honestly named — not SHAP. |
| B-8 threshold alerts | P1 | **partial** | `POST /dispatch-operational-alert` + `GET /alerts` work, but are **not driven by the B-6 probability crossing a threshold**. |
| B-9 grade-aware (non-fungible) | P1 | **fully** | Grade is a first-class key throughout the contract and the forecaster. |
| B-10 backtest + display error | P0 | **fully** | Rolling-origin, refit at every origin. **MAPE 11.67% vs baseline 14.81%**, coverage **0.812** (nominal 0.80), 160 predictions. `docs/BACKTEST.md`; surfaced in `TrackBPanel.tsx`. |

**Track B: 8 fully · 2 partial · 0 missing** — the strongest track, as PRD §10 intends.

### 2.3 Corrective actions (PRD §6.3)

| ID | Pri | Status | Evidence |
|---|---|---|---|
| C-1 schedule adjustment | P0 | **partial** | `reschedule_shift` candidate generated and constraint-checked; it is a templated action with an hours delta, **not a re-sequenced schedule**. |
| C-2 blasting optimisation | P0 | **partial** | `blast_reschedule` moves a blast into the next legal window; **no timing/sequencing optimisation**. |
| C-3 equipment redeployment | P0 | **partial** | `equipment_relocation` with a real feasibility check (haversine, transport time); **source unit is a placeholder, not chosen from a fleet register**. |
| C-4 expected effect + assumptions | P0 | **fully** | Each approved action carries `recovery_tonnes`, `delta_shortfall_probability` and a list of stated assumptions. |
| C-5 hard constraints, never impossible | P0 | **fully** | `backend/app/ml/constraints.py`. Both failures PRD §6.3 names by name are rejected: night blasting (02:30 vs 06:00–18:00) and a 128 km overnight relocation (11.1 h needed vs 10 h). Infeasible actions **removed**, not downgraded. 5 tests in `test_track_b.py`. |
| C-6 scenario comparison | P1 | **missing** | Not implemented. PRD §10 defers past Phase 1. |
| C-7 accept/reject with reason | P1 | **missing** | No capture. Blocked with N-7. |

**Corrective: 2 fully · 3 partial · 2 missing**

### 2.4 Dashboard (PRD §6.4)

| ID | Pri | Status | Evidence |
|---|---|---|---|
| D-1 show predicted reserves | P0 | **partial** | Prospectivity with uncertainty is shown, correctly typed and never called "reserve" (§2.4). A **resource/grade estimate over a zone is not** (blocked on A-6). |
| D-2 production trends | P0 | **fully** | Per-grade trajectory chart with 80% interval and seasonal-naive overlay, `TrackBPanel.tsx`. **Browser-verified 2026-09-24**; before the DEF-1 fix this chart never rendered, because the forecast call 503'd. |
| D-3 shortfall risk | P0 | **fully** | Headline tiles + per-grade P(shortfall) chips. **Browser-verified 2026-09-24** — ten portfolio cards with a probability each, four grades for Balaghat. Before the DEF-1 fix every card read "forecast unavailable". |
| D-4 corrective steps | P0 | **fully** | Approved actions with effect, assumptions and the checks each passed — **browser-verified 2026-09-24**, three approved for Balaghat. The rejection panel is implemented and renders the rule broken when `rejected_actions` is non-empty, but **that path has never been observed**: the engine rejects nothing at any of the ten mines with the current synthetic inputs, so the panel shows its empty-state line instead. Previously this row asserted "rejected actions shown with the rule each broke" as if it had been seen. It had not. |
| D-5 map with prospectivity + targets | P0 | **partial** | Prospectivity layer and ranked target table exist; targets are **not plotted as map pins** in the console (they are in a table). |
| D-6 portfolio → mine → face | P1 | **partial** | Portfolio and mine levels implemented (`DecisionConsole.tsx`, `level === 'portfolio' \| 'mine'`). **Face/section level is grade-level**, because the contract has no face key — deliberate, `DECISIONS.md` D-021. |
| D-7 evidence panel | P0 | **fully** | `Evidence.tsx::Metric` is the only number-rendering component; refuses a value without an envelope and prints an N-3 violation marker if one appears. **Browser-verified 2026-09-24**: every one of the ten portfolio cards carries a provenance badge, asserted by `npm run test:e2e`. |
| D-8 export PDF/Excel | P1 | **fully** | CSV (Excel-readable, provenance columns) + print-to-PDF, `console-export.ts`. |
| D-9 role-based views | P2 | **missing** | Not implemented (`grep persona` → 0). PRD §10 defers past Phase 1. |

**Dashboard: 5 fully · 3 partial · 1 missing**

### 2.5 Non-functional (PRD §7)

| ID | Target | Status | Evidence |
|---|---|---|---|
| N-1 latency <2 s p95 cached | — | **fully** | **8/8 endpoints pass warm.** Backtest 421 s → **2 ms** via precomputed artefact; telemetry 4.003 s → **0.003 s** via TTL cache. `backend/latency_report.json`. |
| N-2 nightly batch + on-demand | — | **fully** | `python -m app.api.batch backtest`, cron guidance in `docs/DEPLOYMENT.md`; `?compute=true` for on-demand. |
| N-3 100% provenance | 100% | **partial** | Enforced structurally in `/console` (every number via `Metric`). **Legacy screens do not render the envelope** — so 100% holds for the console, not the whole app. |
| N-4 reproducibility exact | Exact | **fully** | Verified: identical provenance values across calls; Python↔TS PRNG **bit-identical** (`test_provenance_parity.py`); generator 58,083 rows byte-identical per seed. |
| N-5 on-premise | — | **partial** | Models, constraint engine, kriging and contract are local. **Supabase (auth) is an external dependency**; weather/imagery are external by nature and degrade with a stated reason. |
| N-6 degrade + state staleness | Required | **fully** | Backend down → 4/4 endpoints 503 with reason, **zero numeric fields**, `/console` still 200. Backtest reports `artifact_age_hours`. |
| N-7 audit log of recommendations | Required | **missing** | `grep audit_log\|disposition` → no hits. Not implemented. |
| N-8 backtest visible in UI | Required | **fully** | On-demand panel in `TrackBPanel.tsx` showing model vs baseline MAPE, coverage vs nominal, per-horizon table. **Browser-verified 2026-09-24**: MAPE 11.67% vs 14.81%, coverage 0.812, four horizons. Before the DEF-1 fix the panel returned 503 and rendered nothing. |

**Non-functional: 5 fully · 2 partial · 1 missing**

### 2.6 Totals

| Group | Fully | Partial | Missing | Total |
|---|---|---|---|---|
| Track A | 5 | 4 | 1 | 10 |
| Track B | 8 | 2 | 0 | 10 |
| Corrective | 2 | 3 | 2 | 7 |
| Dashboard | 5 | 3 | 1 | 9 |
| Non-functional | 5 | 2 | 1 | 8 |
| **Total** | **25** | **14** | **5** | **44** |

**57% fully · 32% partial · 11% missing.** Of the 5 missing, **4 are explicitly
deferred past Phase 1 by PRD §10** (A-9 InSAR, C-6 scenarios, D-9 role views,
and C-7 which pairs with N-7). Only **N-7** is a Required non-functional that is
genuinely absent.

---

## 3. Fabrication sweep — Phase 8

Nine had been found across Phases 1–7. This sweep assumed a tenth existed.
**It found six more clusters.** Grep evidence and disposition for every hit:

### 3.1 `AI/scripts/03_train_model.py:65` — a failure reported as a perfect score

```
grep -rnEi "(accuracy|roc_auc|auc)[\"' ]*[:=][\"' ]*[0-9]" AI
  AI/scripts/03_train_model.py:65:    auc = 1.0
```

```python
try:    auc = roc_auc_score(y_test, probs)
except Exception:    auc = 1.0        # ← a failure becomes AUC 1.0
```

`roc_auc_score` raises when the test split holds a single class — so the one
case where the metric is **undefined** produced the most **flattering** number,
then printed it as `Test ROC-AUC: 1.0000` and wrote it to `model_metrics.json`.
**Fixed:** reports NaN with a warning; serialises as `null`, never a number.

### 3.2 Three shipped artefacts carrying the leaked pipeline's metrics

```
frontend/src/data/model_metrics.json     roc_auc 0.9858  top feature dist_to_fault_km
frontend/public/data/model_metrics.json  roc_auc 0.9858  top feature dist_to_fault_km
AI/outputs/model_metrics.json            roc_auc 0.9858  top feature dist_to_fault_km
```

`frontend/public/` is **served publicly** — `/data/model_metrics.json` returned
0.9858 AUC with the distance-to-mine feature on top to anyone who asked.
**Fixed:** all three deleted; the legacy trainer now stamps a `VALIDITY_WARNING`
and `superseded_by` into any regenerated file.

### 3.3 `ProductionSentinel.tsx` — a live simulated SCADA feed

Live in `/features/[id]` and `/production`. Every 2.5 s it invented tonnages,
hourly rates, vibration readings, pump discharge and **dumper registration
numbers** (`MP-50-GA-1043`), labelled "SCADA telemetry" — while **PRD §4
non-goal 2 excludes SCADA integration entirely**. **Fixed:** seeded and
deterministic, relabelled throughout as a simulated activity feed with the
non-goal cited; invented plate numbers removed.

### 3.4 Dead components carrying `jitter()` on data

`MissionControl.tsx` (0 referrers) and `globe/Charts.tsx` (only referrer was
`MissionControl`) contained `jitter()` applied to NDVI, soil moisture, land
temperature, rainfall and production — plus
`freshness: Math.random() > 0.7 ? 'stale' : 'fresh'`, which **randomly claimed
data was stale**. **Fixed:** both deleted after confirming zero references.

### 3.5 Eight live claims of libraries that are not dependencies

```
grep -c "prophet|xgboost|shap|pykrige|statsmodels" backend/requirements.txt  → 0
frontend deps matching prophet|xgboost|shap|arima                            → 0
```

Yet: *"deep ARIMA vector forecasting"*, `engine: '…Holt-Winters/XGBoost 2040
Forecast Kernel'`, *"Holt-Winters/XGBoost 2040 trajectory model"*,
`source: 'XGBoost Causal Model'`, *"XGBoost ensemble model metrics"*,
`modelBasis: 'Holt-Winters + XGBoost Baseline'`, *"XGBoost + SHAP AI"*,
*"XGBoost Ensemble + Deep Neural Net"*. **All eight fixed** to name the code that
actually runs.

### 3.6 Six UI provenance claims Phase 3 missed

*"real statutory disclosures"*, *"1975–2025 Authentic History (MOIL/IBM Data)"*,
*"50-Yr Real MOIL Database"*, *"Derived directly from 50 years of IBM historical
data"*, *"(GSI/MOIL Core Drill Calibrated)"*, *"1,200+ Verified MOIL & IBM
Database Logs"*, plus *"GSI Diamond Boreholes"*. Phase 3 removed the false
attributions from the data file but left the UI labels asserting them.
**All fixed.**

### 3.7 Guardrail violations

| Guardrail | Violation | Fix |
|---|---|---|
| (a) no subsurface from satellite | `AI/api/main.py` API description: *"Sub-surface Manganese Deposit Discovery"*; deck: *"map sub-surface manganese prospectivity"*; *"Cloud Penetration: 100% Operational"*; chatbot claiming SAR/NISAR *"penetrates 100% of cloud and rain"* | all reworded to surface-only with §2.2 cited |
| (b) no statutory UNFC | *"upgrade UNFC 122 to 111 reserves"*; chatbot: *"10,829 historical core drill logs … voxel block models of UNFC 111 proved reserves"* | replaced; no reserve class emitted |

### 3.8 Verified clean

```
metrics literals presented as measured ....... 0 live (2 disclaimers)
fabricated scene IDs ......................... 0 live (4 disclaimers)
non-dependency model names ................... 0 live
provenance claims ............................ 0
guardrail (a) subsurface ..................... 0 live (8 disclaimers)
guardrail (b) statutory UNFC ................. 0 live
hardcoded credentials ........................ 0
Math.random on a data path ................... 0 (remaining hits are canvas/particle animation)
```

---

## 4. Score

Weighting as specified. Each mark has a reason tied to §2 or §3.

### PRD coverage — **17 / 25**

57% fully, 32% partial, 11% missing. Track B (the PRD spine) is 8/10 fully.
Track A is 5/10. Four of the five missing requirements are explicitly deferred
past Phase 1 by PRD §10, so they are **not** penalised here; N-7 (Required) is.
Deducted mainly for the partials that matter: A-1 has no persistence, A-6/D-1
have no zone-based resource estimate, and C-1/C-2/C-3 produce templated actions
rather than optimised ones.

### Functional correctness — **18 / 25**  *(was 19)*

What works, works honestly and is tested: the forecaster beats its baseline on a
correct rolling-origin protocol with calibrated intervals (0.812 vs 0.800); the
constraint engine rejects both failures the PRD names; the blend optimiser
reports infeasible with an LP-derived diagnosis; weather and imagery are
genuinely live. Deducted for: Track A's headline AUC leaning partly on terrain
(§5), alerts not wired to the B-6 probability, and recommendations being
templated rather than computed.

**−1 for the hardcoded feature-importance chart on `/evaluator`** (§5). The
previous 19 was also, in hindsight, generous for a different reason: it was
awarded while `/console` could not render a number. That is now fixed, so the
mark is finally measuring what it claimed to measure.

### Architecture — **16 / 20**

Two-track separation matches the PRD; FastAPI is the single service layer with
the UI proxying to it; the ingestion contract is published and versioned; the
provenance envelope is enforced structurally rather than by convention; batch vs
request-path separation follows N-2. Deducted for: no persistence layer behind
the contract, Supabase as an external auth dependency against N-5, and a legacy
UI surface that still sits outside the provenance discipline.

### Code quality — **10 / 15**

Owned code is lint-clean and typechecks; decisions are documented (25 entries in
`DECISIONS.md`); guardrails are asserted in tests, not just prose. Deducted for:
**46 pre-existing lint errors** in legacy screens (52 before the UI redesign); two parallel UI surfaces
(`/console` and the legacy dashboard) with different honesty standards; and the
fact that **six fabrication clusters survived into Phase 8** — they were found,
but a codebase that needed eight sweeps has a quality problem, not just a
fabrication problem.

### Testing & demo — **13 / 15**  *(was 11)*

Six backend suites, 39 assertions, covering the load-bearing logic: no-leakage
(corrupts post-origin actuals 10× and asserts bit-identical forecasts), backtest
beats baseline, interval coverage near nominal, constraint rejections, blend
infeasibility, cross-runtime PRNG parity, and the performance contract.

**+2 for browser-level coverage, which did not exist before.** `npm run test:e2e`
drives `/console` in headless Chrome and asserts 18 things about the rendered
page — ten cards each with a probability and a provenance badge, the full
drill-down chain, backtest MAPE and coverage, constraint-checked actions, zero
5xx — including a guard that opens the *second* mine and asserts the screen shows
that mine, which is the assertion DEF-1 fails. Verified capable of failing: 3/18
against the reverted register. `tools/demo-walk.js` executes every step of
`docs/DEMO.md` and screenshots each, and `tools/a11y.js` runs axe-core per route.

Still deducted for: no CI configuration (nothing runs these automatically), the
demo depending on two manually started processes, and no component-level tests.

### Total

```
PRD coverage        17/25  × 1.00 = 17   (unchanged)
Functional          18/25  × 1.00 = 18   (was 19 — hardcoded chart, §5)
Architecture        16/20  × 1.00 = 16   (unchanged)
Code quality        10/15  × 1.00 = 10   (unchanged)
Testing & demo      13/15  × 1.00 = 13   (was 11 — browser-level coverage)
                                   ────
                                    74 / 100
```

**74/100, recomputed 2026-09-24 — not carried forward.** Two components moved in
opposite directions and the total happens to land one point up; that is a
coincidence, not stability. The more important change is not the number: until
DEF-1 was fixed, six of the rows this score rests on asserted rendering that had
never happened in a browser. The same 73 would have been wrong yesterday and is
roughly right today for reasons that had nothing to do with arithmetic.

**A target, not a claim.** A jury weighting novelty or polish
differently could land meaningfully above or below this.

---

## 5. Limits, stated plainly

**DEF-1 — the console could not render a single number, and every check missed
it.** Until 2026-09-24 a Next route handler shadowed FastAPI's mine register and
returned slug ids (`'balaghat'`) where the service layer keys mines by integer.
`forecast`, `backtest` and `recommendations` therefore returned 503 for all ten
mines, and `telemetry` computed `parseInt(id) || 1` — so a request for *any*
mine returned **Balaghat's** record, with `live_sources_ok: true` and no
degradation flag. One mine's measurements under another mine's name: the same
defect class removed from `EVIDENCE_DB` in an earlier phase, surviving in a
fallback expression. Fixed; see `DECISIONS.md` D-028.

**The reason it hid is the part worth keeping.** Every trace in this document
that claimed a dashboard requirement was met cited a component, an endpoint or a
curl — all of which used numeric ids, the path that always worked. Nothing
exercised the path a browser takes: fetch the register, then use the id it
returns. **An API-level check is not evidence that a screen works**, and six
rows in §2 asserted rendering that had never been observed. They are now marked
browser-verified, with the date, and `npm run test:e2e` asserts them on every
run so the claim cannot rot again.

**A second hardcoded chart survived the fabrication sweeps.** `/evaluator`
renders a "Geological feature importance breakdown" — Fault Distance 30.2%,
Rainfall 21.9%, Slope 16.4%, Iron Oxide 13.7%, Elevation 10.0%, Ferrous Mineral
7.9% — from a literal array in `JudgesArchitectureDeck.tsx:10`, with no
provenance envelope and nothing marking it as illustrative. The real importances
are available from `/api/v1/prospectivity/metrics` and are rendered honestly
elsewhere, which makes this one gratuitous. Found 2026-09-24, **not yet fixed** —
it is in a screen the UI redesign rewrites in Stage 2. Two of its six
descriptions do say "simulated", but the percentages are presented as measured.

**The constraint engine's rejection path is unexercised.** `rejected_actions` is
empty for all ten mines, so the panel that names a broken rule has never been
seen with real data. The engine demonstrably runs — its scope and exclusions are
returned per request, and five tests in `test_track_b.py` assert it rejects
night blasting and an infeasible relocation — but the *UI* path is unproven.
`docs/DEMO.md` previously told the presenter to scroll to a rejected block that
would not be there; corrected 2026-09-24.

**Track A's 0.85 AUC is softer than it looks.** The ablation is published
because the headline alone would mislead: spectral features alone reach
**0.60**, terrain alone **0.665**, slope alone **0.511** (chance). Mines sit on
flat ground — 1.58° average slope against 3.70° for random points — so part of
what the model learns is *where mines are built*, not where ore is. It is not
merely a mine-site detector (slope alone is chance), but the geological signal is
thin. Per-deposit, **four of ten score below 0.35 and Tirodi (0.018) is
essentially missed.** The 95% CI is **[0.723, 0.95]** on ten positives.

**GSI Bhukosh is unreachable**, so lithology — the feature most likely to carry
real geology — is **omitted, not substituted**. It is the single most valuable
addition available.

**Operational data is synthetic.** Production, equipment and blasting rows are
generated to the published contract because MOIL's are proprietary (PRD §8.2).
Every row carries `is_synthetic=true` and the UI badges it. **The Phase 4 margin
over baseline is a property of the generator**, which makes production depend on
covariates the baseline cannot see — it is not evidence about MOIL's operations.
What the backtest does establish is that the pipeline is sound.

**Weather and imagery are real.** NASA POWER, Open-Meteo, Earth Search STAC and
Planetary Computer Sentinel-2 pixels are genuinely fetched and measured.

**Cold starts are real.** `/forecast` costs **96.5 s** on the first call in a
fresh process (dataset generation + per-mine fitting). N-1 governs cached
results, so this is outside its scope, but a cold user would wait.

**Leaked keys need manual rotation.** A Supabase anon key and Firebase web
config were committed to this repository's history and removed from the working
tree in Phase 1. **History rewriting is out of scope — rotate them at the
provider.** The RLS policy they sat behind was `USING (true)` until Phase 1.

**N-3 is 100% in `/console`, not app-wide.** Legacy screens still render numbers
without the envelope.

**Still partial:** A-1 (no persistence), A-6/D-1 (no zone resource estimate),
A-8 (no run registry), A-10 (cells not targets, no shapefile), B-8 (alerts not
probability-driven), C-1/C-2/C-3 (templated, not optimised), D-5 (targets not
plotted), D-6 (grade level, not face), N-5 (Supabase).

---

## 6. The three most important next actions

**1. Implement N-7, the recommendation audit log.** It is the only *Required*
non-functional that is missing, it unblocks C-7, and it is small: persist every
issued recommendation with its constraint verdict, then capture accept/reject
with a reason. For a PSU buyer this is the difference between a demo and a tool
someone can be accountable for.

**2. Get GSI lithology in, or say publicly why you cannot.** Track A's weakness
is a missing feature, not a weak model — the spectral-only 0.60 says so. If
Bhukosh stays unreachable, ASTER SWIR alteration ratios are the next-best
addition and are reachable through Planetary Computer today.

**3. Retire the legacy UI surface or bring it under the provenance rule.** Six
fabrication clusters survived into Phase 8, and **every one was in a legacy
screen** — none in `/console`, where `Metric` makes an unprovenanced number
structurally hard to ship. Two surfaces with two honesty standards is the root
cause; one of them should go.
