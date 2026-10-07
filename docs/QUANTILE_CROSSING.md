# Quantile crossing — measured, fixed, and checked

`docs/DECISIONS.md` D-043 is the pre-registration. This file holds the results,
in the order they were produced.

## 1. How often the quantiles cross, on main's forecaster

`backend/measure_quantile_crossing.py`, run at `5c57d38`. The forecaster is
main's (`7c3c509`): nothing in `app/` had changed. Quiet machine, one process
at a time, both datasets.

A row is **crossed** when any of q10 > q50, q50 > q90 or q10 > q90 holds. The
three come from independently fitted gradient-boosting models, so nothing
orders them.

### Dataset ending 2026-09-20 (592 s)

| Where | Rows | q10 > q50 | q50 > q90 | q10 > q90 | **Any** | Share |
|---|---:|---:|---:|---:|---:|---:|
| calibration slice, all horizons | 82,522 | 8,138 | 1,468 | 202 | **9,556** | 11.6% |
| calibration slice, one-step (the residuals) | 6,110 | 579 | 97 | 12 | **673** | 11.0% |
| served forecast, raw | 476 | 60 | 10 | 3 | **70** | 14.7% |
| served forecast, after the conformal step | 476 | 0 | 0 | 0 | **0** | 0 |
| backtest (24 origins), raw | 11,424 | 685 | 421 | 51 | **1,092** | 9.6% |
| backtest (24 origins), after the conformal step | 11,424 | 2 | 0 | 0 | **2** | 0.02% |

### Dataset ending 2026-10-06 (815 s)

| Where | Rows | q10 > q50 | q50 > q90 | q10 > q90 | **Any** | Share |
|---|---:|---:|---:|---:|---:|---:|
| calibration slice, all horizons | 82,522 | 4,924 | 2,810 | 383 | **7,648** | 9.3% |
| calibration slice, one-step (the residuals) | 6,110 | 342 | 184 | 23 | **520** | 8.5% |
| served forecast, raw | 476 | 44 | 25 | 15 | **63** | 13.2% |
| served forecast, after the conformal step | 476 | 0 | 0 | 0 | **0** | 0 |
| backtest (24 origins), raw | 11,424 | 601 | 423 | 52 | **1,008** | 8.8% |
| backtest (24 origins), after the conformal step | 11,424 | 10 | 6 | 0 | **16** | 0.14% |

One-step calibration rows crossed, per mine:

| Mine | 20 Sep | 6 Oct |
|---|---:|---:|
| MOIL-BAL-01 | 56 | 53 |
| MOIL-BHR-02 | 46 | 29 |
| MOIL-UKW-03 | 19 | 23 |
| MOIL-TIR-04 | 29 | 43 |
| MOIL-DON-05 | 52 | 69 |
| MOIL-CHK-06 | 70 | 88 |
| MOIL-MAN-07 | 162 | 29 |
| MOIL-KAN-08 | 62 | 39 |
| MOIL-GUM-09 | 13 | 36 |
| MOIL-BEL-10 | 164 | 111 |

### What this says

- **Crossing is not rare, and it is everywhere.** About one row in ten, on every
  mine, on both datasets. The −26.5σ row that broke Balaghat on 6 October was the
  worst of many, not a freak.
- **Where main sorted, crossing was hidden; where it did not, it went straight
  in.** `predict` sorted the three before the conformal step, so no served
  forecast was crossed on either dataset. But `fit` never sorted.
  - Its conformity scores were computed on calibration rows of which 9–12% were
    crossed.
  - Its residuals came from one-step rows of which 8.5–11% were crossed. Each
    such row's "band" is inverted or near-zero, and its residual is enormous.
- **The conformal step re-crosses.** A negative conformal width moves the
  endpoints towards each other after `predict`'s sort: 2 backtest intervals on
  20 Sep and 16 on 6 Oct came out crossed. The forecasts served at the end date
  happened not to.
- **More crossing does not mean more damage.** 6 October has *less* crossing than
  20 September (9.3% against 11.6% of calibration rows); what it has is one row
  whose band collapsed to 0.03 t. The damage depends on how narrow a crossed band
  is, which is why the fix is a rearrangement *and* a floor, not either alone.
