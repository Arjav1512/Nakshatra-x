"""
Batch jobs (PRD N-2: "Nightly batch; on-demand re-run available").

The rolling-origin backtest refits the model at every origin and takes minutes.
PRD N-1 targets "< 2 s p95 **on cached results**", so the backtest belongs in a
batch that writes an artifact, not on a request path. The API then serves the
artifact and reports how old it is.

    python -m app.api.batch all                   # EVERYTHING, one dataset
    python -m app.api.batch check                 # do the artifacts agree?
    python -m app.api.batch backtest              # all mines
    python -m app.api.batch backtest MOIL-BAL-01  # one mine
    python -m app.api.batch forecast              # all forecast artifacts

`all` is the one to run before a demo. Forecasts, backtests and the exported
sample CSVs all come from the same generated dataset; regenerated separately
they drift, and a screen showing a forecast next to a backtest MAPE would be
comparing two datasets under one label. If it fails, the previous set is still
in git: `git checkout -- backend/artifacts data/synthetic`.

The forecast window follows the last day of generated actuals. That date is a
parameter with a committed default; override it at generation time to move the
window (docs/DECISIONS.md, docs/DEMO.md):

    NAKSHATRA_DATA_END_DATE=2026-11-30 python -m app.api.batch forecast

Suggested cron (nightly, after the data refresh):

    15 2 * * *  cd /srv/nakshatra/backend && python -m app.api.batch backtest
"""
from __future__ import annotations

import json
import sys
import time

from datetime import timedelta
from pathlib import Path

from app.api.track_b import BACKTEST_CACHE_DIR as BACKTEST_DIR, compute_backtest
from app.ingestion.export import SAMPLE_DIR
from app.ingestion.generator import MINES

SAMPLE_IDENTITY = SAMPLE_DIR / "_dataset_identity.json"


def run_backtests(codes: list[str] | None = None) -> int:
    targets = codes or [m.code for m in MINES]
    failures = 0
    for code in targets:
        started = time.time()
        try:
            res = compute_backtest(code)
            took = time.time() - started
            print(
                f"  {code:14} ok   {took:6.1f}s  "
                f"MAPE {res['model']['mape_pct']:.2f}% vs baseline "
                f"{res['baseline']['mape_pct']:.2f}%  coverage {res['model'].get('coverage_80')}"
            )
        except Exception as exc:  # noqa: BLE001 — a batch must not die on one mine
            failures += 1
            print(f"  {code:14} FAIL {time.time() - started:6.1f}s  {type(exc).__name__}: {exc}")
    return failures


def run_forecasts(codes: list[str] | None = None, horizon_days: int = 14) -> int:
    """
    Generate every forecast artifact, sequentially.

    The generator is seeded, so this is reproducible: the same commit produces
    byte-identical forecasts. That is what makes committing the artifacts
    honest rather than a snapshot of one lucky run.
    """
    from app.api.routes import DEFAULT_MINES
    from app.api.track_b import compute_forecast
    from app.api.forecast_store import write_artifact, artifact_path

    from app.ingestion.generator import resolve_data_end_date
    from datetime import timedelta

    end = resolve_data_end_date()
    print(
        f"  data end date {end.isoformat()} (NAKSHATRA_DATA_END_DATE) — "
        f"forecasts will cover {(end + timedelta(days=1)).isoformat()} to "
        f"{(end + timedelta(days=horizon_days)).isoformat()}"
    )

    targets = codes or [m["mine_code"] for m in DEFAULT_MINES]
    for i, code in enumerate(targets, 1):
        t0 = time.time()
        payload = compute_forecast(code, horizon_days=horizon_days)
        path = write_artifact(code, horizon_days, payload)
        print(f"  [{i}/{len(targets)}] {code}: {time.time() - t0:.1f}s -> {path.name}")
    return 0


def committed_backtest_specs() -> list[tuple[str, int, int]]:
    """
    (mine_code, span_days, step_days) for every backtest artifact on disk.

    Derived from what is there rather than from a list in this file, so
    `batch all` regenerates exactly the committed set and stays correct when
    that set changes. A full backtest costs 216 s, so regenerating all ten
    mines would be 36 minutes of work for artifacts nothing currently serves —
    a mine without one gets a clear 503, which is the designed behaviour.
    """
    import re

    specs = []
    for f in sorted(BACKTEST_DIR.glob("*.json")):
        m = re.fullmatch(r"(.+)_(\d+)d_(\d+)step", f.stem)
        if m:
            specs.append((m.group(1), int(m.group(2)), int(m.group(3))))
    return specs


def run_all() -> int:
    """
    Regenerate every synthetic-derived artifact from one dataset.

    Forecasts, backtests and the exported samples are all built from the same
    generated dataset. Regenerated separately, they drift: the samples could
    describe one three-year window while the forecasts forecast from the end of
    another, and a screen showing a forecast beside a backtest MAPE would be
    comparing two datasets under one label. Nothing in the numbers would look
    wrong.

    So they are regenerated together, from one resolved end date, and verified
    afterwards. If verification fails the previous set is still in git:

        git checkout -- backend/artifacts data/synthetic
    """
    from app.ingestion.export import export_samples
    from app.ingestion.generator import dataset_identity, resolve_data_end_date

    end = resolve_data_end_date()
    ident = dataset_identity(end=end)
    print(f"Dataset identity for this run: {json.dumps(ident)}")
    print(f"Forecast window will be {(end + timedelta(days=1))} to {(end + timedelta(days=14))}\n")

    failures = 0

    print("1/3  Sample CSVs (data/synthetic)")
    t0 = time.time()
    counts = export_samples()
    print(f"  {sum(counts.values()):,} rows across {len(counts)} entities in {time.time() - t0:.1f}s\n")

    print("2/3  Forecast artifacts")
    failures += run_forecasts()
    print()

    specs = committed_backtest_specs()
    print(f"3/3  Backtest artifacts ({len(specs)} committed; ~216 s each)")
    for code, span, step in specs:
        t0 = time.time()
        try:
            compute_backtest(code, span_days=span, step_days=step)
            print(f"  {code:14} ok   {time.time() - t0:6.1f}s")
        except Exception as exc:  # noqa: BLE001 — a batch must not die on one mine
            failures += 1
            print(f"  {code:14} FAIL {time.time() - t0:6.1f}s  {type(exc).__name__}: {exc}")
    print()

    print("Verifying every artifact agrees on one dataset…")
    report = dataset_consistency()
    for row in report["artifacts"]:
        mark = "ok  " if row["consistent"] else "MISMATCH"
        print(f"  {mark} {row['kind']:10} {row['path']}")
    if not report["consistent"]:
        failures += 1
        print("\n  Artifacts disagree. The previous set is still in git:")
        print("    git checkout -- backend/artifacts data/synthetic")
    return failures


def dataset_consistency() -> dict:
    """
    Do all synthetic-derived artifacts claim the same dataset?

    Used by `batch all` after a regeneration and by /readyz at runtime. Track A
    is deliberately absent: its model is trained on real Sentinel-2 and SRTM
    data, not on the synthetic generator, so it has no seed or end date to agree
    on and forcing one onto it would be a fiction.
    """
    from app.api.forecast_store import DATASET_IDENTITY_KEYS, FORECAST_DIR
    from app.ingestion.generator import dataset_identity

    expected = dataset_identity()
    rows = []

    def add(kind: str, path: Path) -> None:
        try:
            data = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            rows.append({"kind": kind, "path": path.name, "consistent": False,
                         "reason": f"unreadable: {exc}", "identity": None})
            return
        ident = data.get("artifact_identity") or {}
        got = {k: ident.get(k) for k in DATASET_IDENTITY_KEYS}
        diffs = [f"{k}: artifact {got[k]!r} vs code {expected[k]!r}"
                 for k in DATASET_IDENTITY_KEYS if got[k] != expected[k]]
        rows.append({
            "kind": kind, "path": path.name, "consistent": not diffs,
            "reason": "; ".join(diffs) or None, "identity": got,
        })

    for f in sorted(FORECAST_DIR.glob("*.json")):
        add("forecast", f)
    for f in sorted(BACKTEST_DIR.glob("*.json")):
        add("backtest", f)
    samples = SAMPLE_IDENTITY
    if samples.exists():
        add("samples", samples)
    else:
        rows.append({"kind": "samples", "path": samples.name, "consistent": False,
                     "reason": "missing — run `python -m app.api.batch all`", "identity": None})

    return {
        "consistent": bool(rows) and all(r["consistent"] for r in rows),
        "expected": expected,
        "artifacts": rows,
        "note": (
            "Track A is excluded: its model is trained on real Sentinel-2 and "
            "SRTM data, not on the synthetic generator."
        ),
    }


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] not in ("backtest", "forecast", "all", "check"):
        print(__doc__)
        print("\nusage: python -m app.api.batch {all|check|backtest|forecast} [MINE_CODE ...]")
        return 2

    codes = argv[2:] or None
    started = time.time()

    if argv[1] == "check":
        report = dataset_consistency()
        print(json.dumps(report, indent=2))
        return 0 if report["consistent"] else 1

    if argv[1] == "all":
        failures = run_all()
        print(f"Done in {time.time() - started:.1f}s · {failures} failure(s)")
        return 1 if failures else 0

    if argv[1] == "forecast":
        print(f"Computing forecasts for {len(codes) if codes else 10} mine(s)…")
        failures = run_forecasts(codes)
    else:
        print(f"Computing backtests for {len(codes) if codes else len(MINES)} mine(s)…")
        failures = run_backtests(codes)

    print(f"Done in {time.time() - started:.1f}s · {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
