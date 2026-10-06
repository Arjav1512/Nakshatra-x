"""
Batch jobs (PRD N-2: "Nightly batch; on-demand re-run available").

The rolling-origin backtest refits the model at every origin and takes minutes.
PRD N-1 targets "< 2 s p95 **on cached results**", so the backtest belongs in a
batch that writes an artifact, not on a request path. The API then serves the
artifact and reports how old it is.

    python -m app.api.batch all                   # EVERYTHING, one dataset
    python -m app.api.batch all --force           # recompute even what matches
    python -m app.api.batch tiles                 # map tiles for offline demo
    python -m app.api.batch check                 # agree, and built by this code?
    python -m app.api.batch backtest              # all mines
    python -m app.api.batch backtest MOIL-BAL-01  # one mine
    python -m app.api.batch forecast              # all forecast artifacts

`all` is the one to run before a demo. Forecasts, backtests and the exported
sample CSVs all come from the same generated dataset; regenerated separately
they drift, and a screen showing a forecast next to a backtest MAPE would be
comparing two datasets under one label. If it fails, the previous set is still
in git: `git checkout -- backend/artifacts data/synthetic`.

Nothing whose identity matches the running code is recomputed, and nothing that
comes out the same is rewritten. Running `all` twice therefore changes nothing
the second time, and an artifact's `vintage`, `computed_at` or `generated_at` is
when its content last changed — not when someone last ran this. `--force`
recomputes anyway, as a determinism check: an artifact that comes out identical
is still left as it was.

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
BACKEND_DIR = Path(__file__).resolve().parents[2]
CALIBRATION_ARTIFACT = BACKEND_DIR / "artifacts" / "calibration" / "cumulative_coverage.json"


def _mtime_ns(path: Path) -> int | None:
    try:
        return path.stat().st_mtime_ns
    except OSError:
        return None


def _backtest_is_current(code: str, span_days: int = 150, step_days: int = 14) -> bool:
    """A backtest artifact exists and was produced by this code and dataset."""
    from app.api.forecast_store import identity_matches
    from app.api.track_b import _backtest_cache_path

    try:
        data = json.loads(_backtest_cache_path(code, span_days, step_days).read_text())
    except (OSError, json.JSONDecodeError):
        return False
    return identity_matches(data)[0]


def _backtest(code: str, span_days: int, step_days: int, force: bool) -> str:
    """Bring one backtest up to date. Returns what happened, for the log."""
    from app.api.track_b import _backtest_cache_path

    if not force and _backtest_is_current(code, span_days, step_days):
        return "unchanged — identity matches the running code; not recomputed"
    path = _backtest_cache_path(code, span_days, step_days)
    before = _mtime_ns(path)
    res = compute_backtest(code, span_days=span_days, step_days=step_days)
    verb = "identical — not rewritten" if before is not None and _mtime_ns(path) == before else "written"
    return (
        f"MAPE {res['model']['mape_pct']:.2f}% vs baseline "
        f"{res['baseline']['mape_pct']:.2f}%  coverage {res['model'].get('coverage_80')}  ({verb})"
    )


def run_backtests(codes: list[str] | None = None, force: bool = False) -> int:
    targets = codes or [m.code for m in MINES]
    failures = 0
    for code in targets:
        started = time.time()
        try:
            outcome = _backtest(code, 150, 14, force)
            print(f"  {code:14} ok   {time.time() - started:6.1f}s  {outcome}")
        except Exception as exc:  # noqa: BLE001 — a batch must not die on one mine
            failures += 1
            print(f"  {code:14} FAIL {time.time() - started:6.1f}s  {type(exc).__name__}: {exc}")
    return failures


def run_forecasts(
    codes: list[str] | None = None, horizon_days: int = 14, force: bool = False
) -> int:
    """
    Bring every forecast artifact up to date, sequentially.

    The generator is seeded, so this is reproducible: the same commit produces
    byte-identical forecasts. That is what makes committing the artifacts
    honest rather than a snapshot of one lucky run — and it is why an artifact
    whose identity already matches is skipped rather than recomputed.
    """
    from app.api.routes import DEFAULT_MINES
    from app.api.track_b import compute_forecast
    from app.api.forecast_store import is_fresh, write_artifact

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
        if not force and is_fresh(code, horizon_days):
            print(f"  [{i}/{len(targets)}] {code}: unchanged — identity matches the running code; not recomputed")
            continue
        t0 = time.time()
        payload = compute_forecast(code, horizon_days=horizon_days)
        path, written = write_artifact(code, horizon_days, payload)
        verb = "written" if written else "identical — not rewritten"
        print(f"  [{i}/{len(targets)}] {code}: {time.time() - t0:.1f}s -> {path.name} ({verb})")
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


def run_all(force: bool = False) -> int:
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

    An artifact whose identity already matches is not recomputed, and one that
    comes out identical is not rewritten (module docstring). `force` recomputes
    every kind regardless.
    """
    from app.ingestion.export import export_samples
    from app.ingestion.generator import dataset_identity, resolve_data_end_date

    end = resolve_data_end_date()
    ident = dataset_identity(end=end)
    print(f"Dataset identity for this run: {json.dumps(ident)}")
    print(f"Forecast window will be {(end + timedelta(days=1))} to {(end + timedelta(days=14))}\n")

    failures = 0

    print("1/4  Sample CSVs (data/synthetic)")
    t0 = time.time()
    written: list[str] = []
    counts = export_samples(written=written)
    print(
        f"  {sum(counts.values()):,} rows across {len(counts)} entities in {time.time() - t0:.1f}s — "
        + (f"written: {', '.join(written)}" if written else "identical — nothing rewritten")
        + "\n"
    )

    print("2/4  Forecast artifacts")
    failures += run_forecasts(force=force)
    print()

    specs = committed_backtest_specs()
    print(f"3/4  Backtest artifacts ({len(specs)} committed; ~216 s each when recomputed)")
    for code, span, step in specs:
        t0 = time.time()
        try:
            outcome = _backtest(code, span, step, force)
            print(f"  {code:14} ok   {time.time() - t0:6.1f}s  {outcome}")
        except Exception as exc:  # noqa: BLE001 — a batch must not die on one mine
            failures += 1
            print(f"  {code:14} FAIL {time.time() - t0:6.1f}s  {type(exc).__name__}: {exc}")
    print()

    print("4/4  Calibration artifact (~9 min when re-measured: refits at 24 origins)")
    failures += run_calibration(force=force)
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


CALIBRATION_HARNESS = BACKEND_DIR / "measure_cumulative_calibration.py"


def calibration_is_current() -> bool:
    """
    The calibration artifact describes this model AND was measured by this harness.

    The model's identity alone is not enough here. The harness lives outside the
    forecast's import chain, so a change to how calibration is measured leaves
    `artifact_identity` untouched; the artifact records the harness's own
    fingerprint so that change is seen too.
    """
    from app.api.forecast_store import file_fingerprint, identity_matches

    try:
        data = json.loads(CALIBRATION_ARTIFACT.read_text())
    except (OSError, json.JSONDecodeError):
        return False
    return (
        identity_matches(data)[0]
        and data.get("harness_fingerprint") == file_fingerprint(CALIBRATION_HARNESS)
    )


def run_calibration(force: bool = False) -> int:
    """
    Re-measure the 14-day calibration the console shows beside P(shortfall).

    Runs the measurement script as a subprocess rather than importing it, so
    there is one implementation of the measurement and `batch all` cannot drift
    from what `measure_cumulative_calibration.py` does by hand. The environment
    is inherited, so NAKSHATRA_DATA_END_DATE reaches it and the calibration is
    measured on the same dataset as everything else in this run.
    """
    import subprocess
    import tempfile

    if not force and calibration_is_current():
        print("  calibration unchanged — identity and harness match; not re-measured")
        return 0

    script = CALIBRATION_HARNESS
    t0 = time.time()
    before = _mtime_ns(CALIBRATION_ARTIFACT)
    with tempfile.TemporaryDirectory() as tmp:
        records = Path(tmp) / "records.jsonl"
        for args in (["run", "--out", str(records)], ["artifact", "--records", str(records)]):
            r = subprocess.run([sys.executable, str(script), *args], cwd=BACKEND_DIR,
                               capture_output=True, text=True)
            if r.returncode != 0:
                print(f"  calibration FAIL ({args[0]}): {(r.stderr or r.stdout).strip()[-400:]}")
                return 1
    verb = "identical — not rewritten" if before is not None and _mtime_ns(CALIBRATION_ARTIFACT) == before else "written"
    print(f"  calibration ok   {time.time() - t0:6.1f}s -> {CALIBRATION_ARTIFACT.name} ({verb})")
    return 0


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
    # The calibration shown beside P(shortfall) is measured on this dataset too.
    # Left out of this check, a regeneration with a new end date would leave it
    # describing the old dataset — the console refuses a stale one, so the
    # demo would show "calibration unavailable" instead of the figure.
    calibration = CALIBRATION_ARTIFACT
    if calibration.exists():
        add("calibration", calibration)
    else:
        rows.append({"kind": "calibration", "path": calibration.name, "consistent": False,
                     "reason": "missing — run `python -m app.api.batch all`", "identity": None})
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


def code_identity_report() -> dict:
    """
    Was every committed artifact produced by the code that is checked out now?

    `dataset_consistency` asks whether the artifacts agree on a dataset; this
    asks the stricter question CI needs — the same one the server asks before
    serving (D-041). Per kind:

    - forecasts and backtests: the full identity — dataset, model version, code
      fingerprint, library versions — and a forecast for every mine;
    - calibration: that identity, plus the measuring harness's fingerprint;
    - samples: regenerated in memory and compared with what is committed,
      ignoring only each row's `ingested_at` stamp. They carry no code identity,
      so the content itself is the test.

    Reads only; writes nothing.
    """
    from app.api.forecast_store import FORECAST_DIR, file_fingerprint, identity_matches
    from app.api.routes import DEFAULT_MINES
    from app.ingestion.export import export_samples

    rows: list[dict] = []

    def judge(kind: str, path: Path, extra=None) -> None:
        try:
            data = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            rows.append({"kind": kind, "path": path.name, "ok": False, "reason": f"unreadable: {exc}"})
            return
        ok, reason = identity_matches(data)
        if ok and extra is not None:
            ok, reason = extra(data)
        rows.append({"kind": kind, "path": path.name, "ok": ok, "reason": reason})

    for m in DEFAULT_MINES:
        path = FORECAST_DIR / f"{m['mine_code']}_14d.json"
        if path.exists():
            judge("forecast", path)
        else:
            rows.append({"kind": "forecast", "path": path.name, "ok": False, "reason": "missing"})
    for path in sorted(BACKTEST_DIR.glob("*.json")):
        judge("backtest", path)

    def harness_matches(data: dict) -> tuple[bool, str | None]:
        want = file_fingerprint(CALIBRATION_HARNESS)
        got = data.get("harness_fingerprint")
        return (got == want, None if got == want else f"harness_fingerprint: artifact has {got!r}, harness is {want!r}")

    if CALIBRATION_ARTIFACT.exists():
        judge("calibration", CALIBRATION_ARTIFACT, harness_matches)
    else:
        rows.append({"kind": "calibration", "path": CALIBRATION_ARTIFACT.name, "ok": False, "reason": "missing"})

    differs: list[str] = []
    export_samples(written=differs, dry_run=True)
    rows.append({
        "kind": "samples", "path": SAMPLE_IDENTITY.parent.name, "ok": not differs,
        "reason": ("regenerating would change: " + ", ".join(differs)) if differs else None,
    })
    return {"ok": all(r["ok"] for r in rows), "artifacts": rows}


def run_tiles(argv: list[str]) -> int:
    """
    Fetch the map's raster tiles so a demo survives the network.

    Separate from `all` on purpose: `all` regenerates artifacts from the
    synthetic dataset and is reproducible from the commit. This downloads tiles
    from someone else's service — 39.3 MB in 560 s at z6-z12, measured — and is a
    convenience rather than a build output. Running it nightly would be rude.
    """
    import argparse

    from app.ml.tile_cache import DEFAULT_ZMAX, DEFAULT_ZMIN, count_tiles, fetch_all

    ap = argparse.ArgumentParser(prog="batch tiles")
    ap.add_argument("--zmin", type=int, default=DEFAULT_ZMIN)
    ap.add_argument("--zmax", type=int, default=DEFAULT_ZMAX)
    ap.add_argument("--force", action="store_true", help="refetch tiles already on disk")
    args = ap.parse_args(argv)

    n = count_tiles(args.zmin, args.zmax)
    print(f"Map tile cache — z{args.zmin}-z{args.zmax}, {n} tiles per layer")
    t0 = time.time()
    try:
        m = fetch_all(zmin=args.zmin, zmax=args.zmax, force=args.force)
    except RuntimeError as exc:
        print(f"\n  FAILED: {exc}")
        return 1
    print(
        f"\n  {m['total_mb']} MB on disk in {time.time() - t0:.0f}s "
        f"({len(m['layers'])} layers cached, {len(m['skipped'])} skipped)"
    )
    for sk in m["skipped"]:
        print(f"  skipped {sk['layer']}: {sk['reason']}")
    failed = sum(e.get("n_failed", 0) for e in m["layers"])
    if failed:
        print(f"\n  {failed} tile(s) failed on the network. Run `batch tiles` again —")
        print("  it reuses every tile already on disk and fetches only the missing ones.")
    print(f"  manifest: backend/.tile-cache/_manifest.json")
    print(
        "  The map asks the live tiler first and falls back to these, labelled "
        "with the fetch date."
    )
    return 1 if failed else 0


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] not in ("backtest", "forecast", "all", "check", "tiles"):
        print(__doc__)
        print("\nusage: python -m app.api.batch {all|check|tiles|backtest|forecast} [--force] [MINE_CODE ...]")
        return 2

    # The same rule the server follows: no NAKSHATRA_DATA_END_DATE means the
    # dataset the last `batch all` generated, so `check` judges the artifacts
    # that are actually there and a re-run reproduces them (served_dataset).
    from app.core.served_dataset import adopt_recorded_end_date

    end, source = adopt_recorded_end_date()
    print(f"dataset end date: {end or 'committed default'} — {source}")

    # Tiles take their own flags and touch no artifact, so they are handled
    # before the mine-code parsing the others share.
    if argv[1] == "tiles":
        return run_tiles(argv[2:])

    force = "--force" in argv[2:]
    codes = [a for a in argv[2:] if a != "--force"] or None
    started = time.time()

    if argv[1] == "check":
        report = dataset_consistency()
        print(json.dumps(report, indent=2))
        # Then the stricter question: produced by THIS code? (code_identity_report)
        ident = code_identity_report()
        print("\nProduced by the code checked out now?")
        for row in ident["artifacts"]:
            mark = "ok  " if row["ok"] else "STALE"
            print(f"  {mark} {row['kind']:11} {row['path']}" + (f"  — {row['reason']}" if row["reason"] else ""))
        if not ident["ok"]:
            print("\n  Regenerate with `python -m app.api.batch all` (docs/DEMO.md).")
        return 0 if report["consistent"] and ident["ok"] else 1

    if argv[1] == "all":
        failures = run_all(force=force)
        print(f"Done in {time.time() - started:.1f}s · {failures} failure(s)")
        return 1 if failures else 0

    if argv[1] == "forecast":
        print(f"Forecasts for {len(codes) if codes else 10} mine(s){' (--force)' if force else ''}…")
        failures = run_forecasts(codes, force=force)
    else:
        print(f"Backtests for {len(codes) if codes else len(MINES)} mine(s){' (--force)' if force else ''}…")
        failures = run_backtests(codes, force=force)

    print(f"Done in {time.time() - started:.1f}s · {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
