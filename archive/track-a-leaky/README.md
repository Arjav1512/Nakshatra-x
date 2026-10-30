# Archived: the leaky Track A pipeline

This folder holds the project's first Track A (prospectivity) pipeline. It was
retired because its features leaked the labels. It is kept as the record that
the integrity docs cite. **Nothing in the app, the backend or CI uses it, and it
must not be revived.**

## What it was

The original manganese-prospectivity model:

| File | Step |
|---|---|
| `scripts/01_make_dataset.py` | Known mine locations (`data/known_manganese.csv`) plus sampled negatives → `outputs/dataset_points.csv` |
| `scripts/02_extract_features.py` | Feature table → `outputs/training_table.csv` |
| `scripts/features.py` | The feature definitions that 02, 04 and `api/main.py` shared |
| `scripts/real_data_client.py` | NASA POWER climatology client, cached in `data/real_data_cache.json` |
| `scripts/03_train_model.py` | RandomForest classifier → `outputs/prospectivity_model.pkl` |
| `scripts/04_predict_grid.py` | Scored a grid over the belt → `prospectivity.geojson` |
| `scripts/05_export_geojson.py` | Copied that grid into the frontend. Already disabled: it exits on import |
| `api/main.py` | A second FastAPI app serving that model. The live API is `backend/app/main.py` |

The files are unchanged apart from moving here, and they keep their original
`scripts/ data/ outputs/ api/` layout, so the paths inside them still resolve
relative to this folder.

## Why it was retired

- **The features encoded the target.** `KNOWN_FAULTS` in
  `scripts/02_extract_features.py` and `scripts/features.py` was the list of
  MOIL mine coordinates, and every "spectral" feature was a linear function of
  distance to those points. The positive labels were the same mines, so the
  model largely recovered its own target, and its reported AUC measured
  leakage, not geology. No raster was ever read. See `docs/TRACK_A.md` ("What
  was wrong") and `docs/INTEGRITY.md` §4.
- **It had reported fabricated metrics before.** `scripts/03_train_model.py`
  once set the AUC to 1.0 when it could not compute it, and `api/main.py` served
  hardcoded fallback metrics as if they had been measured. Both were fixed
  before retirement (see `docs/READINESS.md` §3.1 and
  `docs/FABRICATION_SWEEP.md` §3), but fixing them could not cure the leakage.

It was replaced by the honest pipeline in `AI/scripts/`:
`07_build_honest_dataset.py` (measured Sentinel-2 and SRTM features, with no
feature allowed to depend on distance to a mine) and `08_train_honest_model.py`
(validated leave-one-mine-out). The backend serves only that model
(`AI/outputs/prospectivity_model_honest.pkl`). How to rebuild it is in
`docs/TRACK_A.md` ("Reproducing"), and the figures it supports are in
`docs/PITCH_FIGURES.md`.

## It does not run, on purpose

- `scripts/02_extract_features.py` references an undefined `coords`, so the
  pipeline stops at step 2.
- `scripts/real_data_client.py` needs `requests`, which no requirements file
  installs.
- `scripts/04_predict_grid.py` would write a `prospectivity*.geojson`, which
  `backend/test_track_a.py::test_no_committed_prospectivity_geojson_anywhere`
  forbids anywhere in the repository.
- `scripts/05_export_geojson.py` exits on import.

Leave these as they are. Fixing them would only make it easier to bring back a
model whose headline figure was an artefact of leakage.

## Docs that cite these files

These now point here:

- `docs/TRACK_A.md`: what was wrong (`scripts/features.py`)
- `docs/INTEGRITY.md` §4: the known-invalid metric (`scripts/02_extract_features.py`)
- `docs/READINESS.md` §3.1 (`scripts/03_train_model.py`) and the guardrail table (`api/main.py`)
- `docs/JURY_QA.md`: the evidence for the Track A answer (`scripts/03_train_model.py`)
- `docs/FABRICATION_SWEEP.md` §3 (`api/main.py`)
- `docs/SILENT_DEFAULT_SWEEP.md` (`scripts/real_data_client.py`)
- `docs/TRACEABILITY.md`: requirements A-2, A-3, A-4, A-8 and N-4, and §8.4 (`scripts/features.py`, `scripts/04_predict_grid.py`)
- `PROGRESS.md`: Phase 2 and the Phase 7 and Phase 8 fabrication sweeps (`api/main.py`, `scripts/features.py`, `scripts/03_train_model.py`, `scripts/05_export_geojson.py`)
- `AI/scripts/sentinel_features.py` (docstring) and `backend/test_track_a.py` (docstring)
