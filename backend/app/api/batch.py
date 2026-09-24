"""
Batch jobs (PRD N-2: "Nightly batch; on-demand re-run available").

The rolling-origin backtest refits the model at every origin and takes minutes.
PRD N-1 targets "< 2 s p95 **on cached results**", so the backtest belongs in a
batch that writes an artifact, not on a request path. The API then serves the
artifact and reports how old it is.

    python -m app.api.batch backtest              # all mines
    python -m app.api.batch backtest MOIL-BAL-01  # one mine

Suggested cron (nightly, after the data refresh):

    15 2 * * *  cd /srv/nakshatra/backend && python -m app.api.batch backtest
"""
from __future__ import annotations

import sys
import time

from app.api.track_b import compute_backtest
from app.ingestion.generator import MINES


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

    targets = codes or [m["mine_code"] for m in DEFAULT_MINES]
    for i, code in enumerate(targets, 1):
        t0 = time.time()
        payload = compute_forecast(code, horizon_days=horizon_days)
        path = write_artifact(code, horizon_days, payload)
        print(f"  [{i}/{len(targets)}] {code}: {time.time() - t0:.1f}s -> {path.name}")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] not in ("backtest", "forecast"):
        print(__doc__)
        print("\nusage: python -m app.api.batch {backtest|forecast} [MINE_CODE ...]")
        return 2

    codes = argv[2:] or None
    started = time.time()

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
