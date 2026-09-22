# Nakshatra-X — Progress & Traceability

SIH 2026, problem statement SIH26009 (Ministry of Steel / MOIL).
Living document. Status values: **done** / **partial** / **missing** /
**broken** / **fabricated** / **blocked**.

Last updated: 2026-09-21.

---

## PRD received — traceability matrix is now authoritative

`SIH26009-01-PRD.md` and `SIH26009-Architecture.excalidraw` are committed at the
repo root (`34b9e5d`). The earlier blocker is cleared.

**`docs/TRACEABILITY.md` is now the authoritative status document.** It maps
every PRD requirement (A-1..A-10, B-1..B-10, C-1..C-7, D-1..D-9, N-1..N-8) to a
status and evidence, resolves the architecture diagram's `[PS …]` / `[D]` / `[P]`
tags against requirement IDs, and records where the PRD overrides the
engineering brief. This file tracks phase execution; the matrix tracks
requirement coverage.

### Deltas the PRD introduced (full detail in TRACEABILITY.md §7–8)

- **Ventilation is a PRD non-goal** (§4 non-goal 6) but appears in the diagram's
  constraint engine. PRD wins — ventilation is not built.
- **Drill targets by expected information gain is [P], not a requirement.**
  A-5 requires ranking *with evidence*; EIG is a diagram "★ differentiator".
- **B-5 is grade-aware at P0** — "forecast production per mine **per grade**".
  The brief omitted grade entirely.
- **Track A pilot should be opencast** (Dongri Buzurg), not Balaghat — surface
  spectral work needs exposed ground. Balaghat remains the Track B pilot.
- **PRD §8.4 forbids computing area/tonnage in degrees.** Current code uses
  `degrees × 111.0`; a real violation, fixed in Phase 5.
- **N-7 audit log** is a Required non-functional the brief never mentioned.
- Phase 1/2 work maps cleanly onto N-3, N-4, N-6 and §2.4 — nothing the PRD
  contradicts.

### Requirement coverage at the start of this session

| Group | P0 | fully | partial | missing/broken/fabricated |
|---|---|---|---|---|
| Track A | 5 | 0 | 5 | 5 |
| Track B | 7 | 1 | 4 | 5 |
| Corrective | 5 | 0 | 4 | 3 |
| Dashboard | 6 | 0 | 6 | 3 |
| Non-functional | — | 2 | 3 | 3 |

---

## Phase status

| Phase | Scope | Status | PR |
|---|---|---|---|
| 0 | Audit & baseline | **done** | this branch |
| 1 | Integrity & security | **done** | `fix/phase1-integrity-and-security` |
| 2 | Bug fixes, backend integrity, dedup | **done** | #2, recovered to `main` via #3 |
| — | PRD traceability matrix | **done** | #4, merged |
| 2.5 | Wire UI to the real FastAPI backend | **done** | #5, merged |
| 3 | Ingestion contract + flagged synthetic data | **done** | #6, merged |
| 4 | Track B forecaster + constraint engine | **done** | #7 `feat/phase4-track-b-forecaster` |
| 5 | Track A leakage fix | not started | — |
| 6 | Dashboard / UX journey | not started | — |
| 7 | Testing, perf, deployment | partial (frames + tests done) | phase 2 branch |
| 8 | Readiness assessment | not started | — |

---

## Phase 1 — Integrity & security (done)

### Fabrication removed

| Requirement *(brief-derived)* | Status | Evidence |
|---|---|---|
| No `Math.random` / `jitter()` on data paths | **done** | `grep -rn "Math.random\|jitter(" frontend/src/app/api frontend/src/components/mission-control/data.ts` → only explanatory comments |
| No fabricated model names | **done** | `grep -rn "Prophet-XGBoost\|TreeSHAP\|XGBoost-Manganese\|KernelExplainer" frontend/src backend AI` → clean |
| No invented satellite scene IDs | **done** | Real Earth Search STAC query returns `S2B_44QMK_20260919_0_L2A`, `S2C_44QMK_20260914_0_L2A`, `S2B_44QMK_20260909_0_L2A` with real cloud cover 29 / 66.5 / 79.7 % |
| Provenance envelope on every value | **done** | `frontend/src/lib/provenance.ts`; `provenance` + `data_integrity` blocks in the telemetry response |
| Synthetic data flagged, never "LIVE" | **done** | `is_synthetic`/`is_live` derived from `source_kind`, not caller-set |
| Hardcoded grades/depths/SHAP removed | **done** | `reserve.estimated_ore_grade` → `null`; types widened to `T \| null` |
| Reproducible: same input → same output | **done** | two identical requests, all `provenance[*].value` identical (only `vintage` timestamps differ) |

### Security closed

| Defect | Status | Evidence |
|---|---|---|
| Hardcoded admin passwords | **done** | backdoor block deleted; `grep admin123` → clean |
| Client-supplied `role` accepted | **done** | `POST /api/auth/session` → HTTP 405 |
| Forgeable unsigned session cookie | **done** | forged cookie → `{"user":null}`; tampered signed cookie → `{"user":null}` |
| `admin_session=true` → superadmin | **done** | → `{"user":null}` |
| OTP returned in response | **done** | `devCode` removed |
| OAuth `state` unverified + `Math.random` | **done** | state compared to single-use cookie; `crypto.randomBytes(32)` |
| RLS `USING (true)` | **done** | → `USING (auth.uid() = id)` |
| Real credentials in `.env.example` | **done** | replaced with placeholders |

### Verification

```
npx tsc --noEmit   → clean
npm run build      → success, 38 routes
```

### Follow-ups owed to the repo owner

- Rotate the password that was hardcoded in `admin/auth/route.ts` — it is in
  git history.
- Rotate the Supabase anon key and review Firebase key restrictions — they were
  published in `.env.example` in this public repo.
- Set `SESSION_SECRET` in the deployment environment (the app now fails closed
  without it).

---

## Phase 2 — Bug fixes, backend integrity, deduplication (done)

| Item | Status | Evidence |
|---|---|---|
| `AI/api/main.py /predict` built 6 features, model expects 10 → 500 | **done** | `POST /predict {"lat":21.83,"lng":80.19}` → **HTTP 200**, `probability: 0.995`. Model introspection confirms `n_features_in_: 10` matching `FEATURE_COLS` order. |
| Three drifting copies of the feature definition | **done** | New `AI/scripts/features.py` is the single definition; `02`, `04` and `api/main.py` all import it. Training-table schema verified byte-identical to the committed CSV header. |
| Feature noise drawn from unseeded global `np.random` | **done** | Seeded per-coordinate RNG. Same coords twice → identical response. |
| `05_export_geojson.py` wrote to repo-root `public/` | **done** | Now `frontend/public/data` and `frontend/src/data`. |
| Flood risk forced CRITICAL when `lat >= 21.5` | **done** | Condition is now `rain_14d > 95 or soil_moist > 40`. |
| Open-Meteo `past_days` summed forecast days as "past 14 days" | **done** | Fixed in the telemetry route, the flood processor and `LocationFloodAlertFinder`: both windows requested, split on today's date. |
| Backend satellite service fabricated ISRO scene IDs | **done** | `query_isro_bhuvan_satellites` deleted — it pinged Bhuvan, discarded the response, and returned hand-built `RS2A_L4F_*` / `EOS04_SAR_*` IDs with `now - 2 days` pass times. Replaced by the real Earth Search STAC query. Test now prints `Copernicus Sentinel-2 L2A via Earth Search STAC (Element 84)`. |
| Hardcoded `surface_proxies` (NDVI 0.64 etc.) as measurements | **done** | Removed; `surface_indices: null` with a note that raster processing is required. |
| `UNFC 111/122/221` assigned from Mn% alone | **done** | Replaced with a metallurgical grade band plus a note that it is not a statutory class. Guardrail assertion added to the test suite. |
| **Blending optimiser claimed success for an impossible spec** | **done** | Found by the new test. Asked for 50% Mn from 46.2%-max stockpiles it returned `success: True` at 41.12% via a "Heuristic Optimal Allocation" fallback. Now returns `success: False` with an LP-derived diagnosis: *"the highest Mn grade achievable within the P and SiO2 limits is 43.07%, below the 50.0% required."* |
| `.vercelignore` excluded `public/frames` (788 frames, 145 MB) | **done** | Exclusion removed from both files with a note explaining why it must not be re-added silently. |

### Verification

```
python backend/test_api.py   → ALL 9 TESTS PASSED (incl. new blend-infeasibility test)
npx tsc --noEmit             → clean
npm run build                → Compiled successfully
POST /predict                → HTTP 200 (was 500)
same coords twice            → IDENTICAL
```

### Not done in Phase 2

Frontend→FastAPI consolidation. The Next.js app still serves its own
`/api/v1/*` routes and never calls the FastAPI backend, so the SciPy LP and the
NASA POWER client remain unreachable from the UI. Both sides are now honest and
tested independently; wiring them together is the remaining Phase 2 work and is
a larger change than the bug fixes above.

---

## Phase 2.5 — UI wired to the FastAPI service layer (done)

Architecture L4: FastAPI is the API/service layer. Before this, the Next.js
routes computed headline numbers independently, so the real SciPy LP and NASA
POWER client were unreachable from the UI.

| Item | Status | Evidence |
|---|---|---|
| Telemetry computation consolidated into FastAPI | **done** | `backend/app/api/telemetry.py`; `GET /api/v1/mines/{id}/telemetry`. Next.js route is a 45-line proxy. |
| Frontend blend heuristic replaced by the real LP | **done** | The Next.js route reported `solver_status: 'Simplex Optimal Solution Converged'` with no solver, always `success: true`, and clamped the achieved grade with `Math.max(targetMn, avgMn)`. Now proxies to SciPy HiGHS. |
| End-to-end trace (PRD D-2/B-4) | **done** | 91.79 mm identical at UI → FastAPI → `/environment` → NASA POWER queried directly. |
| Reproducibility (N-4) | **done** | All `provenance[*].value` and all forecast/risk scalars identical across calls; only timestamps differ. |
| Python↔TS generator parity (N-4) | **done** | `backend/test_provenance_parity.py` — mulberry32 and FNV-1a match bit-for-bit. |
| Graceful degradation (N-6) | **done** | Backend down → `served_by: nextjs-degraded-fallback`, synthetic flagged, 0 scenes, no recommendation issued; blend returns 503 `Unavailable` rather than a fake solve. |
| NASA POWER fallback fabrication | **done** | Fixed constants labelled "NASA POWER (Cached/Interpolated)" replaced with a seeded, flagged draw. |
| Third copy of the drag model | **done** | `data.ts` fallback delegates to the shared degraded builder; 237 → 83 lines. |

---

## Phase 3 — Ingestion contract + flagged synthetic data (done)

PRD §8.2: *"The contract is a deliverable in its own right."* See
`docs/INGESTION_CONTRACT.md`.

| Item | Status | Evidence |
|---|---|---|
| Seven versioned schemas | **done** | `backend/app/ingestion/schemas.py`, contract `1.0.0`; JSON Schema published under `docs/schemas/`. `is_synthetic` is required with no default on every entity. |
| Schemas actually reject bad data | **done** | Test rejects inverted depth intervals, assays summing >100%, inverted periods, and rows omitting `is_synthetic`. |
| Deterministic seeded generator | **done** | 58,083 rows byte-identical for seed `20260921`; a different seed differs. |
| Calibrated to MOIL public totals | **done** | 2024 = 1,098,143 t; 2025 = 1,122,772 t — inside the published ~1.1–1.3 Mt/yr range. Test guards the range. |
| Every row flagged synthetic | **done** | All 58,083 rows carry `is_synthetic=True`, a `source` and a `contract_version`. |
| Grade-aware (B-5 P0, B-9) | **done** | Production and plan targets keyed by (mine × grade × period) for all 10 mines. |
| Covariates genuinely drive the target | **done** | Removing rainfall lifts total production 5.3% — the Phase 4 baseline comparison will be meaningful rather than rigged. |
| Hardcoded "authentic MOIL" series removed | **done** | 554 lines of hand-written 1977–2026 records deleted; header claiming MOIL/IBM/GSI/IMD as sources replaced. Series now generated and flagged. |
| Statutory field names removed | **done** | `unfc111ProvedReservesTonnes` → `indicativeResourceBaseTonnes`; `gsiCoreDrillHoles` → `syntheticBoreholeCount`. |
| False verification claim | **done** | `OFFICIAL_DATA_SOURCES.verifiedParameters` → `parametersAvailable`; relabelled as *planned* ingestion targets (PRD §8.3), not provenance. |
| Fabricated method claim | **done** | Comment claiming "Holt-Winters / ARIMA + XGBoost residual estimation" removed — none exist in the codebase. |

---

## Phase 4 — Track B made real (done)

PRD §10: *"Lead with Track B. It is the spine."* See `docs/BACKTEST.md`.

| Req | Item | Status | Evidence |
|---|---|---|---|
| B-5 | Per-mine **per-grade** forecast, configurable horizon | **done** | 4 grades forecast separately for Balaghat; grade is a model feature. Test asserts the forecasts differ. |
| B-6 | P(cumulative < target) with a band | **done** | Monte Carlo over per-day lognormal predictives. Balaghat: P(short) 0.63–0.99 by grade, target 12,689 t vs E[cum] 12,049 t. |
| B-7 | Attribution to weather/equipment/blasting | **done** | Exact additive decomposition, honestly named (not SHAP). |
| B-10 | Rolling-origin backtest | **done** | MAPE 11.67% vs baseline 14.81% (+21.2%); coverage 0.812 vs nominal 0.80. |
| C-1..C-3 | Schedule / blasting / equipment actions | **done** | 3 candidate types generated from forecast drivers. |
| C-4 | Expected effect + assumptions | **done** | Each approved action carries recovery tonnes, ΔP(shortfall) and stated assumptions. |
| C-5 | **Hard constraint engine** | **done** | Both failures the PRD names by name are rejected: night blasting, and a 128 km overnight relocation. Infeasible actions are *removed*, not downgraded. |
| N-8 | Backtest visible via API | **done** | `GET /mines/{id}/backtest`. UI surfacing is Phase 6. |

**No leakage:** a test corrupts every post-origin actual by 10× and asserts the forecast is bit-identical.

**Calibration took four attempts** (0.581 → 0.656 → 0.662 → 0.812); the working fix was a recency-based conformal calibration split, at the cost of 0.9 points of MAPE. Documented in `docs/BACKTEST.md`.

**Bug found and fixed:** plan targets stopped at the data end, so the tail of every forecast horizon had no target and P(shortfall) was trivially 0. Targets now run 90 days forward.

---

## Carried forward (found in audit, not yet fixed)

| Item | Phase | Note |
|---|---|---|
| Target leakage: `KNOWN_FAULTS` = mine coordinates; features are distance-to-mine | 5 | 0.98 AUC is an artefact. Recorded in `docs/INTEGRITY.md` §4; claim withdrawn from the chatbot. |
| Frontend never calls the FastAPI backend (LP + NASA POWER unused) | 2 | Two disconnected backends. |
| No test coverage for the forecaster or a constraint engine | 4, 7 | Blend feasibility is now covered. |

---

## Judging-criteria mapping

| Criterion | Where addressed |
|---|---|
| Demo credibility | Phase 1 — no fabricated numbers survives the "where did that come from?" question |
| Technical depth | Phase 4 (GBT + backtest), Phase 5 (real features, LOMO CV), existing SciPy LP |
| Problem fit | Track B shortfall is the PRD spine — Phase 4 |
| Functionality | Phase 2 consolidation, Phase 6 journey |
| UX | Phase 6 |
| Innovation | Constraint-gated recommendations (Phase 4) |
