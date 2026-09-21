# Track B Backtest Report

**Model:** `nakshatra-gbt-cqr-v1` · **Baseline:** `seasonal-naive-365-v1` · **Pilot:** Balaghat (`MOIL-BAL-01`)
**Date:** 2026-09-21 · PRD **B-10** [D] P0, **N-8**

> PRD §11: *"Forecast MAPE against held-out production history — **the only honest measure of Track B**."*
> And: *"Calibration — do 70%-confidence predictions come true 70% of the time? **Almost no team will measure this.**"*

Both are reported here.

---

## Headline

```
VERDICT: GBT beats the seasonal-naive baseline: MAPE 10.75% vs 14.81% (+27.4% relative)

            MAPE%   sMAPE%   MAE(t)  RMSE(t)  cov80   gap     width(t)
  GBT+CQR   11.67    11.52    20.68    31.02   0.812  +0.012   60.6
  baseline  14.81    15.39    27.00    39.73      —      —        —
```

*(150-day window, 14-day origin step, horizons 1/3/7/14, 10 origins, 160 predictions.)*

The 80% prediction interval achieved **0.812 empirical coverage against a 0.800 nominal** — a gap of **+0.012**.

### Per horizon

| Horizon | GBT MAPE | Baseline MAPE | Coverage (80% nominal) |
|---|---|---|---|
| 1 day | 13.37% | 15.60% | 0.675 |
| 3 days | 12.86% | 14.71% | 0.850 |
| 7 days | 10.37% | 11.06% | 0.950 |
| 14 days | 10.07% | **17.86%** | 0.775 |

The margin widens with horizon. That is the expected shape: the seasonal-naive baseline degrades as the year-ago analogue drifts further from current conditions, while the covariate-aware model still sees the rainfall forecast and the equipment state.

---

## What is being measured

**Protocol.** Origins step forward through the test window. At each origin the model is **refitted on data strictly before it** and scored on the following days. The fit never sees the days it is scored on. Both models are scored on identical origins and targets.

**The baseline is not a straw man.** Seasonal-naive (`y_hat[t] = y[t − 365]`) is the standard benchmark for seasonal series and is genuinely hard to beat on data with a strong annual cycle — which monsoon-driven mining production has. The architecture diagram specifies *"a seasonal-naive baseline that must be beaten"*, and a model that cannot beat it has demonstrated nothing.

**No leakage.** A forecast made at origin `t0` uses only information available at `t0`:

- production lags are taken **relative to the origin**, never the target day, so a 14-day-ahead forecast still only sees production up to `t0`;
- weather covariates for the target day are legitimate — a rainfall forecast genuinely exists at `t0`, which is what Open-Meteo supplies;
- equipment and blasting covariates are taken at the origin.

This is pinned by a test that corrupts every post-origin actual by 10× and asserts the forecast is bit-identical:

```
✓ No leakage: forecasts are unchanged when post-origin actuals are corrupted 10x
```

That test exists because Track A was invalidated by exactly this failure (`docs/INTEGRITY.md` §4).

---

## Getting calibration right took three attempts

Reported in full because the intermediate numbers are part of the evidence.

| Attempt | Method | MAPE | Coverage | Verdict |
|---|---|---|---|---|
| 1 | Raw quantile GBT (q=0.1/0.5/0.9) | 10.54% | **0.581** | Beat the baseline, but the intervals were badly overconfident |
| 2 | Conformalised (CQR), random calibration split | 10.75% | 0.656 | Better; still 0.14 short |
| 3 | CQR, **per-horizon** widths | 10.75% | 0.662 | Barely moved — the problem was not horizon-specific |
| 4 | CQR, **recency-based** calibration split | 11.67% | **0.812** | Calibrated |

**Why the raw model was overconfident.** Fitting the pinball loss on training residuals understates out-of-sample spread. Standard, and the reason conformal prediction exists.

**Why a random calibration split was not enough.** Conformal prediction guarantees coverage *under exchangeability*, which time series violate. Concretely: the evaluation window spans the monsoon, when rain drag genuinely widens the spread of daily output. A width calibrated on a random sample of mixed-season history is too narrow for that regime.

**The fix.** Calibrate on the **most recent** slice of training history rather than a random one, so the interval width tracks the regime the forecast is actually being made in.

**The trade-off, stated plainly.** Point accuracy got slightly *worse* — MAPE 10.75% → 11.67% — because the temporal split removes the most recent 25% of samples from the fit. That is a real cost, accepted deliberately: an interval that claims 80% and delivers 66% is worse than useless for a planner sizing a risk, whereas a 0.9-point MAPE difference is not decision-changing. The model still beats the baseline by 21%.

---

## Sample size is part of the method

An early test configuration used a 90-day window with a 30-day step: **3 origins, 36 predictions**. It reported coverage of 0.556 and would have looked like a calibration failure.

It was not. At `h=7` that configuration had 12 points, of which 2 fell inside the interval — one unlucky origin moves measured coverage by 0.25. The configuration was measuring sample size, not calibration, and was replaced (120-day window, 20-day step → 72 predictions). The test now asserts `n_predictions >= 60` before it asserts anything about coverage.

---

## What this does NOT establish

**The data is synthetic.** The model is trained and tested on data generated to the published ingestion contract, because MOIL's operational records are proprietary (PRD §8.2). These metrics describe the model's behaviour **on this dataset**, not MOIL's operations, and must not be quoted as a claim about real MOIL production.

**The margin is a property of the generator.** The synthetic DGP makes production genuinely depend on rainfall, downtime and blast delay, and the model is given those covariates while the baseline is not. The +21% is therefore expected by construction. What the backtest *does* establish is that the pipeline is sound — correct temporal splits, no leakage, calibrated intervals, an honest baseline — so the numbers will mean something when real data replaces synthetic.

**Reproducing it.**

```bash
cd backend && FULL_BACKTEST=1 python test_track_b.py
```

A full run refits the model at every origin and takes several minutes. It is cached per process behind `GET /api/v1/mines/{id}/backtest`.
