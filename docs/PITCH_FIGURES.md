# Pitch figures

<!-- Written by `python -m app.api.batch pitch`. Do not edit by hand: `batch pitch-check` and backend/test_pitch_figures.py fail when this file and the served artifacts disagree. -->

The numbers the pitch quotes — slides, `docs/JURY_QA.md`, the demo script —
from **one** frozen dataset, read from what the API serves. Quote them from
here; `docs/DEMO.md` (*Freeze the pitch dataset*) says how they were made and
how to re-make them.

> **Not demo-ready: forecast window already passed** (21 Sep – 4 Oct 2026). These
> figures come from the committed dataset so the tooling and its checks
> run on something real. Nothing here goes into slides until the dataset
> is re-frozen for the demo window (`docs/DEMO.md`, *Freeze the pitch
> dataset*).

**Dataset:** `nakshatra-synthetic-v1`, seed 20260921, contract 1.0.0, actuals to **2026-09-20** — the forecast window is 21 Sep – 4 Oct 2026. Operational data is synthetic (MOIL's is proprietary, PRD 8.2); Track A's inputs are real.

**Code:** `nakshatra-gbt-cqr-v1`, code fingerprint `e7d44df53c54e72e`.

## Track B — the pilot backtest (Balaghat)

| Key | Figure | Value | Served at → field | Artifact |
|---|---|---|---|---|
| `pilot.mape_model` | Balaghat backtest: model MAPE | **11.67%** | GET /api/v1/mines/1/backtest → `model.mape_pct` | `backend/artifacts/backtests/MOIL-BAL-01_150d_14step.json` |
| `pilot.mape_baseline` | Balaghat backtest: seasonal-naive baseline MAPE | **14.81%** | GET /api/v1/mines/1/backtest → `baseline.mape_pct` | `backend/artifacts/backtests/MOIL-BAL-01_150d_14step.json` |
| `pilot.daily_coverage` | Balaghat backtest: daily 80% interval coverage | **0.812** | GET /api/v1/mines/1/backtest → `model.coverage_80` | `backend/artifacts/backtests/MOIL-BAL-01_150d_14step.json` |
| `pilot.n_predictions` | Balaghat backtest: held-out predictions scored | **160** | GET /api/v1/mines/1/backtest → `model.n` | `backend/artifacts/backtests/MOIL-BAL-01_150d_14step.json` |
| `pilot.n_origins` | Balaghat backtest: forecast origins | **10** | GET /api/v1/mines/1/backtest → `n_origins` | `backend/artifacts/backtests/MOIL-BAL-01_150d_14step.json` |

## Track B — calibration, all ten mines and Balaghat

| Key | Figure | Value | Served at → field | Artifact |
|---|---|---|---|---|
| `portfolio.daily_coverage` | All ten mines: daily 80% interval coverage | **0.761** | GET /api/v1/calibration/cumulative?mine_code=MOIL-BAL-01 → `daily.portfolio.coverage_80` | `backend/artifacts/calibration/cumulative_coverage.json` |
| `portfolio.daily_coverage_ci` | All ten mines: daily coverage, 95% interval | **[0.733, 0.786]** | GET /api/v1/calibration/cumulative?mine_code=MOIL-BAL-01 → `daily.portfolio.coverage_80_ci95` | `backend/artifacts/calibration/cumulative_coverage.json` |
| `portfolio.daily_mape` | All ten mines: daily MAPE | **10.00%** | GET /api/v1/calibration/cumulative?mine_code=MOIL-BAL-01 → `daily.portfolio.mape_pct` | `backend/artifacts/calibration/cumulative_coverage.json` |
| `portfolio.cumulative_coverage` | All ten mines: 14-day total inside its 80% band | **0.738** | GET /api/v1/calibration/cumulative?mine_code=MOIL-BAL-01 → `portfolio.coverage_80` | `backend/artifacts/calibration/cumulative_coverage.json` |
| `portfolio.cumulative_coverage_ci` | All ten mines: 14-day coverage, 95% interval | **[0.700, 0.777]** | GET /api/v1/calibration/cumulative?mine_code=MOIL-BAL-01 → `portfolio.coverage_80_ci95` | `backend/artifacts/calibration/cumulative_coverage.json` |
| `portfolio.cumulative_tails` | All ten mines: 14-day totals in the outer tails (nominal 0.10) | **0.165** | GET /api/v1/calibration/cumulative?mine_code=MOIL-BAL-01 → `portfolio.pit_at_extremes` | `backend/artifacts/calibration/cumulative_coverage.json` |
| `portfolio.n_origin_dates` | Calibration: origin dates measured | **24** | GET /api/v1/calibration/cumulative?mine_code=MOIL-BAL-01 → `portfolio.n_origin_dates` | `backend/artifacts/calibration/cumulative_coverage.json` |
| `balaghat.cumulative_coverage` | Balaghat: 14-day total inside its 80% band | **0.667** | GET /api/v1/calibration/cumulative?mine_code=MOIL-BAL-01 → `mine.coverage_80` | `backend/artifacts/calibration/cumulative_coverage.json` |
| `balaghat.cumulative_coverage_ci` | Balaghat: 14-day coverage, 95% interval | **[0.521, 0.802]** | GET /api/v1/calibration/cumulative?mine_code=MOIL-BAL-01 → `mine.coverage_80_ci95` | `backend/artifacts/calibration/cumulative_coverage.json` |

## Track A — prospectivity, leave-one-mine-out

| Key | Figure | Value | Served at → field | Artifact |
|---|---|---|---|---|
| `track_a.auc` | Track A: leave-one-mine-out AUC | **0.85** | GET /api/v1/prospectivity/metrics → `lomo.auc` | `AI/outputs/model_metrics_honest.json` |
| `track_a.auc_ci` | Track A: AUC, 95% interval | **[0.72, 0.95]** | GET /api/v1/prospectivity/metrics → `lomo.auc_ci95` | `AI/outputs/model_metrics_honest.json` |
| `track_a.spectral_only` | Track A ablation: spectral features only | **0.60** | GET /api/v1/prospectivity/metrics → `ablation_lomo_auc.spectral_only` | `AI/outputs/model_metrics_honest.json` |
| `track_a.terrain_only` | Track A ablation: terrain features only | **0.67** | GET /api/v1/prospectivity/metrics → `ablation_lomo_auc.terrain_only` | `AI/outputs/model_metrics_honest.json` |
| `track_a.slope_only` | Track A ablation: slope only | **0.51** | GET /api/v1/prospectivity/metrics → `ablation_lomo_auc.slope_only` | `AI/outputs/model_metrics_honest.json` |
| `track_a.random_split` | Track A: random 5-fold AUC, for contrast | **0.82** | GET /api/v1/prospectivity/metrics → `random_split_auc_for_contrast` | `AI/outputs/model_metrics_honest.json` |

## Identity of each source

What the figures above were read from. The check compares these with what
is served, so a regenerated artifact cannot pass under an old table.

```json
{
  "AI/outputs/model_metrics_honest.json": {
    "model_version": "track-a-gbt-lomo-v1",
    "sha256": "a66e7ced8bb401dc"
  },
  "backend/artifacts/backtests/MOIL-BAL-01_150d_14step.json": {
    "code_fingerprint": "e7d44df53c54e72e",
    "contract_version": "1.0.0",
    "data_end_date": "2026-09-20",
    "generator": "nakshatra-synthetic-v1",
    "generator_seed": 20260921,
    "library_versions": {
      "numpy": "2.2.0",
      "pydantic": "2.13.5",
      "sklearn": "1.6.0"
    },
    "model_version": "nakshatra-gbt-cqr-v1"
  },
  "backend/artifacts/calibration/cumulative_coverage.json": {
    "code_fingerprint": "e7d44df53c54e72e",
    "contract_version": "1.0.0",
    "data_end_date": "2026-09-20",
    "generator": "nakshatra-synthetic-v1",
    "generator_seed": 20260921,
    "library_versions": {
      "numpy": "2.2.0",
      "pydantic": "2.13.5",
      "sklearn": "1.6.0"
    },
    "model_version": "nakshatra-gbt-cqr-v1"
  }
}
```
