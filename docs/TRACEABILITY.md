# PRD → Code Traceability Matrix

**Sources of truth:** `SIH26009-01-PRD.md` and `SIH26009-Architecture.excalidraw`, both at repo root.
**Assessed against:** `main` @ `34b9e5d` (Phase 1 + Phase 2 merged).
**Date:** 2026-09-21.

Status values: **fully** / **partial** / **missing** / **broken** / **fabricated**.

> UI existing ≠ feature existing. Every status below is traced to code or test output, not to the presence of a screen.

---

## 0. Tag legend (from PRD §0.1)

| Tag | Meaning |
|---|---|
| **[PS]** | Stated in the official problem statement. Non-negotiable. |
| **[D]** | Derived — a direct, necessary consequence of a [PS] item. |
| **[P]** | Proposed design decision. Ours. Replaceable. |
| **[A]** | Assumption requiring verification. |

### Architecture-diagram tags resolved against PRD requirement IDs

| Diagram tag | Resolves to |
|---|---|
| `[PS D-1..D-4]` on L5 DASHBOARD | PRD §6.4 D-1 predicted reserves, D-2 production trends, D-3 shortfall risk, D-4 corrective steps |
| `[PS C-1..C-3]` on RECOMMENDER | PRD §6.3 C-1 schedule adjustment, C-2 blasting optimisation, C-3 equipment redeployment |
| `[PS C-4]` on "each action → expected Δ" | PRD §6.3 C-4 expected effect + assumptions |
| `[D]` on CONSTRAINT ENGINE | PRD §6.3 C-5 "never propose the physically impossible" |
| `[D · UNFC boundary]` on Track A outputs | PRD §2.4 scope boundary; PRD §4 non-goal 1 |
| `[D]` on Backtest harness | PRD §6.2 B-10 + §7 N-8 |
| `[P · Phase 2]` on InSAR deformation | PRD §6.1 A-9 (P2) + §10 Phase 2 |

---

## 1. Track A — Reserve identification and mapping (PRD §6.1)

| ID | Requirement | Tag | Pri | Status | Evidence |
|---|---|---|---|---|---|
| A-1 | Ingest borehole collars, downhole assays, lithology logs, surface geological maps | [PS] | P0 | **partial** | `POST /analyze-borehole-drill` accepts inline borehole items (`backend/app/api/routes.py:293-300`) and computes a spatial model. There is **no ingestion schema** for assays, lithology or surface maps, and no persistence — `database/schema.sql` has 4 tables, none geological. Phase 3. |
| A-2 | Ingest satellite surface indicators: multispectral bands, derived ratios, DEM slope/lineaments | [PS] | P0 | **fabricated** | Band values are **not measured**. `AI/scripts/features.py:83-99` computes `iron_oxide = 0.30 + 0.45*proximity + …` where `proximity` is distance to `KNOWN_FAULTS` — which are the mine coordinates. No raster is ever read. Documented in `docs/INTEGRITY.md` §4. Phase 5. |
| A-3 | Produce a gridded prospectivity surface over the licence area | [D] | P0 | **partial** | A grid is produced (`AI/scripts/04_predict_grid.py`, ~0.06° step over 20.5–22.5N / 78.5–80.8E) and exported to `frontend/public/data/prospectivity.geojson`. The surface exists; its **inputs are invalid** (A-2). Phase 5. |
| A-4 | Report per-cell **uncertainty**, not a bare score | [D] | P0 | **missing** | GeoJSON feature properties are `probability, confidence, <10 features>, timestamp`. `confidence` is a bucket label derived from `probability` (`features.py:141-146`), not an uncertainty. No variance, no interval. PRD/diagram call for kriging variance. Phase 5. |
| A-5 | Rank candidate drill targets with the evidence that drove each ranking | [D] | P0 | **missing** | No ranking exists — cells carry a probability, nothing orders or justifies targets. Phase 5. |
| A-6 | Estimate tonnage and grade over a user-drawn zone from the interpolated resource model | [D] | P1 | **partial** | `compute_borehole_spatial_model` returns in-situ tonnage + weighted grade, but from supplied boreholes, not a user-drawn zone over an interpolated model. No variogram/kriging. |
| A-7 | Feature attribution — which inputs drove a prospectivity score | [P] | P1 | **missing** | `/predict` returns the feature vector but no attribution. |
| A-8 | Version every model run and record its inputs, so a result is reproducible | [D] | P1 | **partial** | `model: "random-forest-prospectivity-v1"` is returned and features are now seeded/deterministic (`features.py:70-80`); verified identical on repeat calls. No run registry or input manifest. |
| A-9 | InSAR-derived subsidence overlay | [P] | P2 | **missing** | Out of Phase-1 MVP per PRD §10. Not scheduled. |
| A-10 | Export targets as GeoJSON / shapefile | [P] | P1 | **partial** | GeoJSON export works (`frontend/public/data/prospectivity.geojson`, path fixed in Phase 2). Exports *cells*, not ranked *targets* (blocked on A-5). No shapefile. |

## 2. Track B — Production shortfall prediction (PRD §6.2) — **the spine**

> PRD §10: *"**Lead with Track B.** It is where the satellite inputs the PS names actually apply, it is demonstrable on obtainable data, and it is the half MOIL can act on next month."*

| ID | Requirement | Tag | Pri | Status | Evidence |
|---|---|---|---|---|---|
| B-1 | Ingest historical production **by mine, grade and period** | [PS] | P0 | **partial** | `POST /upload-operational-csv` exists (`routes.py:210`). `frontend/src/lib/historical-database.ts` holds a 1977–2026 series that is **hardcoded, not grade-split**. No versioned schema. Phase 3. |
| B-2 | Ingest equipment performance and downtime records | [PS] | P0 | **missing** | Downtime is generated, not ingested — seeded synthetic, correctly flagged (`frontend/src/lib/synthetic.ts`). No schema, no ingestion path. Phase 3. |
| B-3 | Ingest blasting records — schedule, delays, fragmentation | [PS] | P0 | **missing** | Blast counts are seeded synthetic. No schema. Phase 3. |
| B-4 | Ingest weather: rainfall, soil moisture, LST, NDVI — observed **and forecast** | [PS] | P0 | **fully** | Two independent live paths, both verified: NASA POWER (`backend/app/services/nasa_power.py`; test prints `rainfall_14d_mm 106.55, is_live True`) and Open-Meteo past+forecast split (`telemetry/route.ts:77-110`). NDVI/LST not ingested — partial on that field. |
| B-5 | Forecast production **per mine per grade** over a configurable horizon | [PS] | P0 | **broken** | A 14-day trajectory exists but it is a **deterministic drag model, not a forecaster** — no fitted parameters, no learning from history (`telemetry/route.ts`, `backend/app/ml/forecasting_model.py`). **Not grade-aware at all.** Horizon fixed at 14. Phase 4. |
| B-6 | Shortfall risk vs planned target, **as a probability with a confidence band** | [PS] | P0 | **missing** | A `shortfall_percentage` scalar is produced; there is **no probability and no band**. The provenance envelope states this explicitly: *"Deterministic model with no fitted parameters — no statistical interval is defined"* (`telemetry/route.ts:383`). Diagram requires `P(cumulative < plan_target)`. Phase 4. |
| B-7 | **Attribute** shortfall to equipment / weather / blasting | [D] | P0 | **partial** | An exact additive decomposition exists and is honestly named (`additive-driver-attribution-v1`). It attributes a *rule-based* score, not a fitted forecast — it will need rebasing onto the real model. Phase 4. |
| B-8 | Alert when shortfall probability crosses a threshold | [D] | P1 | **partial** | `POST /dispatch-operational-alert` + `GET /alerts` work (test: `Alert ALT-MOIL-1-… Tier-1`). Not driven by a probability threshold, because B-6 has no probability. |
| B-9 | Grade-aware forecasting — shortfalls are not fungible across grades | [D] | P1 | **missing** | Nothing in the forecast path is grade-split. PRD §3: *"a shortfall in one grade is not fungible with a surplus in another."* Phase 4. |
| B-10 | **Backtest against held-out history and display the error** | [D] | **P0** | **missing** | No backtest anywhere. `grep -rn "backtest\|MAPE\|rolling.origin"` returns only comments promising it. Phase 4. |

## 3. Corrective action recommendation (PRD §6.3)

| ID | Requirement | Tag | Pri | Status | Evidence |
|---|---|---|---|---|---|
| C-1 | Recommend schedule adjustments | [PS] | P0 | **partial** | `buildActions()` emits rule-triggered actions (`telemetry/route.ts:430-478`); `backend/app/services/recommendations.py` exists. Actions are templated text, not schedule deltas. |
| C-2 | Recommend blasting optimisation — timing, sequencing | [PS] | P0 | **partial** | A "recover blasting schedule" action fires below a threshold; no timing or sequencing is computed. |
| C-3 | Recommend equipment redeployment across faces or mines | [PS] | P0 | **partial** | A maintenance action exists; no redeployment across faces/mines, and no feasibility check. |
| C-4 | Every recommendation states expected effect + assumptions | [D] | P0 | **partial** | Each action carries `reason`, `impact`, `basis`. `impact` is an upper bound from the drag share, **not an expected Δ shortfall probability** (diagram `[PS C-4]` requires the latter; blocked on B-6). |
| C-5 | **Recommendations respect hard operating constraints — never propose the physically impossible** | [D] | **P0** | **missing** | **No constraint engine exists.** The only enforced constraints are inside the blend LP (`blending_optimizer.py`), which is genuine and now reports infeasible honestly. Nothing gates schedule/blasting/equipment actions. PRD: *"C-5 is load-bearing."* Phase 4. |
| C-6 | Scenario comparison | [P] | P1 | **missing** | Out of Phase-1 MVP per PRD §10. |
| C-7 | Human accept/reject with reason captured | [P] | P1 | **missing** | See N-7. |

## 4. Dashboard (PRD §6.4)

| ID | Requirement | Tag | Pri | Status | Evidence |
|---|---|---|---|---|---|
| D-1 | Show **predicted reserves** | [PS] | P0 | **partial** | Deliberately emptied in Phase 1: `reserve.estimated_ore_grade`/`prospect_depth_m` are `null` with a note, because the previous values were hardcoded and presented as model output. Honest but currently empty; refilled by Phase 5. Must stay typed `prospectivity_score`/`grade_estimate`, never "reserve" (PRD §2.4). |
| D-2 | Show **production trends** | [PS] | P0 | **partial** | Trend UI exists over the hardcoded 1977–2026 series (`historical-database.ts`). Replaced by the flagged generator in Phase 3. |
| D-3 | Show **shortfall risk** | [PS] | P0 | **partial** | A risk score and level render; not the probability B-6 requires. |
| D-4 | Show **recommended corrective steps** | [PS] | P0 | **partial** | Actions render; ungated by C-5. |
| D-5 | Map view with prospectivity, mine boundaries, drill targets | [D] | P0 | **partial** | Map + prospectivity layer exist; no drill targets (A-5). |
| D-6 | Drill-down portfolio → mine → face/section | [P] | P1 | **missing** | Mine selection exists; no face/section level. Phase 6. |
| D-7 | **Evidence panel — inputs, model version, date, uncertainty for any figure** | [D] | **P0** | **partial** | The envelope is produced and complete server-side (`frontend/src/lib/provenance.ts`, `provenance` + `data_integrity` blocks). **No UI component reads it** — `grep -rln "provenance" frontend/src/components` returns nothing. The data is there; the panel is not. Phase 6. |
| D-8 | Export to PDF/Excel | [P] | P1 | **missing** | Out of Phase-1 MVP per PRD §10. Phase 6. |
| D-9 | Role-based views | [P] | P2 | **missing** | Out of Phase-1 MVP. |

## 5. Non-functional (PRD §7)

| ID | Requirement | Target | Status | Evidence |
|---|---|---|---|---|
| N-1 | Dashboard interaction latency | < 2 s p95 cached | **unverified** | Never measured. Phase 7. |
| N-2 | Forecast refresh — nightly batch + on-demand | — | **missing** | No scheduler. |
| N-3 | Every displayed number carries model version, input vintage, uncertainty | 100% | **partial** | Server-side complete; UI does not render it (see D-7). `uncertainty` is `null` on most fields because no model yet produces an interval (B-6). |
| N-4 | **Reproducibility — same inputs, same model version, same output** | Exact | **fully** | Verified twice: telemetry `provenance[*].value` identical across calls (only `vintage` differs); `/predict` byte-identical for the same coordinates. Seeded generators throughout (`synthetic.ts`, `features.py:70-80`). |
| N-5 | On-premise deployable, no mandatory external cloud | — | **partial** | Supabase is used for auth/profiles — an external dependency. Weather/STAC are external by nature but degrade gracefully. |
| N-6 | **Degrades gracefully, states staleness, never silently extrapolates** | Required | **fully** | `data_integrity` reports `live_sources_ok`, `degraded_reason`, `staleness_seconds`; degraded mode is explicitly synthetic and issues no recommendation (`mission-control/data.ts`). |
| N-7 | Audit log of every recommendation and its disposition | Required | **missing** | No audit table or endpoint. Also blocks C-7. |
| N-8 | **Forecast accuracy from a held-out backtest, visible in the UI** | Required | **missing** | See B-10. Phase 4. |

---

## 6. Score by requirement group

| Group | P0 reqs | fully | partial | missing/broken/fabricated |
|---|---|---|---|---|
| Track A (A-1..A-10) | 5 | 0 | 5 | 5 |
| Track B (B-1..B-10) | 7 | 1 | 4 | 5 |
| Corrective (C-1..C-7) | 5 | 0 | 4 | 3 |
| Dashboard (D-1..D-9) | 6 | 0 | 6 | 3 |
| Non-functional (N-1..N-8) | — | 2 | 3 | 3 |

**Nothing in Track A is fully implemented.** Track B's only complete requirement is weather ingestion. The system's honest core today is: real weather, a real LP, real STAC, correct provenance plumbing, and no fabrication — with the actual predictive machinery (B-5, B-6, B-10) and the constraint engine (C-5) still to build.

---

## 7. PRD vs. prompt — conflicts, PRD wins

### 7.1 Ventilation is a **non-goal**, not a constraint dimension ⚠️

The architecture diagram lists the constraint engine as *"shifts · blasting windows · equipment compatibility · relocation · **ventilation**"*. The prompt asked to confirm that scope.

**PRD §4 non-goal 6: "Mine safety and ventilation management." [P]**

These contradict. **PRD wins: ventilation is out of scope** and will not be built as a constraint dimension. The constraint engine implements shifts, blasting windows, equipment compatibility and relocation feasibility. Noted in `docs/DECISIONS.md`.

### 7.2 Drill targets by "expected information gain" is **[P]**, not a requirement

The prompt said this "materially changes the Phase 5 deliverable" if the PRD confirms it. **The PRD does not confirm it.** A-5 requires only: *"Rank candidate drill targets with the evidence that drove each ranking"* [D] P0. Expected information gain appears solely in the diagram's LEGEND, under *"★ differentiator"* — i.e. a proposed design flourish.

**Resolution:** A-5's requirement (ranking + evidence) is P0 and will be built. EIG is an optional [P] refinement on top, attempted only if Phase 5 completes with room to spare. Building EIG *instead of* evidence-backed ranking would miss the actual requirement.

### 7.3 GBT + ordinary kriging is **[P]** — supported, not mandated

The PRD never names an algorithm for A-3. The diagram specifies gradient-boosted trees over surface indicators plus a variogram + ordinary kriging resource model, and PRD §12 notes the work is *"mostly gradient boosting, classical geostatistics and forecasting."* Consistent, but a design decision, not [PS]/[D].

**Resolution:** adopt the diagram's design (GBT + kriging) because kriging variance directly satisfies **A-4 per-cell uncertainty**, which the current RandomForest does not. The driver is A-4, not the algorithm name.

### 7.4 Track A bypasses the decision layer — **confirmed in substance**

Diagram: *"Track A output goes straight to the dashboard. The decision layer serves Track B only."* The PRD supports this structurally — §2.1 separates the tracks by data, method, user and horizon, and every C-requirement is Track B. **Adopted.**

Track A output typed `prospectivity_score` / `grade_estimate`, **never "reserve"** — this one is strongly PRD-backed (§2.4, §4 non-goal 1) and is already enforced (Phase 1 removed the UNFC labels; Phase 2 removed them from the backend).

Note the wording trap: **D-1 is literally "Show predicted reserves" [PS]** because that is the official PS text. It is satisfied by showing prospectivity and resource estimates with the §2.4 boundary stated in the UI — not by showing a statutory figure.

### 7.5 Pilot AOI — Balaghat for Track B, but the PRD suggests **opencast** for Track A

PRD §13 Q4: *"Which mine is the pilot AOI? Recommendation: **Balaghat** (largest, deepest, best documented) for Track B; **an opencast mine such as Dongri Buzurg is easier for Track A** surface work."*

The prompt says pilot = Balaghat, which matches for Phase 4 (Track B). **Delta:** Phase 5 Track A work should prefer an opencast AOI — Dongri Buzurg — because surface spectral work needs exposed ground, and Balaghat is underground at ~383 m. Phase 5 will use Dongri Buzurg as the primary Track A AOI and state why.

### 7.6 Requirements the prompt's roadmap under-weights

- **B-5 is grade-aware at P0**, not just B-9 at P1: *"Forecast production per mine **per grade**"* [PS]. The roadmap's Phase 4 wording omits grade. Grade-awareness is therefore part of Phase 4, not optional.
- **§8.4: "area and tonnage computations in an equal-area or appropriate UTM projection, never in degrees."** Current code computes distance as `degrees × 111.0` (`features.py:58-62`). A real violation; Phase 5 must reproject.
- **N-7 audit log** is a Required non-functional with no roadmap phase. Assigned to Phase 6 alongside C-7.

### 7.7 Timeline risk outside the codebase ⚠️

PRD §0.3 and §13 Q1 flag the idea-submission deadline as **contested: 20 Sep 2026 vs 30 Sep 2026**, with the instruction *"Verify on sih.gov.in today."* **Today is 21 Sep 2026** — the earlier of the two dates has passed. This is a project-level risk that no amount of engineering fixes, and it is surfaced here because the PRD demands verification. Not actionable from this repo.

---

## 8. Reconciliation with `PROGRESS.md`

The earlier audit was driven by the engineering brief, before the PRD was available. Deltas:

| Delta | Effect |
|---|---|
| The brief had no requirement IDs | All work now maps to A-/B-/C-/D-/N- IDs. |
| Brief treated "forecaster" as one item | Splits into B-5 (per-mine **per-grade** forecast), B-6 (probability + band), B-10 (backtest) — three P0s. |
| Brief did not mention grade-awareness | B-5 [PS] P0 + B-9 [D] P1. Newly surfaced. |
| Brief said "constraint engine (shift windows, blasting windows, equipment relocation)" | Confirmed as C-5 [D] **P0, load-bearing** — minus ventilation (§7.1). |
| Brief implied EIG ranking for Phase 5 | Downgraded to [P]; A-5 evidence-backed ranking is the actual P0 (§7.2). |
| Brief said pilot = Balaghat throughout | Holds for Track B; Track A should use an opencast AOI (§7.5). |
| Brief had no projection requirement | §8.4 adds one; current degree-based distance violates it (§7.6). |
| Brief had no audit-log requirement | N-7 Required, C-7 P1. |
| Phase 1/2 work validated | The integrity and security work maps cleanly onto N-3, N-4, N-6 and §2.4, and none of it is contradicted by the PRD. |

---

## 9. Phase priority set by this matrix

PRD §10 is explicit — **lead with Track B** — and the P0 gaps concentrate there.

| Order | Phase | Requirements closed | Why here |
|---|---|---|---|
| 1 | **2.5** Wire UI → FastAPI | precondition for D-1..D-4, N-1 | The real LP and NASA POWER client are unreachable from the UI; nothing else can be traced end-to-end until this is fixed. |
| 2 | **3** Ingestion contract | A-1, B-1, B-2, B-3 | PRD §8.2: *"The contract is a deliverable in its own right."* Blocks the forecaster — no schema, no training data. |
| 3 | **4** Track B | B-5, B-6, B-7, B-9, B-10, C-4, C-5, N-8 | The spine. Eight P0/P1 requirements, including the two load-bearing ones (B-10, C-5). |
| 4 | **5** Track A | A-2, A-3, A-4, A-5, A-10 | Removes the only remaining **fabricated** status in the matrix. |
| 5 | **6** Dashboard | D-6, D-7, D-8, C-7, N-7 | D-7 is P0 and needs only UI work — the data already exists. |
| 6 | **7** Testing/perf | N-1, N-4 | Verification. |
| 7 | **8** Readiness | all | Honest re-score. |
