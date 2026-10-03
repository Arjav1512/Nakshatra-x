"""
Held-out validation of the 14-day cumulative distribution, to the rule
pre-registered in docs/DECISIONS.md D-040.

TWO SUBCOMMANDS
---------------
    python measure_cumulative_calibration.py run --span 250 --step 7 --out recs.jsonl
    python measure_cumulative_calibration.py analyse --main m.jsonl --branch b.jsonl

`run` emits one JSON object per evaluated window and says nothing about whether
anything improved. `analyse` is the only place a verdict is formed, and it reads
records it did not produce. Keeping them apart is deliberate: the arm that
decides cannot be the arm that measures.

WHY NOT THE BACKTEST ARTIFACT
-----------------------------
It covers one mine at ten origin dates, so its cumulative coverage moves in steps
of 1/40 = 0.025 and three windows look like a fifteen-point change.
`ProductionForecaster.fit` fits every mine in one pass and that refit is the whole
cost of the rolling protocol, so scoring all ten mines at each origin costs the
same as scoring one and yields roughly forty times the windows.

WHY THE INTERVALS ARE CLUSTERED
-------------------------------
Consecutive origins share 13 of their 14 days, and every mine is scored at the
same origin dates, so a date's windows share weather and equipment state. A
binomial interval would claim precision this design does not have. Every figure
carries a percentile interval from a bootstrap that resamples whole origin dates.

`run` works unchanged on main, where the loading does not exist: the calibrated
arms are simply absent from the records, so before and after can be measured on
identical origins.

Quiet environment, one process, no parallel runs.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import defaultdict
from datetime import date, timedelta

import numpy as np

from app.ingestion.generator import MINES, generate_all
from app.ml.forecaster import ProductionForecaster, build_covariates, build_series

MAX_H = 14
DAILY_HORIZONS = (1, 3, 7, 14)
UNIFORM_PIT_SD = 1.0 / np.sqrt(12.0)
N_BOOT = 2000
BOOT_SEED = 20260921
#: The confidence level of every interval this script reports. Defined once and
#: written into the artifact, so a page that labels the intervals reads the
#: level from the same place the intervals came from rather than typing "95%".
CI_LEVEL = 0.95

try:  # this branch
    from app.ml.forecaster import cumulative_paths

    HAVE_LOADING = True
except ImportError:  # main
    from app.ml.backtest import _cumulative_paths

    HAVE_LOADING = False

    def cumulative_paths(preds, residuals=None, rho=0.0, n_sim=4000, seed=20260921):
        if rho:
            raise RuntimeError("main has no loading")
        return _cumulative_paths(preds, residuals, n_sim=n_sim, seed=seed)


# ---------------------------------------------------------------- run ---------

def run(args: argparse.Namespace) -> int:
    d = generate_all()
    series = build_series(d["production_by_mine_grade_period"])
    cov = build_covariates(d["rainfall_mm_by_day"], d["equipment_event"], d["blast_record"])
    opencast = {m.code: (m.mine_type.value == "opencast") for m in MINES}
    end = date.fromisoformat(d["window"]["end"])

    origins: list[date] = []
    o = end - timedelta(days=args.span)
    while o + timedelta(days=MAX_H) <= end:
        origins.append(o)
        o += timedelta(days=args.step)

    codes = [m.code for m in MINES]
    full = list(range(1, MAX_H + 1))
    print(
        f"run — {len(origins)} origins {origins[0]}..{origins[-1]} step {args.step}d, "
        f"{len(codes)} mines, loading {'present' if HAVE_LOADING else 'ABSENT (main)'}",
        flush=True,
    )

    t_start = time.time()
    n_cum = n_daily = 0
    with open(args.out, "w") as fh:
        fh.write(json.dumps({
            "type": "meta",
            "loading_available": HAVE_LOADING,
            "n_origins": len(origins),
            "first_origin": origins[0].isoformat(),
            "last_origin": origins[-1].isoformat(),
            "step_days": args.step,
            "span_days": args.span,
        }) + "\n")

        for i, origin in enumerate(origins, 1):
            t0 = time.time()
            fc = ProductionForecaster().fit(
                series, cov, train_end=origin - timedelta(days=1),
                horizons=tuple(full), opencast=opencast,
            )
            rho_pooled = float(getattr(fc, "cumulative_rho_default", 0.0))

            for code in codes:
                if code not in fc.models:
                    continue
                res = fc.residuals.get(code)
                if res is None:
                    continue
                rho_mine = float(getattr(fc, "rho_for", lambda _c: 0.0)(code))

                for g in sorted({k[1] for k in series if k[0] == code}):
                    s = series[(code, g)]

                    # Daily rows, for the "unchanged by the loading" identity and
                    # for the split's effect on MAPE and daily coverage.
                    sparse = fc.predict(code, g, origin, list(DAILY_HORIZONS), s, cov)
                    for h in DAILY_HORIZONS:
                        a = s.get(origin + timedelta(days=h))
                        if a is None:
                            continue
                        p = sparse[h]
                        fh.write(json.dumps({
                            "type": "daily", "origin": origin.isoformat(),
                            "mine": code, "grade": g, "h": int(h),
                            "actual": float(a), "q50": p["q50"],
                            "q10": p["q10"], "q90": p["q90"],
                        }) + "\n")
                        n_daily += 1

                    actuals = [s.get(origin + timedelta(days=h)) for h in full]
                    if any(a is None for a in actuals):
                        continue
                    preds = fc.predict(code, g, origin, full, s, cov)
                    realised = float(sum(float(a) for a in actuals))

                    arms: dict[str, dict] = {}
                    wanted = {"rho0": 0.0}
                    if HAVE_LOADING:
                        wanted["permine"] = rho_mine
                        wanted["pooled"] = rho_pooled
                    for name, rho in wanted.items():
                        sims = cumulative_paths(preds, res, rho=rho)
                        if sims is None:
                            continue
                        lo, hi = np.percentile(sims, [10, 90])
                        arms[name] = {
                            "pit": float(np.mean(sims < realised)),
                            "inside": bool(lo <= realised <= hi),
                            "rho": round(float(rho), 3),
                        }
                    if "rho0" not in arms:
                        continue
                    fh.write(json.dumps({
                        "type": "cum", "origin": origin.isoformat(),
                        "mine": code, "grade": g, "realised": round(realised, 1),
                        "rho_permine": round(rho_mine, 3),
                        "rho_pooled": round(rho_pooled, 3),
                        "arms": arms,
                    }) + "\n")
                    n_cum += 1
            print(
                f"  [{i}/{len(origins)}] {origin} {time.time()-t0:5.1f}s  "
                f"cum={n_cum} daily={n_daily}",
                flush=True,
            )

    print(f"\nwrote {args.out}: {n_cum} cumulative windows, {n_daily} daily rows "
          f"in {time.time()-t_start:.0f}s")
    return 0


# ------------------------------------------------------------ analyse ---------

def _load(path: str) -> tuple[dict, list[dict], list[dict]]:
    meta, cum, daily = {}, [], []
    with open(path) as fh:
        for line in fh:
            r = json.loads(line)
            t = r.get("type")
            if t == "meta":
                meta = r
            elif t == "cum":
                cum.append(r)
            elif t == "daily":
                daily.append(r)
    return meta, cum, daily


def _clusters(recs: list[dict]) -> tuple[list[str], dict[str, list[int]]]:
    """Group record indices by origin date — the resampling unit."""
    by = defaultdict(list)
    for i, r in enumerate(recs):
        by[r["origin"]].append(i)
    keys = sorted(by)
    return keys, by


def _boot_indices(keys: list[str], by: dict[str, list[int]], n_boot: int):
    rng = np.random.default_rng(BOOT_SEED)
    for _ in range(n_boot):
        drawn = rng.integers(0, len(keys), size=len(keys))
        idx: list[int] = []
        for k in drawn:
            idx.extend(by[keys[k]])
        yield np.asarray(idx, dtype=int)


def _ci(samples: np.ndarray) -> list[float]:
    tail = (1.0 - CI_LEVEL) / 2.0 * 100.0
    lo, hi = np.percentile(samples, [tail, 100.0 - tail])
    return [round(float(lo), 4), round(float(hi), 4)]


def _arm_stats(cum: list[dict], arm: str, boots: list[np.ndarray]) -> dict | None:
    rows = [r for r in cum if arm in r["arms"]]
    if not rows:
        return None
    pit = np.array([r["arms"][arm]["pit"] for r in rows], dtype=float)
    inside = np.array([r["arms"][arm]["inside"] for r in rows], dtype=bool)
    extreme = (pit < 0.05) | (pit > 0.95)

    # The bootstrap index sets were built over the full record list, so they are
    # re-mapped onto this arm's subset by position.
    pos = {id(r): i for i, r in enumerate(rows)}
    full_to_arm = {}
    for i, r in enumerate(cum):
        if arm in r["arms"]:
            full_to_arm[i] = pos[id(r)]

    cov_b, ext_b, sd_b = [], [], []
    for idx in boots:
        sel = np.array([full_to_arm[i] for i in idx if i in full_to_arm], dtype=int)
        if len(sel) == 0:
            continue
        cov_b.append(float(np.mean(inside[sel])))
        ext_b.append(float(np.mean(extreme[sel])))
        sd_b.append(float(np.std(pit[sel])))
    cov_b = np.array(cov_b); ext_b = np.array(ext_b); sd_b = np.array(sd_b)

    cov = float(np.mean(inside))
    n = len(rows)
    var_binom = cov * (1 - cov) / n
    var_boot = float(np.var(cov_b)) or float("nan")
    ess = n * var_binom / var_boot if var_boot == var_boot and var_boot > 0 else float("nan")

    return {
        "n_windows": n,
        "rho_mean": round(float(np.mean([r["arms"][arm]["rho"] for r in rows])), 3),
        "coverage_80": round(cov, 3),
        "coverage_80_ci": _ci(cov_b),
        "coverage_gap": round(cov - 0.80, 3),
        "pit_at_extremes": round(float(np.mean(extreme)), 3),
        "pit_at_extremes_ci": _ci(ext_b),
        "pit_sd": round(float(np.std(pit)), 4),
        "pit_sd_ci": _ci(sd_b),
        "mean_pit": round(float(np.mean(pit)), 3),
        "effective_sample_size": round(float(ess), 1) if ess == ess else None,
        "design_effect": round(float(n / ess), 2) if ess == ess and ess > 0 else None,
    }


def _paired(cum: list[dict], a: str, b: str, boots: list[np.ndarray]) -> dict | None:
    """d(a) - d(b) for coverage and tails: positive means b is closer to nominal."""
    rows = [r for r in cum if a in r["arms"] and b in r["arms"]]
    if not rows:
        return None
    ia = np.array([r["arms"][a]["inside"] for r in rows], dtype=bool)
    ib = np.array([r["arms"][b]["inside"] for r in rows], dtype=bool)
    pa = np.array([r["arms"][a]["pit"] for r in rows], dtype=float)
    pb = np.array([r["arms"][b]["pit"] for r in rows], dtype=float)
    ea = (pa < 0.05) | (pa > 0.95)
    eb = (pb < 0.05) | (pb > 0.95)

    pos = {id(r): i for i, r in enumerate(rows)}
    full_to = {i: pos[id(r)] for i, r in enumerate(cum) if id(r) in pos}

    def stat(sel):
        d_cov = abs(np.mean(ia[sel]) - 0.80) - abs(np.mean(ib[sel]) - 0.80)
        d_ext = abs(np.mean(ea[sel]) - 0.10) - abs(np.mean(eb[sel]) - 0.10)
        d_sd = abs(np.std(pa[sel]) - UNIFORM_PIT_SD) - abs(np.std(pb[sel]) - UNIFORM_PIT_SD)
        return d_cov, d_ext, d_sd

    allsel = np.arange(len(rows))
    d_cov, d_ext, d_sd = stat(allsel)
    bc, be, bs = [], [], []
    for idx in boots:
        sel = np.array([full_to[i] for i in idx if i in full_to], dtype=int)
        if len(sel) == 0:
            continue
        c, e, s = stat(sel)
        bc.append(c); be.append(e); bs.append(s)
    bc = np.array(bc); be = np.array(be); bs = np.array(bs)
    return {
        "comparison": f"{a} -> {b}",
        "n_windows": len(rows),
        "delta_coverage_toward_nominal": round(float(d_cov), 4),
        "delta_coverage_ci": _ci(bc),
        "delta_coverage_ci_excludes_zero": bool(np.percentile(bc, 2.5) > 0 or np.percentile(bc, 97.5) < 0),
        "delta_tails_toward_nominal": round(float(d_ext), 4),
        "delta_tails_ci": _ci(be),
        "delta_tails_ci_excludes_zero": bool(np.percentile(be, 2.5) > 0 or np.percentile(be, 97.5) < 0),
        "delta_pit_dispersion_toward_uniform": round(float(d_sd), 4),
        "delta_pit_dispersion_ci": _ci(bs),
        "delta_pit_dispersion_ci_excludes_zero": bool(np.percentile(bs, 2.5) > 0 or np.percentile(bs, 97.5) < 0),
    }


def _paired_across(
    a_cum: list[dict], a_arm: str, b_cum: list[dict], b_arm: str, n_boot: int,
) -> dict | None:
    """
    Paired comparison across two runs — main versus this branch.

    The arms live in different files because they are different models, but they
    were scored on the same origins, mines and grades, so they pair on
    (origin, mine, grade). Without this, the split's effect and the PR's net
    effect could only be reported as two point estimates side by side, with no
    interval on the difference.
    """
    def key(r):
        return (r["origin"], r["mine"], r["grade"])

    a_by = {key(r): r for r in a_cum if a_arm in r["arms"]}
    b_by = {key(r): r for r in b_cum if b_arm in r["arms"]}
    shared = sorted(set(a_by) & set(b_by))
    if not shared:
        return None

    ia = np.array([a_by[k]["arms"][a_arm]["inside"] for k in shared], dtype=bool)
    ib = np.array([b_by[k]["arms"][b_arm]["inside"] for k in shared], dtype=bool)
    pa = np.array([a_by[k]["arms"][a_arm]["pit"] for k in shared], dtype=float)
    pb = np.array([b_by[k]["arms"][b_arm]["pit"] for k in shared], dtype=float)
    ea, eb = (pa < 0.05) | (pa > 0.95), (pb < 0.05) | (pb > 0.95)

    by_date = defaultdict(list)
    for i, k in enumerate(shared):
        by_date[k[0]].append(i)
    dates = sorted(by_date)

    def stat(sel):
        return (
            abs(np.mean(ia[sel]) - 0.80) - abs(np.mean(ib[sel]) - 0.80),
            abs(np.mean(ea[sel]) - 0.10) - abs(np.mean(eb[sel]) - 0.10),
            abs(np.std(pa[sel]) - UNIFORM_PIT_SD) - abs(np.std(pb[sel]) - UNIFORM_PIT_SD),
        )

    d_cov, d_ext, d_sd = stat(np.arange(len(shared)))
    rng = np.random.default_rng(BOOT_SEED)
    bc, be, bs = [], [], []
    for _ in range(n_boot):
        drawn = rng.integers(0, len(dates), size=len(dates))
        sel = np.array([i for k in drawn for i in by_date[dates[k]]], dtype=int)
        c, e, s = stat(sel)
        bc.append(c); be.append(e); bs.append(s)
    bc, be, bs = np.array(bc), np.array(be), np.array(bs)
    return {
        "comparison": f"main:{a_arm} -> branch:{b_arm}",
        "n_windows": len(shared),
        "n_origin_dates": len(dates),
        "delta_coverage_toward_nominal": round(float(d_cov), 4),
        "delta_coverage_ci": _ci(bc),
        "delta_tails_toward_nominal": round(float(d_ext), 4),
        "delta_tails_ci": _ci(be),
        "delta_pit_dispersion_toward_uniform": round(float(d_sd), 4),
        "delta_pit_dispersion_ci": _ci(bs),
    }


def _daily_stats(daily: list[dict]) -> dict:
    a = np.array([r["actual"] for r in daily], dtype=float)
    q = np.array([r["q50"] for r in daily], dtype=float)
    lo = np.array([r["q10"] for r in daily], dtype=float)
    hi = np.array([r["q90"] for r in daily], dtype=float)
    denom = np.maximum(np.abs(a), 1.0)
    sden = np.maximum((np.abs(a) + np.abs(q)) / 2.0, 1e-9)
    return {
        "n": int(len(a)),
        "mape_pct": round(float(np.mean(np.abs(a - q) / denom) * 100.0), 3),
        "smape_pct": round(float(np.mean(np.abs(a - q) / sden) * 100.0), 3),
        "mae_tonnes": round(float(np.mean(np.abs(a - q))), 3),
        "coverage_80": round(float(np.mean((a >= lo) & (a <= hi))), 4),
        "mean_width_tonnes": round(float(np.mean(hi - lo)), 2),
    }


def analyse(args: argparse.Namespace) -> int:
    bmeta, bcum, bdaily = _load(args.branch)
    keys, by = _clusters(bcum)
    boots = list(_boot_indices(keys, by, args.n_boot))

    print(f"ANALYSIS — pre-registered rule, docs/DECISIONS.md D-040")
    print(f"branch records: {len(bcum)} windows at {len(keys)} origin dates "
          f"({bmeta.get('first_origin')}..{bmeta.get('last_origin')}, "
          f"step {bmeta.get('step_days')}d)")
    print(f"cluster bootstrap: {args.n_boot} resamples of whole origin dates, seed {BOOT_SEED}")
    print()

    report: dict = {"branch_meta": bmeta, "n_boot": args.n_boot, "arms": {}, "paired": {}}

    for arm in ("rho0", "pooled", "permine"):
        st = _arm_stats(bcum, arm, boots)
        if st:
            report["arms"][arm] = st

    if args.main:
        mmeta, mcum, mdaily = _load(args.main)
        mkeys, mby = _clusters(mcum)
        mboots = list(_boot_indices(mkeys, mby, args.n_boot))
        st = _arm_stats(mcum, "rho0", mboots)
        if st:
            report["arms"]["main"] = st
        report["daily"] = {"main": _daily_stats(mdaily), "branch": _daily_stats(bdaily)}
        # Same origin dates on both sides?
        report["origin_dates_identical"] = sorted(mkeys) == sorted(keys)

    for a, b in (("rho0", "permine"), ("rho0", "pooled"), ("pooled", "permine")):
        pr = _paired(bcum, a, b, boots)
        if pr:
            report["paired"][f"{a}__{b}"] = pr

    if args.main:
        report["vs_main"] = {}
        for arm in ("rho0", "pooled", "permine"):
            pr = _paired_across(mcum, "rho0", bcum, arm, args.n_boot)
            if pr:
                report["vs_main"][arm] = pr

    # ---- printout ----
    hdr = f"{'arm':10} {'n':>5} {'rho':>5} {'cov80':>6} {'95% CI':>16} {'tails':>6} {'95% CI':>16} {'pitSD':>7}"
    print(hdr)
    print("-" * len(hdr))
    for name in ("main", "rho0", "pooled", "permine"):
        s = report["arms"].get(name)
        if not s:
            continue
        print(f"{name:10} {s['n_windows']:5} {s['rho_mean']:5.2f} {s['coverage_80']:6.3f} "
              f"{str(s['coverage_80_ci']):>16} {s['pit_at_extremes']:6.3f} "
              f"{str(s['pit_at_extremes_ci']):>16} {s['pit_sd']:7.4f}")
    print(f"\nnominal: coverage 0.800, tails 0.100, PIT sd {UNIFORM_PIT_SD:.4f}")
    s = report["arms"].get("rho0")
    if s and s.get("effective_sample_size"):
        n_dates = len(keys)
        print(f"effective sample size (rho0 coverage): {s['effective_sample_size']} "
              f"of {s['n_windows']} windows — design effect {s['design_effect']}x")
        if n_dates < 20:
            print(f"  CAVEAT: {n_dates} origin dates is too few to estimate the "
                  f"design effect reliably; a value below 1.0 is noise, not a "
                  f"finding.")

    print("\nPAIRED IMPROVEMENTS (positive = second arm closer to nominal)")
    for k, pr in report["paired"].items():
        print(f"\n  {pr['comparison']}  (n={pr['n_windows']})")
        for label, key in (("coverage", "coverage"), ("tails", "tails"),
                           ("PIT dispersion", "pit_dispersion")):
            d = pr[f"delta_{key}_toward_nominal" if key != "pit_dispersion"
                   else "delta_pit_dispersion_toward_uniform"]
            ci = pr[f"delta_{key}_ci" if key != "pit_dispersion" else "delta_pit_dispersion_ci"]
            ex = pr[f"delta_{key}_ci_excludes_zero" if key != "pit_dispersion"
                    else "delta_pit_dispersion_ci_excludes_zero"]
            print(f"    {label:15} {d:+.4f}  CI {ci}  {'EXCLUDES 0' if ex else 'includes 0'}")

    if report.get("vs_main"):
        print("\nVERSUS MAIN, PAIRED ON (origin, mine, grade) — positive = branch closer")
        print("  (main:rho0 -> branch:rho0 is the SPLIT's effect; the others are the")
        print("   PR's net effect, split and loading together)")
        for arm, pr in report["vs_main"].items():
            print(f"\n  main -> branch:{arm}  (n={pr['n_windows']}, "
                  f"{pr['n_origin_dates']} dates)")
            print(f"    coverage        {pr['delta_coverage_toward_nominal']:+.4f}  "
                  f"CI {pr['delta_coverage_ci']}")
            print(f"    tails           {pr['delta_tails_toward_nominal']:+.4f}  "
                  f"CI {pr['delta_tails_ci']}")
            print(f"    PIT dispersion  {pr['delta_pit_dispersion_toward_uniform']:+.4f}  "
                  f"CI {pr['delta_pit_dispersion_ci']}")

    if "daily" in report:
        print("\nDAILY METRICS — the split's effect (the loading cannot touch these)")
        for k, v in report["daily"].items():
            print(f"  {k:8} MAPE {v['mape_pct']:.3f}%  sMAPE {v['smape_pct']:.3f}%  "
                  f"MAE {v['mae_tonnes']:.2f}t  cov80 {v['coverage_80']:.4f}  "
                  f"width {v['mean_width_tonnes']:.1f}t  n={v['n']}")
        print(f"  identical origin dates on both sides: {report['origin_dates_identical']}")

    # ---- the pre-registered decision ----
    print("\n" + "=" * 72)
    verdict = _verdict(report)
    report["verdict"] = verdict
    for line in verdict["lines"]:
        print(line)
    print("=" * 72)

    if args.out:
        with open(args.out, "w") as f:
            json.dump(report, f, indent=2)
        print(f"\nwrote {args.out}")
    return 0


def _verdict(report: dict) -> dict:
    """Apply D-040 mechanically. No judgement here beyond the written rule."""
    lines: list[str] = []
    arms, paired = report["arms"], report["paired"]

    # Which loading, by the pre-registered rule.
    pp = paired.get("pooled__permine")
    if pp and pp["delta_pit_dispersion_ci"][0] > 0:
        choice = "permine"
        lines.append("LOADING CHOICE: per-mine — it beats pooled on held-out PIT "
                     f"dispersion by {pp['delta_pit_dispersion_toward_uniform']:+.4f}, "
                     f"CI {pp['delta_pit_dispersion_ci']} strictly above zero.")
    else:
        choice = "pooled"
        why = ("no pooled-vs-per-mine comparison available" if not pp else
               f"per-mine gains {pp['delta_pit_dispersion_toward_uniform']:+.4f} on PIT "
               f"dispersion, CI {pp['delta_pit_dispersion_ci']} — not strictly above zero")
        lines.append(f"LOADING CHOICE: pooled — {why}.")

    key = f"rho0__{choice}"
    pr = paired.get(key)
    if not pr:
        lines.append(f"SHIP: DISABLED — no paired comparison for {key}.")
        return {"loading": choice, "ship_enabled": False, "lines": lines}

    c1 = pr["delta_coverage_toward_nominal"] >= 0 and pr["delta_tails_toward_nominal"] >= 0
    c2 = (pr["delta_coverage_ci"][0] > 0) or (pr["delta_tails_ci"][0] > 0)
    lines.append(
        f"CRITERION 1 (neither metric worse): coverage {pr['delta_coverage_toward_nominal']:+.4f}, "
        f"tails {pr['delta_tails_toward_nominal']:+.4f} -> {'PASS' if c1 else 'FAIL'}"
    )
    lines.append(
        f"CRITERION 2 (one CI excludes zero, improving): coverage CI "
        f"{pr['delta_coverage_ci']}, tails CI {pr['delta_tails_ci']} -> "
        f"{'PASS' if c2 else 'FAIL'}"
    )
    # Criterion 3 is not measurable here and this script does not pretend to
    # measure it. A run emits ONE set of daily rows, because the loading enters
    # only `cumulative_paths` and never `predict` — so comparing daily metrics
    # between arms would compare a thing to itself and always "pass".
    # It is asserted where it can be: test_cumulative_calibration.py
    # ::test_loading_leaves_daily_forecast_identical.
    lines.append("CRITERION 3 (loading leaves daily metrics and the point forecast "
                 "identical): NOT CHECKED HERE — one set of daily rows per run, so "
                 "this script cannot test it. Asserted by "
                 "test_cumulative_calibration.py::test_loading_leaves_daily_"
                 "forecast_identical.")

    ship = bool(c1 and c2)
    lines.append("")
    lines.append(f"SHIP: {'ENABLED' if ship else 'DISABLED (negative result)'} "
                 f"with the {choice} loading.")
    if not ship:
        lines.append("The mechanism, the three-block split and this script stay; the "
                     "default loading is zero and the result is reported as negative.")
    return {"loading": choice, "ship_enabled": ship,
            "criterion_1_no_metric_worse": bool(c1),
            "criterion_2_ci_excludes_zero": bool(c2),
            "lines": lines}


CALIBRATION_ARTIFACT = (
    __import__("pathlib").Path(__file__).resolve().parent
    / "artifacts" / "calibration" / "cumulative_coverage.json"
)


def artifact(args: argparse.Namespace) -> int:
    """
    Write the calibration artifact the console reads beside P(shortfall).

    The console must not carry these numbers in its copy: they describe a model,
    and a figure typed into a component outlives the model it described. So they
    are computed here from measurement records, written with the identity of the
    model they measured, and served. If the model changes, the identity stops
    matching and the API says the calibration is stale rather than showing it.

    Only the shipped configuration is reported — the `rho0` arm, which is the
    model as it runs. The declined loading's arms are in docs/CALIBRATION.md.
    """
    import hashlib
    import time as _time

    from app.api.forecast_store import artifact_identity, file_fingerprint, says_the_same
    from app.ml.forecaster import MODEL_VERSION

    raw = open(args.records, "rb").read()
    meta, cum, _daily = _load(args.records)
    if not cum:
        print("no cumulative records")
        return 1

    def stats_for(recs: list[dict]) -> dict | None:
        keys, by = _clusters(recs)
        boots = list(_boot_indices(keys, by, args.n_boot))
        st = _arm_stats(recs, "rho0", boots)
        if not st:
            return None
        return {
            "coverage_80": st["coverage_80"],
            "coverage_80_ci95": st["coverage_80_ci"],
            "pit_at_extremes": st["pit_at_extremes"],
            "pit_at_extremes_ci95": st["pit_at_extremes_ci"],
            "n_windows": st["n_windows"],
            "n_origin_dates": len(keys),
            "effective_sample_size": st.get("effective_sample_size"),
            "design_effect": st.get("design_effect"),
        }

    portfolio = stats_for(cum)
    per_mine = {}
    for mine in sorted({r["mine"] for r in cum}):
        st = stats_for([r for r in cum if r["mine"] == mine])
        if st:
            per_mine[mine] = st

    out = {
        "kind": "cumulative_calibration",
        "quantity": "share of realised 14-day totals inside the forecast's 80% band",
        "nominal_coverage": 0.80,
        "nominal_tail_frequency": 0.10,
        "ci_level": CI_LEVEL,
        "model_version": MODEL_VERSION,
        "portfolio": portfolio,
        "per_mine": per_mine,
        "window": {
            "first_origin": meta.get("first_origin"),
            "last_origin": meta.get("last_origin"),
            "step_days": meta.get("step_days"),
            "n_origins": meta.get("n_origins"),
        },
        "method": (
            "Rolling-origin: refit before every origin, score the next 14 days. "
            f"{CI_LEVEL:.0%} intervals from a cluster bootstrap resampling whole origin dates "
            f"({args.n_boot} resamples, seed {BOOT_SEED}), because a date's windows "
            "share weather and equipment state and are not independent."
        ),
        "records_sha256": hashlib.sha256(raw).hexdigest(),
        "generated_at": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
        "generated_by": "python measure_cumulative_calibration.py artifact --records <run output>",
        "artifact_identity": artifact_identity(),
        # This script is outside the forecast's import chain, so a change to how
        # calibration is measured would not move `artifact_identity`. Recorded so
        # `batch all` can tell a current measurement from one by an older harness.
        "harness_fingerprint": file_fingerprint(__import__("pathlib").Path(__file__)),
        "doc": "docs/CALIBRATION.md",
        "provenance": {
            "source_kind": "derived",
            "is_live": False,
            "is_synthetic": True,
            "source": (
                "Held-out rolling-origin backtest of the production forecaster on the "
                "seeded synthetic dataset"
            ),
            "note": (
                "Describes the model's behaviour on synthetic data generated to the "
                "ingestion contract, not on MOIL's operations (PRD 8.2)."
            ),
        },
    }
    dest = __import__("pathlib").Path(args.out) if args.out else CALIBRATION_ARTIFACT
    dest.parent.mkdir(parents=True, exist_ok=True)
    p = portfolio
    if dest.exists() and says_the_same(dest, out):
        # Same records, same figures: the file and its `generated_at` stay.
        print(f"unchanged {dest} — identical apart from generated_at; not rewritten")
    else:
        dest.write_text(json.dumps(out, indent=2) + "\n")
        print(f"wrote {dest}")
    print(f"  portfolio  coverage {p['coverage_80']} {p['coverage_80_ci95']}  "
          f"tails {p['pit_at_extremes']}  n={p['n_windows']} at {p['n_origin_dates']} dates  "
          f"ESS {p['effective_sample_size']}")
    for m, st in per_mine.items():
        print(f"  {m:14} coverage {st['coverage_80']} {st['coverage_80_ci95']}  n={st['n_windows']}")
    return 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("run")
    # step 14 by default: a 14-day window stepped by 14 days does not overlap the
    # next one, which is what makes resampling whole origin dates a valid
    # bootstrap. At step 7 adjacent dates share half their days and the intervals
    # would be too narrow.
    r.add_argument("--span", type=int, default=340)
    r.add_argument("--step", type=int, default=14)
    r.add_argument("--out", required=True)
    r.set_defaults(fn=run)

    a = sub.add_parser("analyse")
    a.add_argument("--branch", required=True)
    a.add_argument("--main", default="")
    a.add_argument("--n-boot", type=int, default=N_BOOT)
    a.add_argument("--out", default="")
    a.set_defaults(fn=analyse)

    t = sub.add_parser("artifact")
    t.add_argument("--records", required=True)
    t.add_argument("--n-boot", type=int, default=N_BOOT)
    t.add_argument("--out", default="")
    t.set_defaults(fn=artifact)

    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
