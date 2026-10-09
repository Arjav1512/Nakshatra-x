"""
No write into the committed artifacts for any dataset but the recorded one.

The committed artifacts — `backend/artifacts/` — are what the demo serves, and
`data/synthetic/_dataset_identity.json` records which dataset they describe
(D-042). Four times something other than a deliberate regeneration wrote into
them, each for a dataset nobody had chosen (DECISIONS.md D-046):

1. a test's still-running flight wrote an empty Balaghat stub (D-033);
2. the test client's startup warmer overwrote two committed forecasts
   (backend/conftest.py);
3. the backend refitted all ten forecasts for the old window over the new ones
   (D-042);
4. a script that imported `app.api.track_b` built the generator's default
   dataset and wrote a 20 September Balaghat forecast over the frozen set (#31).

Each was fixed at its caller, which left the next caller unguarded. So the rule
lives where every caller passes: the write. Before anything is written under
`backend/artifacts/`, the artifact's dataset identity is compared with the
recorded one, and a mismatch is refused with both named. Computing for another
date is still allowed — the result just stays in memory.

The record itself moves to a new dataset only through `batch all` with an
explicit `NAKSHATRA_DATA_END_DATE`, which writes the record first, so every
artifact written after it matches (`check_record_write`).

This module is in the forecast's import chain, so it is part of the code
fingerprint, on purpose: it decides what reaches the committed set.
"""
from __future__ import annotations

import json
from pathlib import Path

#: The committed artifacts: forecasts, backtests, calibration.
COMMITTED_ROOT = Path(__file__).resolve().parents[2] / "artifacts"
#: The served-dataset record, written by `batch all` (app.ingestion.export).
#: The same file as app.core.served_dataset.RECORD (asserted in a test).
RECORD = Path(__file__).resolve().parents[3] / "data" / "synthetic" / "_dataset_identity.json"
#: What makes two datasets the same one (generator.dataset_identity).
DATASET_KEYS = ("generator", "contract_version", "generator_seed", "data_end_date")


class ArtifactWriteRefused(RuntimeError):
    """A write into the committed artifacts for a dataset that is not the recorded one."""


def dataset_of(identity: dict) -> dict:
    """The dataset part of an artifact identity."""
    return {k: identity.get(k) for k in DATASET_KEYS}


def recorded_dataset() -> dict | None:
    """The recorded served dataset, or None when nothing is recorded."""
    try:
        return dataset_of(json.loads(RECORD.read_text())["artifact_identity"])
    except (OSError, KeyError, TypeError, ValueError):
        return None


def _committed(path: Path) -> bool:
    try:
        Path(path).resolve().relative_to(COMMITTED_ROOT.resolve())
        return True
    except ValueError:
        return False


def _short(dataset: dict | None) -> str:
    if not dataset:
        return "nothing recorded"
    return (f"{dataset['generator']} seed {dataset['generator_seed']}, contract "
            f"{dataset['contract_version']}, actuals to {dataset['data_end_date']}")


def check_write(path: Path, identity: dict) -> None:
    """
    Refuse to write `path` if it is a committed artifact for another dataset.

    Writes outside `backend/artifacts/` (a test's temporary copy, a scratch
    `--out`) are not this rule's business. With no record at all — a checkout
    that never ran `batch all` — the generator's committed default is the served
    dataset (served_dataset.adopt_recorded_end_date), so that is what is
    compared.
    """
    if not _committed(path):
        return
    wanted = dataset_of(identity)
    served = recorded_dataset()
    if served is None:
        from app.ingestion.generator import DEFAULT_DATA_END_DATE, dataset_identity

        served = dataset_of(dataset_identity(end=DEFAULT_DATA_END_DATE))
    if wanted != served:
        raise ArtifactWriteRefused(
            f"Refused to write {Path(path).name}: it is for {_short(wanted)}, but the "
            f"committed artifacts serve {_short(served)} "
            f"(data/synthetic/_dataset_identity.json). Computing for another date is "
            f"fine, and the result stays in memory; writing it into the committed set "
            f"is not. To move the committed set to a new date, run "
            f"`NAKSHATRA_DATA_END_DATE=YYYY-MM-DD python -m app.api.batch all`, which "
            f"records the new dataset first."
        )


def check_record_write(new_identity: dict, *, new_dataset_allowed: bool) -> None:
    """
    Refuse to move the record to another dataset unless that is the point.

    `batch all` with an explicit `NAKSHATRA_DATA_END_DATE` passes
    `new_dataset_allowed=True`; nothing else does. Rewriting the record for the
    dataset it already names, or creating it where none exists, is always
    allowed.
    """
    current = recorded_dataset()
    wanted = dataset_of(new_identity)
    if current is None or current == wanted or new_dataset_allowed:
        return
    raise ArtifactWriteRefused(
        f"Refused to move the served-dataset record from {_short(current)} to "
        f"{_short(wanted)}. Only `NAKSHATRA_DATA_END_DATE=YYYY-MM-DD python -m "
        f"app.api.batch all` moves it, and it regenerates every artifact with it."
    )
