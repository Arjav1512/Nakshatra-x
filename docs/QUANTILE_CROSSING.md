# Quantile crossing — measured, a fix that failed its rule, and what ships

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

## 2. The fix, measured against main — a negative result

The formal measurement of D-043, judged by its rule and both amendments. Main's
arm was run with main's own harness, in a worktree at `7c3c509`; the other arms
were run from `96e9596`, with the forecaster's switches set per arm.
- **Order:** sequential, on a quiet machine. Stage 1 ran from 17:27 to 19:04
  local on 2026-10-07; the per-arm evaluation followed until 19:35.
- **Seen beforehand, and disclosed** in `12f9c4d` and in amendment 2: the
  Balaghat smoke result.

### 14-day calibration (A3) — 816 windows at 24 origin dates per dataset

| Arm | 20 Sep coverage | tails | Δcov vs main [95% CI] | Δtail vs main [95% CI] | 6 Oct coverage | tails | Δcov | Δtail |
|---|---|---|---|---|---|---|---|---|
| main | 0.738 [0.700, 0.777] | 0.165 | — | — | 0.683 [0.636, 0.728] | 0.208 | — | — |
| crossing only | **0.812** [0.778, 0.847] | **0.105** | +0.050 [−0.018, 0.088] | +0.060 [0.013, 0.082] | **0.770** [0.729, 0.806] | **0.110** | +0.087 [0.053, 0.124] | +0.098 [0.060, 0.129] |
| day blocks only | 0.577 [0.538, 0.616] | 0.326 | −0.161 [−0.194, −0.129] | −0.161 [−0.201, −0.119] | 0.587 [0.543, 0.631] | 0.331 | −0.096 [−0.125, −0.065] | −0.123 [−0.156, −0.090] |
| both | 0.657 [0.621, 0.699] | 0.244 | −0.081 [−0.110, −0.050] | −0.078 [−0.118, −0.039] | 0.646 [0.602, 0.689] | 0.260 | −0.037 [−0.076, 0.006] | −0.052 [−0.090, −0.010] |

Δ is the distance from nominal, main's minus the arm's: positive means the arm
is closer to nominal.

### Every criterion, every arm

| Criterion | crossing only | day blocks only | both |
|---|---|---|---|
| A1 backtest rows uncrossed | pass (0 / 3,264, both datasets) | **fail** (1 and 4 crossed) | pass |
| A2 persistence across days (mean per-grade daily lag-1 > 0.2) | **fail** (0.126 / −0.035) | **fail** (0.145 / −0.011) | **fail** (0.126 / −0.035) |
| A2 wider than independent, every Balaghat grade | pass | **fail** | **fail** |
| A3 14-day calibration no worse | pass | **fail** | **fail** |
| A4 daily: q50 changed only where crossing entered | pass (1 and 4 rows, all crossed) | pass (none) | pass |
| A4 daily coverage no worse | **fail** on 20 Sep (0.7607 → 0.7555, Δ −0.0052 [−0.0077, −0.0031]); pass on 6 Oct | pass | **fail** on 20 Sep |
| A5 no single day moves a 14-day sd by 5% | **fail** (worst: Bharweli, 91% on 20 Sep) | **fail** | **fail** |
| A6 sanity on eight end dates | **fail** (6 of 10 checks) | **fail** (10 of 10) | **fail** (10 of 10) |

**No arm passes.** By amendment 2, served P(shortfall) is not changed. The
interval guarantee ships on its own: `predict`'s sort after the conformal step,
the artifact test, and the browser assertion that the median stays in its band.

A note on reading A2: `test_track_b.py` as committed computes its precondition
on `residual_block`. Under the crossing-only arm that is the interleaved series,
and the file passes, 11 of 11. Amendment 2 fixed the precondition as the same
statistic for every arm — persistence across days, per grade — because the
interleaved series' lag-1 measures something else. By that statistic the arm
fails, from `measure_d043_arms.py`.

### What the measurement found

1. **The residuals carry little persistence across days.** Each grade's daily
   series, on main's construction: Balaghat 0.145 (20 Sep) and −0.011 (6 Oct),
   Bharweli 0.018, Dongri 0.304, Mansar 0.102. The block bootstrap's premise
   does not hold.
2. **The persistence it appeared to have was correlation between grades.** The
   series interleaved three or four grades per day, so its lag-1 of about 0.5
   was mostly same-day correlation between grades (0.68–0.81).
   - A "14-day" block spanned about three and a half days, each day's shared
     shock replayed once per grade. That widened the 14-day spread, and it is
     what took P(shortfall) off saturation.
   - The correct construction — blocks of days, F3 — removes it, and the
     distribution comes out narrower than independent days.
3. **Fixing the crossing alone moves the 14-day figures towards nominal,**
   strongly: tails 0.165 → 0.105 and 0.208 → 0.110. But it does that through the
   same interleaved series. A narrower spread from main's crossed rows is
   removed, not a real dependence added, and it narrows the daily intervals
   slightly (A4).
4. **What is served now is unsound on every dataset measured.**
   `test_track_b_dates.py` on main's construction, at all eight end dates:
   - a correlated spread narrower than independent on five (down to 0.22×);
   - a single residual moving a mine's scale by 10% or more on all eight (up to
     91%);
   - saturation on two;
   - a single day moving a 14-day spread by 5% or more for 20 and 26 grades on
     the two pitch datasets.

   Balaghat on 6 October was the case that surfaced it, not the extent of it.
   These are strict xfails now, so the follow-up must turn them into passes.

### What changes, and what does not

- **Served P(shortfall), forecasts, backtest and calibration: unchanged.** The
  forecaster's `fit` is main's again (`rearrange` and `day_blocks` default to
  off), and the regenerated artifacts match main's figure for figure (§3).
- **Served intervals: guaranteed ordered.** `predict` sorts after the conformal
  step, unconditionally. On main the conformal step had crossed 2 and 16 of
  11,424 backtest intervals, and none at the served end dates.
- **No pitch dataset is frozen.** Freezing on 2026-10-06 would put Balaghat's
  narrower-than-independent P(shortfall) on stage. `docs/DEMO.md` does not
  freeze a dataset a test fails on, and does not look for a date that passes.
- **The follow-up** is logged as its own change with its own pre-registration.
  It estimates the dependence a 14-day total needs from the backtest's
  multi-horizon errors — the correlation across horizons 1–14 within one
  forecast path, per grade and for mine totals. It also tests whether that, not
  one-step persistence, explains the 2.5–3.4× gap measured in #20.

## 3. What is served now, checked

- **Artifacts regenerated** at `3be5919` (`batch all`, 1,077 s): the
  forecaster's fingerprint moved from `e7d44df53c54e72e` to
  `b69dccc782e56f1f`.
  - Compared with main's artifacts value by value — ignoring only identity,
    vintage, hashes and served-from fields — all ten forecasts, the pilot
    backtest and the calibration are **identical**. Served P(shortfall) is
    unchanged.
  - An earlier regeneration measured the calibration under the "both" arm,
    because the harness defaulted to it. The comparison caught it (daily
    coverage 0.755 against 0.761), and it was discarded before commit; the
    default was fixed in `3be5919`.
- **No crossed interval is served** (A1):
  - `test_served_intervals.py` passes on every artifact, and on `predict` with
    every conformal width forced to −1,000 t;
  - `npm run test:band` reads the rendered chart for every mine and grade:
    476 plotted points, every median inside its band.
- **Revert-proofs, in separate worktrees:**
  - one Balaghat ferro-manganese day edited so p90 falls below the median:
    `test:band` fails on exactly that point ("day 3: median outside its
    band"), and so does the artifact test (median 247.9, p90 242.9);
  - main's `predict`, without the post-conformal sort (worktree at
    `7c3c509`): the negative-width test fails — Balaghat ferro manganese,
    h = 1: q10 1,214.8, q50 250.3, q90 0.0.
