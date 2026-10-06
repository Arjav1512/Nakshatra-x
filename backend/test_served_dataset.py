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


def test_the_committed_record_is_the_committed_default():
    """A plain checkout serves exactly what it served before this rule existed."""
    assert sd.recorded_end_date() == gen.DEFAULT_DATA_END_DATE.isoformat()


@pytest.mark.parametrize("bad", ["{not json", json.dumps({"artifact_identity": {}}), json.dumps([])])
def test_an_unreadable_record_is_ignored(monkeypatch, tmp_path, bad):
    monkeypatch.delenv(sd.ENV, raising=False)
    path = tmp_path / "_dataset_identity.json"
    path.write_text(bad)
    monkeypatch.setattr(sd, "RECORD", path)

    assert sd.adopt_recorded_end_date()[0] is None
