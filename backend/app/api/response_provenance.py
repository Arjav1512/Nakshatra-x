"""
Provenance for a whole response, or a whole part of one.

`app.core.provenance.envelope()` wraps one value. Most model outputs here are
many numbers from one source — a forecast's trajectory, a backtest's metrics, a
grid of scores — and wrapping each number would change every consumer for no
gain in meaning. A *scope header* says it once: an object whose `provenance`
key holds one of these declares where every number in that object comes from.

The fields and the integrity rule are the envelope's: `is_live` and
`is_synthetic` are computed from `source_kind`, never passed in, so a header
cannot label synthetic numbers as live. What the API guard accepts as covered
is in backend/test_api_provenance.py.

Deliberately outside the forecast code fingerprint (app/api/forecast_store.py
lists what is in it): adding a header to a response changes no artifact.
"""
from __future__ import annotations

from typing import Optional

from app.core.provenance import SourceKind

KINDS = ("measured", "derived", "synthetic", "reference")


def header(
    source: str,
    source_kind: SourceKind,
    model_version: Optional[str] = None,
    vintage: Optional[str] = None,
    method: Optional[str] = None,
) -> dict:
    """The provenance of every number in the object this is attached to."""
    if source_kind not in KINDS:
        raise ValueError(f"Unknown source_kind: {source_kind}")
    if not source:
        raise ValueError("a provenance header needs a source")
    out = {
        "source": source,
        "source_kind": source_kind,
        "model_version": model_version,
        # Only when known: a vintage defaulted to "now" would date a register
        # or a model run to the moment it was served.
        "vintage": vintage,
        "is_synthetic": source_kind == "synthetic",
        "is_live": source_kind == "measured",
    }
    if method:
        out["method"] = method
    return out
