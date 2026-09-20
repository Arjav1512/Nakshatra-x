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
| 2 | One backend, reproducible | not started | — |
| 3 | Ingestion contract + flagged synthetic data | partial (generator done) | — |
| 4 | Track B real forecaster + constraint engine | not started | — |
| 5 | Track A leakage fix | not started | — |
| 6 | Dashboard / UX journey | not started | — |
| 7 | Testing, perf, deployment | partial | — |
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

## Carried forward (found in audit, not yet fixed)

| Item | Phase | Note |
|---|---|---|
| Target leakage: `KNOWN_FAULTS` = mine coordinates; features are distance-to-mine | 5 | 0.98 AUC is an artefact. Recorded in `docs/INTEGRITY.md` §4; claim withdrawn from the chatbot. |
| `AI/api/main.py /predict` builds 6 features, training table has 11 | 2 | Returns 500. |
| `AI/scripts/05_export_geojson.py` writes to repo-root `public/` | 2 | Should be `frontend/public/`. |
| Flood script forces CRITICAL when `lat >= 21.5` | 2 | Geographic rule masquerading as a model output. |
| Frontend never calls the FastAPI backend (LP + NASA POWER unused) | 2 | Two disconnected backends. |
| `.vercelignore` excludes `public/frames` | 7 | 788-frame hero animation 404s in production. |
| Backend `geostat_kriging.py` emits `UNFC 111` | 1→2 | Removed from the telemetry response path; the backend module still carries it and is not currently called. |
| No test coverage for forecaster / constraints / blend feasibility | 4, 7 | |

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
