# Nakshatra-X — Progress & Traceability

SIH 2026, problem statement SIH26009 (Ministry of Steel / MOIL).
Living document. Status values: **done** / **partial** / **missing** /
**broken** / **fabricated** / **blocked**.

Last updated: 2026-09-20.

---

## ⚠️ Blocker: the PRD is not in the repository

The brief names `SIH26009-01-PRD.md` and `SIH26009-Architecture.excalidraw` as
the single source of truth. **Neither file exists** — not in
`Arjav1512/Nakshatra-x` at `main` (25c7caa), and not anywhere on this machine:

```
$ gh api repos/Arjav1512/Nakshatra-x/git/trees/main --jq '.tree[].path'
.gitignore .vercelignore AGENTS.md AI CLAUDE.md README.md backend database
frontend nakshatra_x_*.pdf netlify.toml package.json vercel.json

$ find ~/Downloads ~/Desktop ~/Documents -iname "*SIH26009*" -o -iname "*PRD*"
# → only SatQuery-03-PRD.md and PrepPilot/docs/PRD.md — different projects
```

**What this blocks:** the requirement-by-requirement traceability table below
cannot be authoritative, and the Phase 8 "PRD coverage" score cannot be
computed. **What it does not block:** everything specified directly in the
engineering brief — integrity, security, consolidation, the forecaster, the
constraint engine — which is the bulk of the work. Those proceed.

**To unblock:** add the PRD to the repo, or provide the file.

The requirement rows below are therefore derived from the engineering brief and
the problem statement, and are marked *(brief-derived)* rather than
*(PRD-traced)*.

---

## Phase status

| Phase | Scope | Status | PR |
|---|---|---|---|
| 0 | Audit & baseline | **done** | this branch |
| 1 | Integrity & security | **done** | `fix/phase1-integrity-and-security` |
| 2 | Bug fixes, backend integrity, dedup | **done** | `fix/phase2-consolidation-and-bugs` |
| 3 | Ingestion contract + flagged synthetic data | partial (generator done) | — |
| 4 | Track B real forecaster + constraint engine | not started | — |
| 5 | Track A made honest | **done** | `feat/phase5-track-a-honest` |
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
