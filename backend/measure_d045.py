"""
DECISIONS.md D-045: measure the two P(shortfall) candidates against main.

    python measure_d045.py run    --end 2026-10-07 --out recs_1007.jsonl
    python measure_d045.py run    --end 2026-09-20 --out recs_0920.jsonl
    python measure_d045.py sanity --out sanity.json
    python measure_d045.py gap    --records recs_0920.jsonl recs_1007.jsonl
    python measure_d045.py decide --records recs_0920.jsonl recs_1007.jsonl --sanity sanity.json

`run` writes records in measure_cumulative_calibration.py's format, three arms
per window, scored on identical windows from one fit per origin: `rho0` (main's
construction, residual blocks — what is served), `horizon` (candidate a) and
`conformal` (candidate b). The statistics are the harness's own functions, so
the main arm here must reproduce the committed calibration artifact's figures
on the frozen dataset — a check that this measures what the harness measures.

`decide` is the only place a verdict is formed, from D-045's criteria as
registered; it reads records it did not produce.

Not imported by anything served. Quiet machine, one process, no parallel runs.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, timedelta

import numpy as np

from app.ingestion.generator import MINES, generate_all
from app.ml import cumulative_candidates as cc
from app.ml.backtest import _cumulative_paths
from app.ml.forecaster import ProductionForecaster, build_covariates, build_series
from measure_cumulative_calibration import (
    N_BOOT, _arm_stats, _boot_indices, _ci, _clusters, _load, _paired,
)

H = list(cc.H)
ARMS = ("rho0", "horizon", "conformal")
CANDIDATES = {"horizon": "(a) horizon dependence", "conformal": "(b) direct calibration of the total"}
#: D-043's eight end dates and its two pitch dates, as test_track_b_dates.py has them.
END_DATES = [
    date(2025, 12, 15), date(2026, 1, 31), date(2026, 3, 15), date(2026, 4, 30),
    date(2026, 6, 15), date(2026, 7, 31), date(2026, 9, 20), date(2026, 10, 6),
]
PITCH_DATES = [date(2026, 9, 20), date(2026, 10, 6)]
FROZEN = date(2026, 10, 7)


def _data(end: date):
    d = generate_all(end=end)
    series = build_series(d["production_by_mine_grade_period"])
    cov = build_covariates(d["rainfall_mm_by_day"], d["equipment_event"], d["blast_record"])
    opencast = {m.code: (m.mine_type.value == "opencast") for m in MINES}
    return d, series, cov, opencast


def _grades(series, mine):
    return sorted({k[1] for k in series if k[0] == mine})


# ---------------------------------------------------------------- run ---------

def run(args) -> int:
    end = date.fromisoformat(args.end)
    _, series, cov, opencast = _data(end)
    origins, o = [], end - timedelta(days=args.span)
    while o + timedelta(days=len(H)) <= end:
        origins.append(o)
        o += timedelta(days=args.step)
    print(f"run — end {end}, {len(origins)} origins {origins[0]}..{origins[-1]} step {args.step}d", flush=True)
    t_all = time.time()
    n = 0
    with open(args.out, "w") as fh:
        fh.write(json.dumps({"type": "meta", "end": end.isoformat(), "n_origins": len(origins),
                             "first_origin": origins[0].isoformat(), "last_origin": origins[-1].isoformat(),
                             "step_days": args.step, "span_days": args.span, "arms": list(ARMS)}) + "\n")
        for i, origin in enumerate(origins, 1):
            t0 = time.time()
            train_end = origin - timedelta(days=1)
            fc = ProductionForecaster().fit(series, cov, train_end=train_end, horizons=tuple(H), opencast=opencast)
            paths, rows = cc.calibration_paths(fc, series, cov, train_end)
            cc.check_reconstruction(fc, rows)
            for code in [m.code for m in MINES]:
                if code not in fc.models or code not in paths:
                    continue
                for g in _grades(series, code):
                    s = series[(code, g)]
                    res = fc.residual_block(code, g)
                    actuals = [s.get(origin + timedelta(days=h)) for h in H]
                    if res is None or any(a is None for a in actuals):
                        continue
                    preds = fc.predict(code, g, origin, H, s, cov)
                    realised = float(sum(float(a) for a in actuals))

                    main = _cumulative_paths(preds, res)
                    R, n_a, pooled_a = cc.horizon_corr(paths[code], g)
                    sims_a = cc.horizon_paths(preds, R)
                    scores, pooled_b = cc.total_scores(paths[code], g)
                    lo_b, hi_b = cc.conformal_band(preds, scores)
                    ind = cc.independent_paths(preds)
                    if main is None or sims_a is None or ind is None:
                        continue

                    def arm(sims):
                        lo, hi = np.percentile(sims, [10, 90])
                        return {"pit": float(np.mean(sims < realised)), "inside": bool(lo <= realised <= hi), "rho": 0.0}

                    arms = {
                        "rho0": arm(main),
                        "horizon": {**arm(sims_a), "n_paths": n_a, "pooled": pooled_a},
                        "conformal": {"pit": cc.conformal_p(preds, scores, realised),
                                      "inside": bool(lo_b <= realised <= hi_b), "rho": 0.0,
                                      "n_scores": int(len(scores)), "pooled": pooled_b},
                    }
                    fh.write(json.dumps({
                        "type": "cum", "origin": origin.isoformat(), "mine": code, "grade": g,
                        "realised": round(realised, 1), "arms": arms,
                        "gap": {"e_ind": float(np.mean(ind)), "sd_ind": float(np.std(ind)),
                                "sd_main": float(np.std(main)), "sd_a": float(np.std(sims_a)),
                                "sd_b": float(np.std(cc.conformal_totals(preds, scores)))},
                    }) + "\n")
                    n += 1
            print(f"  [{i}/{len(origins)}] {origin} {time.time() - t0:5.1f}s  windows={n}", flush=True)
    print(f"wrote {args.out}: {n} windows in {time.time() - t_all:.0f}s")
    return 0


# ------------------------------------------------------------- sanity ---------

def _plan_target(plan, mine, grade, start, end) -> float:
    """Pro-rated plan target over the window — the rule test_track_b_dates.py and track_b use."""
    total = 0.0
    for p in plan:
        g = p.grade if isinstance(p.grade, str) else (p.grade.value if p.grade else None)
        if p.mine_code != mine or g != grade:
            continue
        lo, hi = max(p.period_start, start), min(p.period_end, end)
        if lo > hi:
            continue
        total += float(p.target_tonnes) * ((hi - lo).days + 1) / max((p.period_end - p.period_start).days + 1, 1)
    return total


def _without(gp: cc.GradePaths, keep: np.ndarray) -> cc.GradePaths:
    return cc.GradePaths(origins=[o for o, k in zip(gp.origins, keep) if k], z=gp.z[keep], s=gp.s[keep])


def _sd_a(preds, gp):
    return float(np.std(cc.horizon_paths(preds, np.corrcoef(gp.z, rowvar=False))))


def _sd_b(preds, gp):
    return float(np.std(cc.conformal_totals(preds, np.sort(gp.s))))


def _sanity_at(end: date, a5: bool) -> dict:
    d, series, cov, opencast = _data(end)
    fc = ProductionForecaster().fit(series, cov, train_end=end, opencast=opencast)
    paths, rows = cc.calibration_paths(fc, series, cov, end)
    cc.check_reconstruction(fc, rows)
    start, stop = end + timedelta(days=1), end + timedelta(days=14)
    out = {c: {"narrower": [], "dominated": [], "moved": [], "p": [], "unsaturated": 0, "n_p": 0, "pooled": 0}
           for c in CANDIDATES}
    for mine in sorted(fc.models):
        if mine not in paths:
            continue
        worst_day = None
        if a5:
            z1 = np.asarray(fc.residuals.get(mine, []), dtype=float)
            if len(z1):
                worst_day = fc.residual_row_days[mine][int(np.argmax(np.abs(z1)))]
        for g in _grades(series, mine):
            if g not in paths[mine]:
                continue
            preds = fc.predict(mine, g, end, H, series[(mine, g)], cov)
            gp, pooled = cc._grade_or_pooled(paths[mine], g)
            sd_ind = float(np.std(cc.independent_paths(preds)))
            target = _plan_target(d["plan_target"], mine, g, start, stop)
            for c in CANDIDATES:
                o = out[c]
                o["pooled"] += int(pooled)
                sd_full = _sd_a(preds, gp) if c == "horizon" else _sd_b(preds, gp)
                # (i) not pathologically narrower than independent days
                if sd_full < 0.9 * sd_ind:
                    o["narrower"].append(f"{mine} {g}: sd {sd_full:.0f} vs independent {sd_ind:.0f} ({sd_full / sd_ind:.2f}x)")
                # (iii) no single calibration input dominates
                worst = int(np.argmax(np.max(np.abs(gp.z), axis=1))) if c == "horizon" else int(np.argmax(np.abs(gp.s)))
                keep = np.ones(len(gp.origins), dtype=bool)
                keep[worst] = False
                cut = _sd_a(preds, _without(gp, keep)) if c == "horizon" else _sd_b(preds, _without(gp, keep))
                change = abs(cut - sd_full) / sd_full
                if change >= 0.10:
                    o["dominated"].append(f"{mine} {g}: without its most extreme input the 14-day sd moves {change:.1%}")
                # A5: no single day moves a spread (pitch dates)
                if worst_day is not None:
                    keep = np.array([not (oo + timedelta(days=1) <= worst_day <= oo + timedelta(days=14))
                                     for oo in gp.origins])
                    cut = _sd_a(preds, _without(gp, keep)) if c == "horizon" else _sd_b(preds, _without(gp, keep))
                    change = abs(cut - sd_full) / sd_full
                    if change >= 0.05:
                        o["moved"].append(f"{mine} {g}: without {worst_day} ({int((~keep).sum())} paths) the 14-day sd moves {change:.1%}")
                # (ii) saturation
                if target > 0:
                    if c == "horizon":
                        p = float(np.mean(cc.horizon_paths(preds, np.corrcoef(gp.z, rowvar=False)) < target))
                        ok = 0.001 <= p <= 0.999
                    else:
                        scores = np.sort(gp.s)
                        p = cc.conformal_p(preds, scores, target)
                        lo_p, hi_p = cc.conformal_extremes(len(scores))
                        ok = lo_p < p < hi_p
                    o["p"].append(round(p, 4))
                    o["n_p"] += 1
                    o["unsaturated"] += int(ok)
    for c in CANDIDATES:
        o = out[c]
        o["unsaturated_share"] = round(o["unsaturated"] / o["n_p"], 3) if o["n_p"] else 0.0
        o["saturation_ok"] = o["unsaturated_share"] >= 0.8
        o["passes"] = (not o["narrower"] and not o["dominated"] and o["saturation_ok"]
                       and (not a5 or not o["moved"]))
    return out


def sanity(args) -> int:
    report = {"dates": {}, "frozen": {}}
    for end in END_DATES:
        t0 = time.time()
        report["dates"][end.isoformat()] = _sanity_at(end, a5=end in PITCH_DATES)
        print(f"  {end} {time.time() - t0:5.1f}s  " + "  ".join(
            f"{c}: {'pass' if report['dates'][end.isoformat()][c]['passes'] else 'FAIL'}" for c in CANDIDATES), flush=True)
    t0 = time.time()
    report["frozen"] = _sanity_at(FROZEN, a5=False)
    print(f"  {FROZEN} (frozen, C4) {time.time() - t0:5.1f}s  " + "  ".join(
        f"{c}: unsaturated {report['frozen'][c]['unsaturated_share']}" for c in CANDIDATES), flush=True)
    with open(args.out, "w") as fh:
        json.dump(report, fh, indent=2, default=str)
    print(f"wrote {args.out}")
    return 0


# ---------------------------------------------------------------- gap ---------

def _gap_for(cum: list[dict]) -> dict:
    keys, by = _clusters(cum)
    boots = list(_boot_indices(keys, by, N_BOOT))
    out = {}
    for mine in sorted({r["mine"] for r in cum}):
        idx = [i for i, r in enumerate(cum) if r["mine"] == mine]
        sel = set(idx)
        q1 = np.array([(cum[i]["realised"] - cum[i]["gap"]["e_ind"]) / cum[i]["gap"]["sd_ind"] for i in idx])
        pos = {i: j for j, i in enumerate(idx)}
        q1_b = [float(np.std(q1[[pos[i] for i in b if i in sel]])) for b in boots if any(i in sel for i in b)]
        ratio_a = float(np.mean([cum[i]["gap"]["sd_a"] / cum[i]["gap"]["sd_ind"] for i in idx]))
        # Quantity 2: CV of realised totals across windows, per grade, over the mean independent CV.
        q2 = []
        for g in sorted({cum[i]["grade"] for i in idx}):
            rows = [cum[i] for i in idx if cum[i]["grade"] == g]
            real = np.array([r["realised"] for r in rows])
            cv_real = float(np.std(real) / np.mean(real))
            cv_ind = float(np.mean([r["gap"]["sd_ind"] / r["gap"]["e_ind"] for r in rows]))
            q2.append(cv_real / cv_ind)
        ci = _ci(np.array(q1_b))
        out[mine] = {"error_spread_in_ind_sds": round(float(np.std(q1)), 3), "ci95": ci,
                     "a_sd_ratio": round(ratio_a, 3), "a_inside": bool(ci[0] <= ratio_a <= ci[1]),
                     "realised_cv_over_ind_cv": round(float(np.mean(q2)), 2)}
    return out


def gap(args) -> int:
    report = {}
    for path in args.records:
        meta, cum, _ = _load(path)
        g = _gap_for(cum)
        inside = sum(1 for v in g.values() if v["a_inside"])
        report[meta["end"]] = {"per_mine": g, "mines_a_inside": inside, "a_explains": inside >= 8}
        print(f"\n{meta['end']}: (a) inside the realised error spread's 95% CI for {inside}/10 mines "
              f"-> {'explains' if inside >= 8 else 'does not explain'} the gap")
        for m, v in g.items():
            print(f"  {m:12} errors spread {v['error_spread_in_ind_sds']:5.2f} ind-sd {v['ci95']}  "
                  f"(a) {v['a_sd_ratio']:5.2f}x {'in' if v['a_inside'] else 'OUT'}   "
                  f"realised CV / ind CV {v['realised_cv_over_ind_cv']:5.2f}x")
    if args.out:
        with open(args.out, "w") as fh:
            json.dump(report, fh, indent=2)
    return 0


# ------------------------------------------------------------- decide ---------

def decide(args) -> int:
    with open(args.sanity) as fh:
        san = json.load(fh)
    report = {"datasets": {}, "candidates": {}}
    for path in args.records:
        meta, cum, _ = _load(path)
        keys, by = _clusters(cum)
        boots = list(_boot_indices(keys, by, N_BOOT))
        ds = report["datasets"][meta["end"]] = {"n_windows": len(cum), "n_origins": len(keys)}
        ds["stats"] = {a: _arm_stats(cum, a, boots) for a in ARMS}
        ds["paired"] = {c: _paired(cum, "rho0", c, boots) for c in CANDIDATES}
        ds["b_to_a"] = _paired(cum, "conformal", "horizon", boots)

    for c in CANDIDATES:
        crit = {}
        c1, c2 = [], []
        for end, ds in report["datasets"].items():
            p, s = ds["paired"][c], ds["stats"][c]
            c1.append(p["delta_coverage_ci"][0] > 0 and p["delta_tails_ci"][0] > 0)
            c2.append(s["coverage_80_ci"][0] <= 0.80 <= s["coverage_80_ci"][1]
                      and s["pit_at_extremes_ci"][0] <= 0.10 <= s["pit_at_extremes_ci"][1])
        crit["C1_better_than_main_both_datasets"] = all(c1)
        crit["C2_calibrated_both_datasets"] = all(c2)
        crit["C3_eight_date_sanity"] = all(san["dates"][d][c]["passes"] for d in san["dates"])
        crit["C4_no_saturation_frozen"] = san["frozen"][c]["saturation_ok"]
        crit["C5_presented_figures_unchanged"] = "by construction; verified after regeneration only if it ships"
        passed = all(v is True for k, v in crit.items() if k != "C5_presented_figures_unchanged")
        report["candidates"][c] = {"criteria": crit, "passes": passed}

    a_ok, b_ok = report["candidates"]["horizon"]["passes"], report["candidates"]["conformal"]["passes"]
    if a_ok and b_ok:
        a_better = all(ds["b_to_a"]["delta_coverage_ci"][0] > 0 and ds["b_to_a"]["delta_tails_ci"][0] > 0
                       for ds in report["datasets"].values())
        report["ships"] = "horizon" if a_better else "conformal"
    else:
        report["ships"] = "horizon" if a_ok else "conformal" if b_ok else None

    for end, ds in report["datasets"].items():
        print(f"\n{end}  ({ds['n_windows']} windows at {ds['n_origins']} origins)")
        for a in ARMS:
            s = ds["stats"][a]
            print(f"  {a:10} coverage {s['coverage_80']:.3f} {s['coverage_80_ci']}  tails {s['pit_at_extremes']:.3f} {s['pit_at_extremes_ci']}")
        for c in CANDIDATES:
            p = ds["paired"][c]
            print(f"  main -> {c:9} d-coverage {p['delta_coverage_toward_nominal']:+.4f} {p['delta_coverage_ci']}  "
                  f"d-tails {p['delta_tails_toward_nominal']:+.4f} {p['delta_tails_ci']}")
    print()
    for c, v in report["candidates"].items():
        print(f"{CANDIDATES[c]}: {'PASSES' if v['passes'] else 'fails'}")
        for k, ok in v["criteria"].items():
            print(f"    {k}: {ok}")
    print(f"\nships: {report['ships'] or 'neither — P(shortfall) stays withdrawn'}")
    if args.out:
        with open(args.out, "w") as fh:
            json.dump(report, fh, indent=2)
    return 0


def main(argv) -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--end", required=True)
    r.add_argument("--span", type=int, default=340)
    r.add_argument("--step", type=int, default=14)
    r.add_argument("--out", required=True)
    s = sub.add_parser("sanity")
    s.add_argument("--out", required=True)
    g = sub.add_parser("gap")
    g.add_argument("--records", nargs="+", required=True)
    g.add_argument("--out", default="")
    d = sub.add_parser("decide")
    d.add_argument("--records", nargs="+", required=True)
    d.add_argument("--sanity", required=True)
    d.add_argument("--out", default="")
    args = ap.parse_args(argv[1:])
    return {"run": run, "sanity": sanity, "gap": gap, "decide": decide}[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
