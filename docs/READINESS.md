# Readiness Assessment — Nakshatra-X (SIH26009)

**Assessed against:** `main` @ `7ab7258` (PRs #1–#25 merged) plus this branch.
**Date:** 2026-10-06 · re-scored from the ground up, not carried forward.
**Previous:** 74/100 on 2026-09-24 (`main` @ PR #13). Twelve PRs have merged since
(#14–#25); every row below was re-checked against the code and tests as they
are now, and its evidence is what exists today.

> This is an honest assessment, not a pitch. Where evidence is incomplete it says
> so. The score is a **target estimate**, not a claim of what a jury will award.

---

## 1. Headline

| | |
|---|---|
| **Weighted score (target)** | **80 / 100** (was 74) — §4 |
| Requirements fully met | **24 / 44 (55%)** (was 26: B-6 and D-3 partial since D-044) |
| Partial | **15 / 44 (34%)** |
| Missing | **5 / 44 (11%)** — 4 deferred past Phase 1 by PRD §10; N-7 is the one Required gap |
| Broken | **0** |
| Checked on every pull request | **8 CI jobs**, 7 of them gating; none can be failed by an external service (`docs/CI.md`) |
| Browser-verified requirement rows | **8**, asserted in CI on every PR (was 6, run by hand) |
| Found and fixed in this pass | **a demo-breaking bug** (D-042) · **5 fabrications in legacy surfaces** (§3.2) · **web fonts never applied** · a tile fetch that died on one slow tile · a stale verdict on Mine twin (§5) |

**The single most important fact about this project is unchanged:** its
operational data is synthetic, generated to a published ingestion contract,
because MOIL's records are proprietary (PRD §8.2). Weather and satellite imagery
are genuinely measured. Every number on screen says which it is — now checked
on every pull request across all 16 routes, not by reading.

**The most important lesson of this pass:** following `docs/DEMO.md` word for
word from a fresh clone failed — first on the commands (no setup, no `python`,
no build, a frontend the pre-flight never started), then on something no test
had reached: the day-before regeneration was silently undone on demo morning
(§5, D-042). Each piece had been verified; the sequence a presenter actually
follows had not.

---

## 2. PRD → code traceability

Status: **fully** / **partial** / **missing** / **broken**. Every row cites a
file, a test or a measured number. *CI* means asserted on every pull request by
`.github/workflows/ci.yml`; *browser* means asserted in a real headless browser.

### 2.1 Track A — Reserve identification (PRD §6.1)

| ID | Pri | Status | Evidence |
|---|---|---|---|
| A-1 ingest borehole/assay/lithology | P0 | **partial** | Contract `1.0.0` (`backend/app/ingestion/schemas.py`, `docs/schemas/`); rows validate. **No persistence layer** — nothing stores them. Unchanged. |
| A-2 satellite surface indicators | P0 | **fully** | 50 points, all `is_synthetic=False`, real Sentinel-2 L2A (Planetary Computer) + SRTM; `test_track_a.py::test_features_are_real_measurements`. Shown as the "Measured points" map layer with its provenance (#23). |
| A-3 gridded prospectivity surface | P0 | **fully** | 1,710-cell grid from the model (#19, "honest grid"); `GET /api/v1/prospectivity`; map layer "Prospectivity score", legend domain read from the data [−0.0023, 0.959] and labelled a ranking, not a probability (#23). `npm run test:surface` (CI). |
| A-4 per-cell uncertainty | P0 | **fully** | Ordinary kriging; sd 0.000 at an observation vs 0.297 far out (`test_track_a.py::test_kriging_uncertainty_rises_away_from_data`). Its own map layer, sd domain [0.0447, 0.3837] (#23). |
| A-5 ranked drill targets with evidence | P0 | **fully** | `rank_drill_targets()` — rank, score, uncertainty, evidence string; rendered in `TrackAPanel.tsx`; walked in `tools/demo-walk.js` 2:30. |
| A-6 tonnage/grade over a drawn zone | P1 | **partial** | Tonnage and weighted grade from supplied boreholes; **not over a user-drawn zone**, not from a resource model. Unchanged. |
| A-7 feature attribution | P1 | **fully** | `/api/v1/prospectivity/metrics` → `feature_importance`, rendered from model output. **The hardcoded chart on `/evaluator` (74-score §5) is gone**: `JudgesArchitectureDeck.tsx` now reads the model or says it cannot; its real top feature is elevation (40.6%). `/evaluator` redirects to `/method`. |
| A-8 versioned reproducible runs | P1 | **partial** | `model_version` returned; features seeded. **No run registry or input manifest** for Track A. (Track B artifacts now carry a full identity — §2.5 N-4.) |
| A-9 InSAR subsidence | P2 | **missing** | Deferred past Phase 1 by PRD §10. |
| A-10 export GeoJSON/shapefile | P1 | **partial** | GeoJSON of cells; **not of ranked targets, no shapefile**. Unchanged. |

**Track A: 5 fully · 4 partial · 1 missing** (unchanged)

### 2.2 Track B — Production shortfall (PRD §6.2) — *the spine*

| ID | Pri | Status | Evidence |
|---|---|---|---|
| B-1 production by mine/grade/period | P0 | **fully** | Keyed mine × grade × period, every row flagged synthetic; `test_ingestion.py::test_production_is_grade_aware`. |
| B-2 equipment records | P0 | **fully** | `EquipmentEvent`, per event, so MTBF/MTTR are derivable. |
| B-3 blast records | P0 | **fully** | `BlastRecord`: schedule, delay, fragmentation, outcome. |
| B-4 weather observed + forecast | P0 | **fully** | NASA POWER (live: `test_api.py::test_live_upstreams`, CI network job) and Open-Meteo; degraded path asserted offline (`test_upstreams_degrade_honestly_when_unreachable`, CI). NDVI/LST **not** ingested (§5). |
| B-5 forecast per mine **per grade** | P0 | **fully** | Grade is a model feature; four distinct grade forecasts; `test_track_b.py::test_forecaster_is_grade_aware` (CI, Track B job). Rendered per grade (browser, `demo-walk.js` 1:05). |
| B-6 shortfall probability + band | P0 | **partial** *(was fully)* | Computed and served by the API (`p_shortfall`, Monte Carlo over conformalised per-day predictives; `test_shortfall_probability_is_a_probability`), but **withdrawn from the screen** (D-044): the 14-day aggregation behind it fails its sanity checks on all eight datasets measured (D-043, §5), and no fix has passed. D-045 measured two replacement estimators — horizon dependence and direct conformal calibration of the 14-day total — and **neither passed**: both came out worse calibrated than what is served (`docs/SHORTFALL_PROBABILITY.md`). Kept out of `PITCH_FIGURES.md` by a test. |
| B-7 attribution to constraints | P0 | **fully** | Exact additive decomposition, `additive-driver-attribution-v1`, named as what it is — not SHAP. |
| B-8 threshold alerts | P1 | **partial** | `POST /dispatch-operational-alert`, `GET /alerts`; **not driven by B-6 crossing a threshold**. Alert precision/recall (PRD §11) is therefore **not measured**. Unchanged. |
| B-9 grade-aware (non-fungible) | P1 | **fully** | Grade is a first-class key in the contract and the forecaster. |
| B-10 backtest + display error | P0 | **fully** | Rolling-origin, refit at every origin. **On the frozen dataset** (actuals to 2026-10-07, `docs/PITCH_FIGURES.md`): pilot (Balaghat) **MAPE 11.50% vs baseline 12.85%, coverage 0.806** over 160 predictions; portfolio over 24 origins, daily coverage **0.785 [0.761, 0.808]**, MAPE 10.22%. On the 20 September dataset: 11.67% vs 14.81%, 0.812; portfolio 0.761 [0.733, 0.786], MAPE 10.00%. The 14-day figures are measured but withheld from the pitch (D-044). On screen without a click (browser, `npm run test:pilot`, CI). |

**Track B: 7 fully · 3 partial · 0 missing** (B-6 partial since D-044)

### 2.3 Corrective actions (PRD §6.3)

| ID | Pri | Status | Evidence |
|---|---|---|---|
| C-1 schedule adjustment | P0 | **partial** | `reschedule_shift`: constraint-checked, templated, an hours delta — **not a re-sequenced schedule**. |
| C-2 blasting optimisation | P0 | **partial** | `blast_reschedule` moves a blast into the next legal window; **no timing/sequencing optimisation**. |
| C-3 equipment redeployment | P0 | **partial** | `equipment_relocation` with a real feasibility check; **source unit is a placeholder**, not chosen from a fleet register. |
| C-4 expected effect + assumptions | P0 | **fully** | Each approved action carries `recovery_tonnes`, `delta_shortfall_probability` and its assumptions; browser (`npm run test:e2e`, CI). |
| C-5 hard constraints, never impossible | P0 | **fully** | `backend/app/ml/constraints.py`; night blasting and a 128 km overnight move rejected (5 tests, `test_track_b.py`). **Now seen rejecting in the UI**: Mine twin, +6 h blast delay → "outside the underground inter-shift blasting windows (06:00-07:00, 14:00-15:00)" (browser, `demo-walk.js` 2:20). In the console the rejection list is still empty at all ten mines (§5). |
| C-6 scenario comparison | P1 | **missing** | Deferred by PRD §10. The Mine-twin what-if calculator runs one scenario against the forecast baseline; it does not compare scenarios side by side. |
| C-7 accept/reject with reason | P1 | **missing** | Blocked with N-7. |

**Corrective: 2 fully · 3 partial · 2 missing** (unchanged)

### 2.4 Dashboard (PRD §6.4)

| ID | Pri | Status | Evidence |
|---|---|---|---|
| D-1 show predicted reserves | P0 | **partial** | Prospectivity with uncertainty, never called "reserve"; **no resource/grade estimate over a zone** (blocked on A-6). |
| D-2 production trends | P0 | **fully** | Per-grade trajectory with 80% interval and seasonal-naive overlay; browser (`test:e2e`, CI). |
| D-3 shortfall risk | P0 | **partial** *(was fully)* | Ten portfolio cards ranked by expected shortfall in tonnes, summed over grades, and each grade's own figure; the daily bands with their measured calibration. **No probability of shortfall on screen** — withdrawn (D-044, B-6). Browser (`test:e2e`, CI), which also asserts no probability is rendered. |
| D-4 corrective steps | P0 | **fully** | Approved actions with effect, assumptions and checks passed; browser (`test:e2e`, CI). The console's rejection panel renders its stated empty result; a rejection with real data is seen on Mine twin (C-5). |
| D-5 map with prospectivity + targets | P0 | **partial** | Six layers, each with a legend that states its provenance and licence (#23); Planetary Computer imagery with a local tile cache fallback, labelled when cached; `npm run test:map` (live, CI network job). **Ranked targets are listed beside the map, not plotted on it** — the markers are the mines and the cell being scored. |
| D-6 portfolio → mine → face | P1 | **partial** | Portfolio → mine → grade, one navigation model (the breadcrumb carries the track, #23); `npm run test:nav` (CI). **Face level is grade level** — the contract has no face key (D-021). |
| D-7 evidence panel | P0 | **fully** | `Evidence.tsx::Metric` refuses a value without an envelope. **App-wide now**: `npm run test:provenance` finds 0 unattributed data-shaped values across 16 routes, and `-- --offline` finds 0 values rendered at all with the backend stopped — both gating in CI. |
| D-8 export PDF/Excel | P1 | **fully** | CSV with provenance columns + print-to-PDF (`console-export.ts`). |
| D-9 role-based views | P2 | **missing** | Deferred by PRD §10. |

**Dashboard: 4 fully · 4 partial · 1 missing** (D-3 partial since D-044)

### 2.5 Non-functional (PRD §7)

| ID | Target | Status | Evidence |
|---|---|---|---|
| N-1 latency <2 s p95 cached | — | **fully** | No forecast is computed in a request (#16): artifacts are served, p95 1.5 ms; readiness 1.34 s from launch on committed artifacts. Backtest from its artifact, 2 ms. |
| N-2 nightly batch + on-demand | — | **fully** | `python -m app.api.batch all` regenerates every artifact kind from one dataset; recomputes only what is stale by identity and rewrites nothing identical (D-041); `--force` for an on-demand determinism check. |
| N-3 100% provenance | 100% | **fully** *(was partial)* | Every rendered data-shaped value on all 16 routes is attributed (`test:provenance`, gating in CI) and numeric literals in JSX are rejected at compile time (`lint:literals`, CI). The 74-score's gap — legacy screens without the envelope — is closed for what renders, and the legacy API endpoints that returned fabricated records are removed (§3.2). |
| N-4 reproducibility exact | Exact | **fully** | Every artifact carries a full identity (dataset, model version, code fingerprint, library versions); `batch check` verifies it in CI. `batch all --force` recomputed every artifact and left all of them byte-identical (#24). Python↔TS PRNG bit-identical (`test_provenance_parity.py`). |
| N-5 on-premise | — | **partial** | Models, constraints, kriging and contract are local, and the demo runs without a network once prepared (§5, network loss). **Supabase (auth) is an external dependency.** |
| N-6 degrade + state staleness | Required | **fully** | Offline provenance guard: 0 values rendered with the backend stopped, 16 routes (CI). Every browser suite passes with every external service unreachable (CI). Network-loss rehearsal: §5. Age is reported (`artifact_age_hours`, `/readyz` `age_warning`), never acted on (D-041). |
| N-7 audit log of recommendations | Required | **missing** | No persistence of issued recommendations or decisions on them. Unchanged. |
| N-8 backtest visible in UI | Required | **fully** | On screen on load for the pilot; other mines say where it was validated; browser (`test:pilot`, CI). |

**Non-functional: 6 fully · 1 partial · 1 missing** (was 5 · 2 · 1)

### 2.6 Totals

| Group | Fully | Partial | Missing | Total |
|---|---|---|---|---|
| Track A | 5 | 4 | 1 | 10 |
| Track B | 7 | 3 | 0 | 10 |
| Corrective | 2 | 3 | 2 | 7 |
| Dashboard | 4 | 4 | 1 | 9 |
| Non-functional | 6 | 1 | 1 | 8 |
| **Total** | **24** | **15** | **5** | **44** |

Since then, B-6 and D-3 have gone from fully to partial: P(shortfall) is
withdrawn from the screen (D-044). Before that, the one status change since
74/100 was N-3. Most of what changed in between is
not a status change: it is the evidence. Eight rows that were asserted by hand
are asserted on every PR; the network can no longer change a check's result;
and the demo was walked from a fresh clone.

---

## 3. Fabrication and integrity sweeps

### 3.1 Phase 8 sweep (2026-09-22) — kept as history

Nine had been found across Phases 1–7. This sweep assumed a tenth existed.
**It found six more clusters.** Grep evidence and disposition for every hit:

#### 3.1 `AI/scripts/03_train_model.py:65` — a failure reported as a perfect score

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

#### 3.2 Three shipped artefacts carrying the leaked pipeline's metrics

```
frontend/src/data/model_metrics.json     roc_auc 0.9858  top feature dist_to_fault_km
frontend/public/data/model_metrics.json  roc_auc 0.9858  top feature dist_to_fault_km
AI/outputs/model_metrics.json            roc_auc 0.9858  top feature dist_to_fault_km
```

`frontend/public/` is **served publicly** — `/data/model_metrics.json` returned
0.9858 AUC with the distance-to-mine feature on top to anyone who asked.
**Fixed:** all three deleted; the legacy trainer now stamps a `VALIDITY_WARNING`
and `superseded_by` into any regenerated file.

#### 3.3 `ProductionSentinel.tsx` — a live simulated SCADA feed

Live in `/features/[id]` and `/production`. Every 2.5 s it invented tonnages,
hourly rates, vibration readings, pump discharge and **dumper registration
numbers** (`MP-50-GA-1043`), labelled "SCADA telemetry" — while **PRD §4
non-goal 2 excludes SCADA integration entirely**. **Fixed:** seeded and
deterministic, relabelled throughout as a simulated activity feed with the
non-goal cited; invented plate numbers removed.

#### 3.4 Dead components carrying `jitter()` on data

`MissionControl.tsx` (0 referrers) and `globe/Charts.tsx` (only referrer was
`MissionControl`) contained `jitter()` applied to NDVI, soil moisture, land
temperature, rainfall and production — plus
`freshness: Math.random() > 0.7 ? 'stale' : 'fresh'`, which **randomly claimed
data was stale**. **Fixed:** both deleted after confirming zero references.

#### 3.5 Eight live claims of libraries that are not dependencies

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

#### 3.6 Six UI provenance claims Phase 3 missed

*"real statutory disclosures"*, *"1975–2025 Authentic History (MOIL/IBM Data)"*,
*"50-Yr Real MOIL Database"*, *"Derived directly from 50 years of IBM historical
data"*, *"(GSI/MOIL Core Drill Calibrated)"*, *"1,200+ Verified MOIL & IBM
Database Logs"*, plus *"GSI Diamond Boreholes"*. Phase 3 removed the false
attributions from the data file but left the UI labels asserting them.
**All fixed.**

#### 3.7 Guardrail violations

| Guardrail | Violation | Fix |
|---|---|---|
| (a) no subsurface from satellite | `AI/api/main.py` API description: *"Sub-surface Manganese Deposit Discovery"*; deck: *"map sub-surface manganese prospectivity"*; *"Cloud Penetration: 100% Operational"*; chatbot claiming SAR/NISAR *"penetrates 100% of cloud and rain"* | all reworded to surface-only with §2.2 cited |
| (b) no statutory UNFC | *"upgrade UNFC 122 to 111 reserves"*; chatbot: *"10,829 historical core drill logs … voxel block models of UNFC 111 proved reserves"* | replaced; no reserve class emitted |

#### 3.8 Verified clean

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

### 3.2 Since 74/100

**Fixed before this pass:** the `/evaluator` hardcoded feature-importance chart
(74-score §5; now read from the model, and `/evaluator` redirects to `/method`);
the map's fabricated layers (`c7e256c`, #15); the fabrications the rendered-page
provenance guard found on its first run (`ae9c20a`, #18); the prospectivity grid
rebuilt from the model (#19); stale-artifact refits on stage, and a guard that
let a test client write into the committed set (#24).

**Found and fixed in this pass** — the sweeps since Phase 8 have checked what
*renders*; these did not render, so they survived:

| # | Where | What it fabricated | Fixed |
|---|---|---|---|
| 1 | `GET /mines/{id}/risk` | an "audit" block with `last_evaluated` fixed at 2026-08-30T01:45:00Z and a model version naming no code, over silently defaulted operational inputs | removed (`2096fbc`) |
| 2 | `GET /mines/{id}/export-compliance-report` | a "Ministry of Steel" report: GOI-styled id, fixed timestamp, "reserve" figures from invented constant inputs, `compliance_status: APPROVED_FOR_DIRECTOR_REVIEW` | removed (`2096fbc`) |
| 3 | `GET /health` | `models_active` named a `random-forest-prospectivity-v1 (RandomForestClassifier)` that does not exist and omitted the real forecaster; listed USGS Landsat-8 as a source nothing reads | names read from the models' own version constants (`5674bbf`) |
| 4 | `GET /mines/{id}/reserve-prediction`, `/production-forecast` | a "reserve" score from default NDVI/soil/temperature and per-mine constants typed in by state and name; a forecast from default rainfall and downtime | removed (`88e7dda`, revertible on its own) |
| 5 | the console's downtime tile | titled "LIVE DOWNTIME HOURS" over a SYNTHETIC value | titled "downtime hours" (`2dd8d4a`) |

`backend/test_route_table.py` now keeps class 1–4 out from the route table
itself: no handler may return a date-time literal, a constant timestamp-like
field or any report id; no date-time literal anywhere in `backend/app`; the
removed paths stay absent; `/health` may name only what runs. Revert-proofed
against the code before each fix. With these, the five dead modules only those
endpoints used are gone too (`risk_model`, `shap_explainer`, `recommendations`,
`reserve_model`, `forecasting_model`).

**Fabrication tally:** nine clusters before Phase 8, six in it, one at the
74-score revision (`/evaluator`), **five in this pass** — all fixed. Every one
was in a legacy surface; none in the console built on `Metric`.

---

## 4. Score

Five dimensions, weighted as before. Each mark is re-derived, not adjusted, and
scores the code **as it is at the end of this pass**.

### PRD coverage — **18 / 25** *(was 17)*

59% fully, 30% partial, 11% missing. Track B, the PRD's spine, is 8/10 fully;
Track A 5/10. The four PRD-§10 deferrals are not penalised; N-7, a Required
non-functional, is. +1 for N-3, which is now met for everything that renders.
Still deducted for the partials that matter most: A-1 has no persistence, A-6/D-1
no zone resource estimate, C-1–C-3 templated rather than optimised actions, D-5
targets not on the map.
*(Since: B-6 and D-3 are partial, P(shortfall) being withdrawn from the screen,
D-044. The score is not re-derived here.)*

### Functional correctness — **19 / 25** *(was 18)*

What works is measured and published, including where it falls short: the
forecaster beats its baseline on a correct rolling-origin protocol; its daily
intervals held 0.812 on the pilot but 0.761 across the portfolio on the 20 September
dataset (0.806 and 0.785 on the dataset frozen on 7 October), and the 14-day
distribution behind P(shortfall) is too narrow — 0.738 on the committed dataset,
0.683 on the one regenerated for 6 October — measured, and a fix tried and
declined on a pre-registered rule (D-040). The constraint engine rejects what the
PRD names, now visibly, and Mine twin no longer leaves a stale verdict on screen.
+1: the `/evaluator` chart is fixed and the five fabrications found in this pass
are fixed, so no fabrication is known to remain. Still deducted for the
calibration, Track A's AUC leaning partly on terrain, alerts not wired to B-6,
and templated recommendations.

### Architecture — **17 / 20** *(was 16)*

The two tracks, one FastAPI service layer, a versioned contract and a structural
provenance envelope, as before. +1 for what was built under it: one dataset
identity across every artifact kind, staleness decided by identity (D-041), the
served dataset recorded with the artifacts (D-042), no computation on a request
path, map imagery that falls back to a labelled local cache, and a legacy surface
now either under the provenance guard (every route) or removed (the fabricating
endpoints). Still deducted for no persistence behind the contract (−2) and
Supabase against N-5 (−1).

### Code quality — **12 / 15** *(was 10)*

Biome errors down from 46 at the last score to 33, and CI fails any PR that adds
one; 42 decision records; 547 lines of fabricating legacy code removed with their
endpoints; the design system's fonts finally applied, and asserted. +2. Still
deducted: 33 Biome errors and 79 warnings remain, and the fonts bug and the
legacy fabrications were found only now, by a rehearsal and a route-table test,
after two redesign tranches and several sweeps had passed them.

### Testing & demo — **14 / 15** *(was 13)*

109 backend tests and 13 browser suites run on every PR in parallel jobs
(`docs/CI.md`), the browser suites with every external service unreachable, so a
green check does not depend on anyone's uptime. Revert-proofs throughout; the
committed-artifact guard active in CI and proven able to fail. The demo was
walked word for word from a fresh clone, twice, and with the network cut; the
rehearsals found and fixed a bug that would have broken the demo (D-042), a tile
fetch that died on one slow tile, and a stale on-screen verdict. +1. Still
deducted: two manually started processes, no component tests, and the axe audits
are not yet in CI because they fail offline on a real contrast defect (§5).
*(Since fixed, and the audits now gate CI — §5, "Since 80/100". The score is
not re-derived here.)*

### Total

```
PRD coverage        18/25   (was 17 — N-3 met for everything that renders)
Functional          19/25   (was 18 — no fabrication known to remain; stale verdict fixed)
Architecture        17/20   (was 16 — identity, served dataset, legacy API removed)
Code quality        12/15   (was 10 — lint debt down and gated; fonts applied; dead code gone)
Testing & demo      14/15   (was 13 — CI, hermetic browser suites, cold-start rehearsals)
                    ─────
                    80 / 100
```

**80/100 — a target, not a claim.** A jury weighting novelty or polish
differently could land meaningfully above or below it. The more useful numbers
are the 5 missing and 13 partial requirements, and the limits below.

---

## 5. Limits, stated plainly

### Calibration — the daily bands are close; the 14-day distribution is not

**On the frozen dataset** (actuals to 2026-10-07), the daily 80% intervals hold
**0.806 on the pilot's backtest** and **0.785 [0.761, 0.808] across all ten
mines**, an interval that includes the nominal 0.80. Balaghat's own, over 24
origin dates, is 0.802 [0.742, 0.862]; per mine they run from 0.760 to 0.819.
The 14-day distribution there is 0.717 [0.680, 0.749], with 0.163 in the outer
tails; that is measured, but withheld from the pitch (D-044).

**On the 20 September dataset**, the daily intervals held **0.812 on the pilot
mine** (Balaghat, its backtest window) but **0.761 [0.733, 0.786] across all ten
mines**, an interval that excludes the nominal 0.80. So across windows the daily
bands run at or slightly under nominal, and are described as close to
calibrated, not calibrated. The 14-day cumulative distribution — the one
P(shortfall) is computed from — is narrower still: **0.738 [0.700, 0.777]**, with
**0.165** of realised totals in the outer tails against a nominal 0.10. Per mine
it ranges from **0.542** (Beldongri) to **0.903** (Ukwa); **Balaghat, the pilot,
is 0.667 [0.521, 0.802]**. On the dataset regenerated for 6 October in the
cold-start rehearsal, the same measurement gave **0.683 [0.636, 0.728]**
(Balaghat 0.677) — below nominal on both windows. P(shortfall) is therefore more
confident than the model has earned, most of all near 0 and 1. A fix (a
common-factor loading) was measured on a pre-registered rule and declined because
it did not beat the model as shipped (D-040). D-043 then found the aggregation
itself unsound, and **P(shortfall) is withdrawn from the screen and the pitch**
(D-044). The console shows the daily bands' calibration beside them — portfolio
and mine, each with its interval. Source: `docs/CALIBRATION.md`,
`backend/artifacts/calibration/cumulative_coverage.json`.

### Track A — 0.85 is softer than it looks

Leave-one-mine-out AUC **0.85, 95% CI [0.723, 0.95]** on ten positives. Spectral
features alone reach **0.60**, terrain alone **0.665**, slope alone **0.511**
(chance); the top feature is elevation (40.6%). Mines sit on flat ground, so
part of what the model learns is where mines are built. Four of ten deposits
score below 0.35 and **Tirodi (0.018) is essentially missed**. GSI lithology —
the feature most likely to carry real geology — was unreachable and is
**omitted, not substituted**. The earlier pipeline's 0.98 measured leakage
(features computed from the known mine locations, which are the labels);
§3.1, `docs/TRACK_A.md`.

### Synthetic operational data

Production, equipment and blasting rows are generated to the published contract
because MOIL's are proprietary (PRD §8.2); every row says `is_synthetic=true`
and the UI badges it. **The forecaster's margin over its baseline is partly a
property of the generator**, which makes production depend on covariates the
baseline cannot see — it shows the pipeline is sound, not how it would do on
MOIL's operations. The figures also move with the dataset window: regenerated
for 6 October, the pilot's backtest reads MAPE 11.00% vs 13.22%, coverage 0.819.

### Live-service dependencies — measured with the network cut

The network-loss rehearsal (2026-10-06): a complete pre-flight, then every
external service made unreachable for the backend, the Next server and the
browser, servers restarted (harsher than a real cut, which keeps in-memory
caches), and the whole demo walked. **All 24 demo beats passed.**

| Service | Used for | With the network gone |
|---|---|---|
| NASA POWER, Open-Meteo | rainfall, temperature | tiles switch to SYNTHETIC fallback values under a red "DEGRADED — live upstream unavailable. Displayed values are synthetic and must not be read as observations." |
| Earth Search STAC | Sentinel-2 scene metadata | `/satellite` answers `is_live: false` with the error and no scenes — none invented (`test_upstreams_degrade_honestly_when_unreachable`) |
| Planetary Computer | three imagery layers | drawn **from the local tile cache**, labelled CACHED with the fetch date (needs `batch tiles` the day before) |
| Planetary Computer | Track A "fetch live Sentinel-2" | answers at once with the kriged score and *"Live satellite read failed; only the kriged surface is returned"* |
| ESRI World Imagery | basemap | **blank** — no cache; the model layers draw over the empty map |
| Google Fonts | build only | nothing at run time: the fonts are served by the app (`test:fonts`, offline) |
| Supabase | sign-in | fails closed; the console does not need it |

Survives untouched: every forecast, the backtest and the calibration (artifacts),
the three model map layers, Mine twin and its constraint engine, the fonts.

### Found in this pass, and fixed

- **The day-before regeneration was undone on demo morning** — D-042.
- **One slow tile ended the day-before tile fetch** with a traceback and no
  manifest — now retried, counted and survivable (`c39c4a5`).
- **Five fabrications in legacy surfaces** — §3.2.
- **The web fonts were never applied** — fixed and asserted (`d96c384`).
- **Mine twin kept a stale verdict** after a control changed — now cleared in the
  same render (`ea015e0`).

### Since 80/100 — the final hardening PR

- **The switcher's contrast is fixed** with the selected-row token ("ON" 3.86 →
  5.19:1, "unavailable" 4.43 → 5.96:1), and **both axe audits gate CI**, with
  every status label measured beside axe (`docs/CI.md`).
- **The workflow is hardened and checked**: actions pinned to commit SHAs,
  checkout credentials dropped, read-only token, timeouts, and a check that
  fails if any of it regresses.
- **An API provenance guard** calls every GET route and fails on a number with
  no provenance, or a model version the code does not define — the class
  `/health` belonged to. Nine routes that carried no provenance header now say where their
  numbers come from.
- **The pitch figures are written from what is served** (`docs/PITCH_FIGURES.md`)
  and checked against it, and the docs that quote them are checked too.

### Fixed in #31 — expected shortfall per grade, at the source

- **The API serves a mine's expected shortfall as its grades' own, summed.**
  `track_b.mine_shortfall_tonnes` computes Σ max(0, plan − expected) per grade.
  - **The netted figure is not served** under any name.
  - **The console reads the API's figure** instead of adding the grades itself,
    and `test:e2e` still checks the tile against the grade chips.
- **Corrective actions are sized from it.** Balaghat's candidates on the frozen
  dataset are now sized from 95.5 t, not 18.3 t.
  - `test_shortfall_per_grade.py` pins this with constructed cases, every
    served artifact, and the sizing through the API.
  - Against main's code it fails, on Balaghat's 18.3 t.
- **Regenerated on the same frozen date, 2026-10-07.** Compared with main value
  for value, only the mines' `portfolio.expected_shortfall_tonnes` moved, every
  one to the figure the console already showed.
  - The backtest, the calibration and every other forecast field are unchanged.
  - Track A is untouched.
  - `PITCH_FIGURES.md` changed only in the code-fingerprint lines of its
    identity block: every figure is identical.
- **Pre-flight checks memory now** (`scripts/check_memory.sh`): the OS's
  pressure level must be normal.
  - **During a run, the signal is the per-forecast time `batch all` prints:**
    about 25 s normally, minutes when the machine pages.
  - **Swap is not used as the signal,** because it misled: it grew by 1.5 GB on
    the regeneration for #31 while every forecast fitted at full speed.
- **Found here, fixed in #32: calling a serving function outside the app could
  overwrite a committed artifact with another dataset's forecast.**
  - **How it happened:** the recorded end date is adopted only when `app.main`
    starts. A script that imported `app.api.track_b` built the generator's
    default dataset (2026-09-20). Asking for a forecast found no matching
    artifact, so the warmer computed one and wrote it over the frozen Balaghat
    file.
  - **How it was caught:** the value-for-value comparison caught it, and
    `batch all` restored it before anything was committed.
  - **The fix is in #32 (D-046):** the write path now refuses it; see below.

### Fixed in #32 — artifact writes guarded at the write path

**Every write into `backend/artifacts/` checks first** — forecasts, the
backtest, the calibration. The artifact's dataset identity is compared with
`data/synthetic/_dataset_identity.json`, and a mismatch is refused with both
datasets named.
- **The record:** it moves only through `batch all` with an explicit
  `NAKSHATRA_DATA_END_DATE`, which writes the record first.
- **Another date:** computing for it is still allowed. The warmer logs the
  refusal and keeps the forecast in memory.
- **The app:** it adopts the record, so it is unaffected.
- **The tests:** `test_artifact_write_guard.py` reproduces the #31 incident on a
  temporary copy; on main it overwrites. It also runs `batch all` with an
  explicit date, and the app path.
- **The rest of the record:** this is the fourth write of its kind into the
  committed set; the first three are in D-046.

### Found in the pitch-safe interim PR (#30)

- **The console's "expected shortfall" netted grades against each other.** The
  API's mine-level figure is max(0, Σ plan − Σ expected), so a surplus in one
  grade cancelled a deficit in another. PRD §3 says grades are not fungible, and
  the console's own grade panel said so.
  - On the 20 September forecasts it read 0 t for Beldongri and Gumgaon, which
    are short in one grade (0.5 t and 10.2 t). Mansar read 128.0 t against
    150.5 t, and Chikla 164.4 t against 169.9 t.
  - **On the frozen dataset it matters more.** Balaghat, the pilot, nets to
    18.3 t while its grades are short by 95.5 t in all; Bharweli nets to 374.0 t
    against 746.0 t.
  - The console now sums each grade's own shortfall. That figure ranks the
    mines and is the focal number. `test:e2e` checks the tile against the grade
    chips.
  - **Still netted:** the recommendation engine sized its candidate actions from
    the API's netted figure (`track_b.recommend_actions`). A mine short in one
    grade but netting to 0 t showed a shortfall and no corrective action. On
    the frozen dataset, Balaghat's actions were sized from 18.3 t while the
    console showed 95.5 t. *Fixed in #31, below.*
- **P(shortfall) contradicted its own mean.** On the frozen dataset, Chikla's
  expected production is at or above plan in every grade, so its expected
  shortfall is 0 t, yet its worst-grade P(shortfall) is 0.968. It is not shown.
- **The freeze could not have been committed before.**
  `test_served_dataset.py` pinned the committed dataset record to the
  generator's built-in default, and a committed freeze necessarily records its
  own date (DEMO.md step 5). No freeze had been committed, so nothing had
  hit it. It is restated as what D-042 needs: the record and the committed
  artifacts name one dataset. It fails when they disagree, which was checked.
- **Expected shortfall barely depends on how the 14-day total is built.** On the
  pilot, the served expected production per grade is within 2.9 t of its exact,
  dependence-free expectation, inside Monte Carlo error. Independent lognormal
  days move it by 2–15 t, about 0.3%, and the sum of daily medians by 4–13 t.
  So the focal figure does not lean on the premise D-043 falsified, and a test
  (`test_track_b.py::test_expected_shortfall_does_not_depend_on_how_days_correlate`)
  ties the served figure to that expectation. Its tolerance, four Monte Carlo
  standard errors, is about 0.3% of each grade's total. So it catches a larger
  error, and the 0.3% shift from independent lognormal days sits just inside
  it.

### Found in the residual-fix PR (#29)

- **The blending tool never used the planner's tonnage.** The Next proxy sent
  `required_tonnes`; the backend's field was `target_tonnes`, which defaulted to
  5,000 t and silently ignored the unknown key. Whatever the slider said, every
  plan was for 5,000 t.
  - **The earlier verification of this tool was incomplete.** `test_api.py`
    posted straight to FastAPI with the right field name, and `test:routes`
    only checked that `/blending` rendered. Nothing sent a tonnage through the
    proxy and looked at what came back.
  - **Fixed** (`bc1febb`): every field is required, unknown fields are
    rejected, and the proxy sends `target_tonnes`. `npm run test:blending` now
    sets the slider to 7,500 t in the browser and asserts the request carries
    it, the response echoes it, and the plan's allocations sum to it.
  - **The same endpoint also defaulted its whole request** — four stockpiles
    named after real mines — so `{}` returned an "optimal" plan for inventory
    nobody holds. The API guard now rejects an empty body and any numeric
    default on every POST route.
- **The 14-day P(shortfall) rests on a premise that does not hold** (D-043,
  `docs/QUANTILE_CROSSING.md`). Its block bootstrap assumes one-step residuals
  persist across days.
  - **They barely do:** each grade's daily lag-1 is 0.02–0.30.
  - **Where the apparent persistence came from:** the series it resampled
    interleaved three or four grades per day, so a "14-day" block replayed
    about three and a half days of shocks shared between grades.
  - **No pre-registered fix passed**, so served P(shortfall) is unchanged, and
    the regenerated artifacts match main's figure for figure.
  - **Measured on eight datasets, what is served fails a basic sanity check on
    every one:**
    - narrower than independent days on five;
    - one residual moving a mine's scale by 10% or more on all eight;
    - saturated on two.
  - **The calibration figures** (0.738 on the committed dataset) are measured
    honestly, but the mechanism behind them is this accident.
- **The quantile models cross** on about one row in ten. Served intervals are
  now guaranteed ordered: `predict` sorts after the conformal step, which on
  main had re-crossed 2 and 16 of 11,424 backtest intervals. The chart's median
  is checked against its band for every mine and grade.

### Still open

- **P(shortfall)'s 14-day distribution is unsound,** not only Balaghat's on
  6 October:
  - D-043 measured main's construction failing on all eight datasets tried;
  - no pre-registered fix passed;
  - the checks are strict xfails in `test_track_b.py` and
    `test_track_b_dates.py`, so they cannot quietly change.

  So P(shortfall) is off the screen and out of the pitch until a fix passes its
  pre-registered test (D-044). The pitch dataset is frozen without it, on
  2026-10-07, for the window 8–21 October 2026.
  - **D-045 tried two replacements and neither passed.** Both estimated from
    the forecaster's held-out calibration slice and came out too narrow: about
    1.2× the independent-days spread, against the roughly 1.7× the real 14-day
    errors show (`docs/SHORTFALL_PROBABILITY.md`).
- **The basemap has no offline fallback** (above).
- **A cold backend saturates**: while it refits, telemetry requests can time out
  and the console shows "DEGRADED — FastAPI service layer unreachable" beside
  the "Computing" state (`docs/evidence/console-forecast-warming.png`). The
  pre-flight exists so this is never on stage.
- **The console's constraint-rejection list has never shown a rejection** with
  real data: no candidate violates a constraint at any of the ten mines. The
  engine's rejection *is* seen on Mine twin (C-5).
- **Leaked keys need manual rotation.** A Supabase anon key and Firebase web
  config were in this repository's history; removed from the tree in Phase 1,
  not from history. Rotate at the provider.
- **Still partial:** A-1, A-6/D-1, A-8, A-10, B-8, C-1/C-2/C-3, D-5, D-6, N-5.

---

## 6. The three most important next actions

**1. Estimate the 14-day spread from errors at real forecast origins, then
decide whether P(shortfall) comes back.**
- **What D-045 found** (`docs/SHORTFALL_PROBABILITY.md`):
  - estimators built on the forecaster's own held-out calibration slice are too
    narrow, because that slice's errors understate the errors at a forecast
    origin;
  - #20's 2.5–3.4× gap was mostly the totals' own variability. The forecast
    error needs about 1.7×, not 3×.
- **The untested version is the one originally asked for:** horizon dependence,
  or conformal calibration of the 14-day total, estimated from rolling-origin
  backtest errors.
- **It needs its own pre-registration,** and a committed backtest for every
  mine to serve it.
- **Until a fix passes,** P stays withdrawn; the demo window is frozen without
  it.

**2. Implement N-7, the recommendation audit log.** The only *Required*
non-functional still missing, and it unblocks C-7: persist every issued
recommendation with its constraint verdict, then capture accept/reject with a
reason.

**3. Make the intervals honest at 14 days.** The cumulative calibration (0.738 and
0.683 on two windows, tails 0.165) is what a planner acts on through
P(shortfall). The per-mine loading that came closest is in the backlog as a fresh
pre-registered replication on an independent seed (D-040).
