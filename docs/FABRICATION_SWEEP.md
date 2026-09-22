# Fabrication Sweep — Phase 7

A final repo-wide search for values presented as measured that were not.
Five fabrications were found and fixed across Phases 1–6; this sweep looked for
survivors and **found four more**.

Method: grep the whole tree for hardcoded accuracies, AUCs, percentages, scene
identifiers and metric-shaped literals, then trace each hit to its origin.

---

## What was searched

| Pattern | Rationale |
|---|---|
| `(accuracy\|roc_auc\|auc\|precision\|recall\|f1)\s*[:=]\s*0?\.\d+` | metrics stated as literals |
| `98\.\d`, `99\.\d`, `0\.99\d`, `0\.98\d` | suspiciously high "performance" numbers |
| `S2A_MSIL2A_\d{8}`, `LC08_L2SP_`, `RS2A_L4F_`, `EOS04_SAR_`, `CART3_PAN_`, `INS3DR_IMG_` | fabricated satellite scene IDs |
| `Math.random`, `jitter(` on data paths | non-reproducible values shown as data |
| `Prophet`, `TreeSHAP`, `XGBoost-`, `KernelExplainer` | model names for libraries not in the dependency tree |
| credential-shaped literals | secrets hygiene |

---

## Found and fixed in this phase

### 1. `RealtimeMLTrainingStudio.tsx` — a simulated training run · **worst of the four**

Live in **three pages** (`/evaluator`, `/features/[id]`, mission control). Pressing
"train" advanced a `setTimeout` loop while `Math.random()` drew a decaying loss
curve converging on a hardcoded constant:

```ts
accuracy: 98.7, rocAuc: 0.995            // per "model", invented
stepAcc = preset.accuracy - 12 * Math.exp(-step / 2.1) + Math.random() * 0.4
finalAcc = Math.min(99.4, ... preset.accuracy + (Math.random() * 0.8 - 0.2))
```

No model was fitted and no data was read. It also listed **"Fault Line
Proximity"** as a feature — the distance-to-mine term that invalidated the
original pipeline — and claimed to fuse Sentinel-2 SWIR with *"GSI/MOIL core
drill logs"* this project does not have.

**Fixed:** replaced with a model card that fetches real validation from
`/api/v1/prospectivity/metrics` — LOMO AUC with its CI, the feature ablation,
and per-deposit hold-out results. Training happens offline
(`AI/scripts/08_train_honest_model.py`), which is where model fitting belongs,
not behind a dashboard button. Export name and props unchanged, so all three
pages keep working.

### 2. `HotspotEvidence.tsx` — an invented evidence database

```ts
sceneId: 'S2A_MSIL2A_20260828T050611_N0511_R004_T43QDH_20260828T071533'
sceneId: 'LC08_L2SP_144046_20260827_20260828_02_T1'
ndvi: 0.72, soilMoisture: 42, spectralAnomaly: 0.82,
geologicalSupport: 0.89, drillSupport: 0.91, confidence: 87
```

Those identifiers look like genuine Copernicus and USGS products but correspond
to nothing. Worse, the lookup was `EVIDENCE_DB[mineId] || EVIDENCE_DB.balaghat`
— **any mine other than the two listed silently showed Balaghat's "evidence"
under its own name.**

**Fixed:** reads the mine's telemetry, which carries real Sentinel-2 scenes from
a live STAC query and measured weather. Fields the pipeline does not yet produce
(NDVI, soil moisture, spectral indices) render as *unavailable* with the reason,
never filled in.

### 3. `AI/api/main.py` `/metrics` — invented fallback

```python
return {"accuracy": 0.9875, "roc_auc": 0.9950,
        "n_estimators": 200, "model_type": "RandomForestClassifier"}
```

Served whenever the metrics artefact was absent. These were also the *leaked*
pipeline's figures.

**Fixed:** raises 503 pointing at the training script and the honest endpoint.
No fallback metric.

### 4. `IndiaSatelliteMap.tsx` — accuracy attributed to GSI/MOIL

```tsx
{activePrediction.model_accuracy_pct || 98.7}% GSI/MOIL Accuracy
```

A 98.7% fallback attributed by name to two government bodies.

**Fixed:** renders the real value when present, otherwise points at the
validation panel. No number is attributed to GSI or MOIL.

---

## Checked and confirmed clean

| Check | Result |
|---|---|
| `Math.random` / `jitter()` on data paths | clean — only explanatory comments |
| Fabricated model names (Prophet, TreeSHAP, XGBoost-*, KernelExplainer) | clean |
| Hardcoded credentials in source | none |
| Real keys in `.env.example` | none — placeholders only |
| Committed `.env` files | none (only `.env.example`) |
| `SESSION_SECRET` | env only; throws in production if unset |
| Statutory UNFC figures in output | none |
| Remaining scene-ID / accuracy literal matches | all inside docstrings documenting removals |

`/api/v1/prospectivity/metrics` was already fixed in Phase 6 — it had returned
`accuracy: 0.9512, roc_auc: 0.8875` with `dist_to_fault_km` as the top feature.

---

## Running it again

```bash
grep -rnEi "(accuracy|roc_auc|auc)[\"' ]*[:=][\"' ]*0?\.[0-9]+" frontend/src backend AI
grep -rnE "S2[AB]_MSIL2A_[0-9]{8}|LC08_L2SP_|RS2A_L4F_|EOS04_SAR_" frontend/src backend AI
grep -rn "Math.random\|jitter(" frontend/src/app/api frontend/src/components
grep -rn "Prophet-XGBoost\|TreeSHAP\|KernelExplainer\|XGBoost-Manganese" frontend/src backend AI
```

Every surviving hit should be a comment explaining what was removed. If a hit is
live code, it is a regression.
