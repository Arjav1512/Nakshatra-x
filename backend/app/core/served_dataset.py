"""
Which synthetic dataset a process serves when nobody says.

`NAKSHATRA_DATA_END_DATE` decides the dataset (DECISIONS.md D-030). `batch all`
takes it at generation time and records it, with the rest of the identity, in
`data/synthetic/_dataset_identity.json`. A process started without the variable
used to fall back to the committed default instead.

The cold-start rehearsal found what that does (DECISIONS.md D-042). DEMO.md's
"day before" regenerates everything for a new date; the pre-flight then starts
the backend without the variable — and it cannot carry it, because `$(date +%F)`
on demo day is a different date. The backend judged every new artifact stale
against the old default, refitted all ten forecasts for the OLD window over the
new ones, and `/readyz` stayed 503 indefinitely, because the backtest,
calibration and samples still described the new date. Following the document
word for word undid the step it exists for.

So an unset variable now means "the dataset `batch all` last generated", read
from that record; an explicit value still wins. The record travels with the
artifacts: `git checkout -- backend/artifacts data/synthetic` restores it, so a
rollback serves the committed default again without touching the environment.

Deliberately outside the forecast's import chain (forecast_store.FORECAST_ROOT_
MODULES): only the entry points call it, so the code fingerprint — and every
committed artifact's identity — is unaffected.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

#: Same name as app.ingestion.generator.DATA_END_DATE_ENV (asserted in a test).
ENV = "NAKSHATRA_DATA_END_DATE"

#: Written by `python -m app.api.batch all` (app.ingestion.export).
RECORD = Path(__file__).resolve().parents[3] / "data" / "synthetic" / "_dataset_identity.json"


def recorded_end_date() -> str | None:
    """The end date the last `batch all` generated for, or None if unrecorded."""
    try:
        return json.loads(RECORD.read_text())["artifact_identity"]["data_end_date"]
    except (OSError, KeyError, TypeError, ValueError):
        return None


def adopt_recorded_end_date() -> tuple[str | None, str]:
    """
    Make an unset `NAKSHATRA_DATA_END_DATE` mean the recorded dataset.

    Returns (end date now in force or None for the committed default, where it
    came from) so the caller can say so in its log.
    """
    explicit = os.environ.get(ENV, "").strip()
    if explicit:
        return explicit, f"{ENV} (set explicitly)"
    recorded = recorded_end_date()
    if recorded is None:
        return None, "committed default (no dataset record found)"
    os.environ[ENV] = recorded
    return recorded, f"recorded by `batch all` in {RECORD.relative_to(RECORD.parents[2])}"
