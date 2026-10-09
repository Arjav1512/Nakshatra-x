# P(shortfall), D-045 — two candidates measured, neither passed

`docs/DECISIONS.md` D-045 is the pre-registration: committed and pushed
(`26b0f9e`) before either candidate existed in code. This file holds what the
measurement found. **Neither candidate passed its rule, so P(shortfall) stays
withdrawn** (D-044). Nothing served changed.

- **Measured:** 2026-10-09, 11:52–12:17 UTC. Quiet machine, memory pressure
  "normal", one process, committed tree (`98e0dbb`).
- **Within the time-box:** the cut-off is 2026-10-12 23:59 IST.
- **Raw results:** `docs/evidence/d045/` (`decision.json`, `sanity.json`,
  `gap.json`).
- **To reproduce:** `backend/measure_d045.py` (run, sanity, gap, decide).

## What was compared

At each of 24 origins, 14 days apart, the forecaster was fitted once and three
constructions of the 14-day total were scored on the same 816 windows:
- **main:** the served residual-block bootstrap;
- **(a) horizon dependence:** the correlation of standardised errors across
  horizons 1–14 within each held-out calibration path, per grade, through a
  Gaussian copula on the served daily lognormals;
- **(b) direct calibration of the total:** split conformal on
  log(realised / sum of medians) over the same held-out paths.

**A check on the measurement itself.** On the frozen dataset the runner's main
arm reproduces the committed calibration artifact exactly: coverage 0.717, tails
0.163, 816 windows. The candidates were measured against exactly what is served.

## Calibration of the 14-day total (C1, C2)

Coverage is the share of realised totals inside the 80% band (nominal 0.80).
Tails are the share with PIT below 0.05 or above 0.95 (nominal 0.10). 95%
intervals come from a cluster bootstrap over origin dates.

| | 2026-09-20 coverage | tails | 2026-10-07 (frozen) coverage | tails |
|---|---|---|---|---|
| main | 0.738 [0.700, 0.777] | 0.165 [0.130, 0.202] | 0.717 [0.680, 0.749] | 0.163 [0.130, 0.200] |
| (a) horizon dependence | 0.696 [0.656, 0.738] | 0.199 [0.165, 0.232] | 0.657 [0.620, 0.692] | 0.227 [0.197, 0.256] |
| (b) direct calibration | 0.713 [0.674, 0.755] | 0.208 [0.169, 0.246] | 0.685 [0.636, 0.729] | 0.210 [0.167, 0.257] |

**Both candidates are worse than main, not better.** Paired change in distance
to nominal, main → candidate (positive would mean closer to nominal):

| | 2026-09-20 Δcoverage | Δtails | 2026-10-07 Δcoverage | Δtails |
|---|---|---|---|---|
| (a) | −0.042 [−0.078, −0.006] | −0.033 [−0.067, 0.001] | −0.060 [−0.098, −0.025] | −0.064 [−0.102, −0.023] |
| (b) | −0.025 [−0.063, 0.012] | −0.043 [−0.070, −0.014] | −0.032 [−0.061, −0.004] | −0.047 [−0.087, −0.005] |

- **C1 (better than main on both datasets) fails for both.** On the frozen
  dataset both are worse with intervals excluding zero.
- **C2 (calibrated) fails for both.** No interval contains 0.80 for coverage and
  0.10 for tails on both datasets.

## The eight-date sanity checks (C3) and saturation (C4)

The same thresholds as `test_track_b_dates.py` (D-043), computed for each
candidate, are in the table below:
- **(i)** a grade's 14-day sd at least 0.9 × independent days;
- **(ii)** at least 80% of P values unsaturated;
- **(iii)** no single calibration input moves an sd by 10%;
- **A5** no single day moves an sd by 5%, on the two pitch dates.

| End date | (a) | (b) |
|---|---|---|
| 2025-12-15 | **fail**: 1 grade narrower | **fail**: 2 narrower |
| 2026-01-31 | pass | **fail**: 3 narrower |
| 2026-03-15 | pass | **fail**: 5 narrower |
| 2026-04-30 | **fail**: 4 narrower | **fail**: 6 narrower |
| 2026-06-15 | **fail**: 5 narrower, 73% unsaturated | **fail**: 14 narrower, 35% unsaturated |
| 2026-07-31 | **fail**: 71% unsaturated | **fail**: 6 narrower, 18% unsaturated |
| 2026-09-20 | **fail**: 79% unsaturated; one day moves 15 grades by 5%+ | **fail**: 6 narrower, 71% unsaturated; one day moves 9 grades |
| 2026-10-06 | **fail**: 1 narrower; one day moves 8 grades | **fail**: 6 narrower; one day moves 8 grades |

- **(iii) passed everywhere for both.** No single calibration input dominates a
  spread.
- **C4 (no saturation on the frozen dataset) passed for both:** 94% (a) and 85%
  (b) unsaturated.
- **C3 fails for both:** (a) on 6 of 8 dates, (b) on all 8.

By the rule fixed in advance, **neither ships**. C5, presented figures
unchanged, was not reached.

## Why: both estimates come out too narrow

Each construction's 14-day sd, as a multiple of summing the same days
independently, over the 816 windows:

| | 2026-09-20 | 2026-10-07 |
|---|---|---|
| realised errors (realised − expected, in independent-days sds) | **1.72** | **1.67** |
| main, median | 1.68 | 1.62 |
| main, windows over 5× | 32 (max 7,662×) | 30 (max 51,656×) |
| (a), median | 1.22 | 1.21 |
| (b), median | 1.19 | 1.12 |

- **The real 14-day errors spread about 1.7× the independent-days sd.**
- **Both candidates supply about 1.2×,** so their bands are too narrow and their
  tails too heavy.
- **Main's typical width is close to right, but for the wrong reason.**
  D-043 traced it to the interleaved series replaying same-day shocks across
  grades. Main also blows up to absurd widths in about 4% of windows: the
  crossed-row residuals. Those blow-ups are what put more realised totals inside
  its band, and they are why it cannot be served either.

**Both candidates estimate from the forecaster's own held-out calibration
slice,** and that slice's 14-day errors are less dispersed than the errors at a
real forecast origin: about 1.2× against 1.7×. Why is not established. One
hypothesis, not tested here: the quantile models are fitted on the first 75% of
history. They predict the calibration slice right after their training ends, but
a forecast origin comes a further quarter of history later, so their errors
there are larger.

## A deviation from what was asked

The specification for (b) was "split conformal on held-out **backtest**
totals". Its counterpart for (a), noted in #29, was to estimate the dependence
"from the backtest's multi-horizon errors". D-045 registered both on the fit's
held-out calibration slice instead. Those rows are out of sample for the
quantile models, but they are not the rolling-origin backtest, where the model
is refitted at each origin and scored on the 14 days that follow.

The finding above says this choice matters, because the slice understates the
errors at a real origin. **So the literal reading — candidates estimated from
rolling-origin backtest errors — remains untested.** It would also cost more to
serve: P would need a committed backtest for every mine (about 36 minutes of
batch), not one.

It is not run here. It is a different estimator, chosen after seeing these
results, so D-045 calls for a new pre-registered entry. That is the user's call.

## Does (a) explain #20's 2.5–3.4× gap?

**No, by the rule registered in D-045:** (a)'s widening lies inside the realised
error spread's 95% interval for 6 of 10 mines on 2026-09-20 and 5 of 10 on
2026-10-07, short of 8.

**The measurement also says what #20's gap was.** Its 2.5–3.4× was "the real
14-day cumulative CV" against independent summation. The coefficient of
variation of realised 14-day totals across windows, over the independent CV,
comes out at:
- 2.9–3.5× for seven mines;
- 6.2–7.4× for Chikla, Dongri Buzurg and Beldongri.

That reproduces #20's range. But it measures how much the totals themselves
vary from window to window, level changes included, not how far they fall from
the forecast. **The forecast's error, the quantity a 14-day band must cover,
spreads 1.3–2.4× the independent-days sd by mine** (1.67–1.72× overall). #20's
gap overstated the widening needed. Horizon dependence supplies part of it,
about 1.2×, and does not close it.

## What stays as it is

- **P(shortfall) and every 14-day figure stay withdrawn** from the console and
  `PITCH_FIGURES.md`.
- **The strict expected failures in `test_track_b_dates.py` and
  `test_track_b.py` stay** as they are.
- **The candidates' code stays, unserved and outside the fingerprinted import
  chain** (`app/ml/cumulative_candidates.py`, `measure_d045.py`), so this result
  reproduces and a follow-up can build on it. Its tests check the arithmetic,
  and that the calibration slice it rebuilds is exactly the one the fit used.
- **No artifact was regenerated.** The code fingerprint is unchanged
  (`26668cae85f17dfc`).
