"""
A process serves the dataset `batch all` last generated (app/core/served_dataset.py, D-042).

The cold-start rehearsal followed docs/DEMO.md word for word: regenerate the day
before for a new end date, then start the backend without the variable. The
backend refitted all ten forecasts for the committed default's window over the
new ones and /readyz never returned 200. These pin the rule that fixes it.
"""
import json

import pytest

from app.core import served_dataset as sd
from app.ingestion import generator as gen


def _record(tmp_path, end):
    path = tmp_path / "_dataset_identity.json"
    path.write_text(json.dumps({"artifact_identity": {"data_end_date": end}}))
    return path


def test_the_variable_name_is_the_generators():
    assert sd.ENV == gen.DATA_END_DATE_ENV


def test_an_unset_variable_means_the_recorded_dataset(monkeypatch, tmp_path):
    monkeypatch.delenv(sd.ENV, raising=False)
    monkeypatch.setattr(sd, "RECORD", _record(tmp_path, "2026-10-06"))

    end, source = sd.adopt_recorded_end_date()

    assert end == "2026-10-06" and "batch all" in source
    assert gen.resolve_data_end_date().isoformat() == "2026-10-06"
    assert gen.dataset_identity()["data_end_date"] == "2026-10-06"


def test_an_explicit_value_wins(monkeypatch, tmp_path):
    monkeypatch.setenv(sd.ENV, "2027-01-31")
    monkeypatch.setattr(sd, "RECORD", _record(tmp_path, "2026-10-06"))

    end, source = sd.adopt_recorded_end_date()

    assert end == "2027-01-31" and "explicitly" in source
    assert gen.resolve_data_end_date().isoformat() == "2027-01-31"


def test_no_record_leaves_the_committed_default(monkeypatch, tmp_path):
    monkeypatch.delenv(sd.ENV, raising=False)
    monkeypatch.setattr(sd, "RECORD", tmp_path / "absent.json")

    end, _ = sd.adopt_recorded_end_date()

    assert end is None
    assert gen.resolve_data_end_date() == gen.DEFAULT_DATA_END_DATE


def test_the_committed_record_is_the_committed_artifacts_dataset():
    """
    A plain checkout serves exactly the dataset its committed artifacts were built from.

    This asserted that the record equalled the generator's built-in default,
    which held until a pitch dataset was frozen and committed (docs/DEMO.md,
    "Freeze the pitch dataset", step 5): a freeze commits a record for its own
    date, and the default applies only where nothing is recorded (tested
    above). What D-042 needs is that the record and the committed artifacts
    name one dataset — otherwise a plain checkout would refit every forecast at
    startup, the failure this file exists for. Restated in #30, after the
    2026-10-07 freeze failed the old form (DECISIONS.md D-044).
    """
    import json
    from pathlib import Path

    recorded = sd.recorded_end_date()
    assert recorded, "no dataset is recorded in data/synthetic/_dataset_identity.json"
    artifacts = sorted((Path(__file__).resolve().parent / "artifacts").glob("*/*.json"))
    assert artifacts, "no committed artifacts"
    built_for = {
        p.relative_to(p.parents[1]).as_posix(): json.loads(p.read_text())["artifact_identity"]["data_end_date"]
        for p in artifacts
    }
    assert set(built_for.values()) == {recorded}, (
        f"recorded {recorded}; artifacts built for {built_for}"
    )


@pytest.mark.parametrize("bad", ["{not json", json.dumps({"artifact_identity": {}}), json.dumps([])])
def test_an_unreadable_record_is_ignored(monkeypatch, tmp_path, bad):
    monkeypatch.delenv(sd.ENV, raising=False)
    path = tmp_path / "_dataset_identity.json"
    path.write_text(bad)
    monkeypatch.setattr(sd, "RECORD", path)

    assert sd.adopt_recorded_end_date()[0] is None
