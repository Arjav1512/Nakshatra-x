"""
Nothing writes into the committed artifacts for a dataset but the recorded one (D-046).

The incident this pins (#31): a script imported `app.api.track_b` without
starting the app, so the recorded end date was never adopted and the
generator's default dataset (2026-09-20) was built. Asking for Balaghat found
no matching artifact, the warmer computed one for 2026-09-20, and it wrote it
over the frozen 2026-10-07 forecast. It was the fourth write of this class into
the committed set; each earlier fix guarded one caller (DECISIONS.md D-046).

The end-to-end tests run in a subprocess against a temporary copy of the code,
the artifacts and the dataset record — never the committed set — so the copy
plays the committed set and a real overwrite can be observed. Each fits the
forecaster once (about 25 s).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

from app.core import served_dataset
from app.ingestion.generator import DEFAULT_DATA_END_DATE, dataset_identity

BACKEND = Path(__file__).resolve().parent
REPO = BACKEND.parent
BAL = Path("backend/artifacts/forecasts/MOIL-BAL-01_14d.json")


# ---------------------------------------------------------------------------
# The rule itself
# ---------------------------------------------------------------------------
# The guard is imported inside each test, not at the top, so the end-to-end
# incident test below also runs unmodified against main's code — where it
# overwrites (the revert-proof).

@pytest.fixture
def guard():
    from app.core import artifact_guard

    return artifact_guard


def test_the_guard_reads_the_served_dataset_record(guard):
    assert guard.RECORD == served_dataset.RECORD


@pytest.fixture
def committed(tmp_path, monkeypatch, guard):
    """A stand-in committed root and record, recorded for 2026-10-07."""
    root = tmp_path / "artifacts"
    (root / "forecasts").mkdir(parents=True)
    record = tmp_path / "_dataset_identity.json"
    record.write_text(json.dumps({"artifact_identity": dataset_identity(end=_d("2026-10-07"))}))
    monkeypatch.setattr(guard, "COMMITTED_ROOT", root)
    monkeypatch.setattr(guard, "RECORD", record)
    return root


def _d(iso):
    from datetime import date

    return date.fromisoformat(iso)


def test_a_write_for_another_dataset_is_refused_naming_both(committed, guard):
    with pytest.raises(guard.ArtifactWriteRefused) as refused:
        guard.check_write(committed / "forecasts" / "X_14d.json", dataset_identity(end=_d("2026-09-20")))
    msg = str(refused.value)
    assert "actuals to 2026-09-20" in msg and "actuals to 2026-10-07" in msg, msg
    assert "batch all" in msg


def test_a_write_for_the_recorded_dataset_passes(committed, guard):
    guard.check_write(committed / "forecasts" / "X_14d.json", dataset_identity(end=_d("2026-10-07")))


def test_writes_outside_the_committed_set_are_not_this_rules_business(committed, guard, tmp_path):
    guard.check_write(tmp_path / "elsewhere" / "X_14d.json", dataset_identity(end=_d("2026-09-20")))


def test_the_record_moves_only_when_that_is_the_point(committed, guard):
    new = dataset_identity(end=_d("2026-10-01"))
    with pytest.raises(guard.ArtifactWriteRefused):
        guard.check_record_write(new, new_dataset_allowed=False)
    guard.check_record_write(new, new_dataset_allowed=True)
    guard.check_record_write(dataset_identity(end=_d("2026-10-07")), new_dataset_allowed=False)


def test_only_an_explicit_date_lets_batch_all_move_the_record(monkeypatch):
    from app.api import batch

    seen = []
    monkeypatch.setattr(batch, "run_all", lambda force=False, new_dataset_allowed=False: seen.append(new_dataset_allowed) or 0)
    monkeypatch.delenv(served_dataset.ENV, raising=False)
    batch.main(["batch", "all"])
    monkeypatch.setenv(served_dataset.ENV, "2026-10-01")
    batch.main(["batch", "all"])
    assert seen == [False, True]


# ---------------------------------------------------------------------------
# End to end, on a copy that plays the committed set
# ---------------------------------------------------------------------------

def _copy(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    shutil.copytree(BACKEND / "app", root / "backend" / "app",
                    ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copytree(BACKEND / "artifacts", root / "backend" / "artifacts",
                    ignore=shutil.ignore_patterns(".warm.lock", "*.tmp"))
    shutil.copytree(REPO / "data" / "synthetic", root / "data" / "synthetic")
    if (BACKEND / "moil.db").exists():
        shutil.copy2(BACKEND / "moil.db", root / "backend" / "moil.db")
    return root


def _run(root: Path, code: str, *, env_extra: dict | None = None, args: list[str] | None = None):
    env = {k: v for k, v in os.environ.items()
           if k not in (served_dataset.ENV, "PYTHONPATH", "NAKSHATRA_SKIP_WARM")}
    env.update({"NAKSHATRA_OFFLINE": "1", **(env_extra or {})})
    cmd = [sys.executable, *(args or ["-c", textwrap.dedent(code)])]
    return subprocess.run(cmd, cwd=root / "backend", env=env, capture_output=True, text=True, timeout=900)


def _recorded(root: Path) -> str:
    return json.loads((root / "data/synthetic/_dataset_identity.json").read_text())["artifact_identity"]["data_end_date"]


def test_a_script_cannot_overwrite_the_committed_set_for_the_default_date(tmp_path):
    """The #31 incident, step for step: it must not overwrite the committed forecast."""
    root = _copy(tmp_path)
    recorded = _recorded(root)
    assert recorded != DEFAULT_DATA_END_DATE.isoformat(), "needs a record that is not the default"
    before = (root / BAL).read_bytes()

    r = _run(root, """
        import json
        from app.api import track_b as tb
        from app.api.forecast_store import Warming
        try:
            tb.recommend_actions("MOIL-BAL-01")
        except Warming:
            print("first call: warming")
        tb.warm_forecast("MOIL-BAL-01").result(timeout=900)
        fx = tb.forecast_mine("MOIL-BAL-01")
        print("RESULT " + json.dumps({"origin": fx["forecast_origin"], "served_from": fx.get("served_from")}))
    """)
    assert r.returncode == 0, r.stderr[-2000:]

    assert (root / BAL).read_bytes() == before, (
        "the committed Balaghat forecast was overwritten by a script computing for "
        f"{DEFAULT_DATA_END_DATE} — the #31 incident"
    )
    refusal = next((line for line in r.stderr.splitlines() if "Refused to write MOIL-BAL-01_14d.json" in line), "")
    assert f"actuals to {DEFAULT_DATA_END_DATE}" in refusal and f"actuals to {recorded}" in refusal, r.stderr[-1500:]
    result = json.loads(next(line for line in r.stdout.splitlines() if line.startswith("RESULT "))[7:])
    # Computing for the other date is still allowed; it is served from memory.
    assert result == {"origin": DEFAULT_DATA_END_DATE.isoformat(), "served_from": "memory"}, result


def test_batch_all_with_an_explicit_date_still_moves_the_committed_set(tmp_path):
    """The one sanctioned way to a new date: the record first, then artifacts against it."""
    root = _copy(tmp_path)
    new = "2026-10-01"
    assert new != _recorded(root)

    # Without `all`, a new date reaches nothing: the record has not moved.
    r = _run(root, "", env_extra={served_dataset.ENV: new},
             args=["-m", "app.api.batch", "forecast", "MOIL-BAL-01", "--force"])
    assert r.returncode == 1 and "Refused to write MOIL-BAL-01_14d.json" in r.stdout, r.stdout[-1500:]
    assert _recorded(root) != new

    # `batch all`, through its own entry point, narrowed to one mine: the
    # backtest and calibration steps are 15 minutes and are not what is tested.
    r = _run(root, """
        import functools
        from app.api import batch
        batch.run_forecasts = functools.partial(batch.run_forecasts, ["MOIL-BAL-01"])
        batch.committed_backtest_specs = lambda: []
        batch.run_calibration = lambda force=False: 0
        batch.main(["batch", "all"])
    """, env_extra={served_dataset.ENV: new})
    assert "Refused" not in r.stdout + r.stderr, (r.stdout + r.stderr)[-1500:]
    assert _recorded(root) == new
    written = json.loads((root / BAL).read_text())
    assert written["artifact_identity"]["data_end_date"] == new
    assert written["forecast_origin"] == new


def test_the_app_still_warms_and_writes_for_the_recorded_dataset(tmp_path):
    """The app adopts the record, so its writes match it and go through."""
    root = _copy(tmp_path)
    recorded = _recorded(root)
    (root / BAL).unlink()

    r = _run(root, """
        import json, time
        from fastapi.testclient import TestClient
        from app.main import app
        with TestClient(app) as c:
            for _ in range(600):
                resp = c.get("/api/v1/mines/1/forecast")
                if resp.status_code == 200:
                    break
                time.sleep(1)
            print("RESULT " + json.dumps({"status": resp.status_code,
                                          "served_from": resp.json().get("served_from")}))
    """)
    assert r.returncode == 0, r.stderr[-2000:]
    assert "Refused" not in r.stdout + r.stderr, (r.stdout + r.stderr)[-1500:]
    result = json.loads(next(line for line in r.stdout.splitlines() if line.startswith("RESULT "))[7:])
    assert result == {"status": 200, "served_from": "artifact"}, result
    written = json.loads((root / BAL).read_text())
    assert written["artifact_identity"]["data_end_date"] == recorded
