"""
Provenance envelope — Python side.

Mirrors `frontend/src/lib/provenance.ts` field-for-field so the same contract
holds whether a number is produced by FastAPI or by a Next.js route handler.
PRD N-3: every displayed number carries model version, input vintage and
uncertainty.

Integrity rule (same as the TS module): `is_live` and `is_synthetic` are
*computed* from `source_kind`, never passed in, so a caller cannot label
synthetic data as live.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from typing import Any, Literal, Optional

SourceKind = Literal["measured", "derived", "synthetic", "reference"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Uncertainty:
    plus_minus: float
    confidence: float
    basis: str

    def to_dict(self) -> dict:
        return asdict(self)


def envelope(
    value: Any,
    unit: str,
    source: str,
    source_kind: SourceKind,
    vintage: Optional[str] = None,
    model_version: Optional[str] = None,
    uncertainty: Optional[Uncertainty] = None,
    method: Optional[str] = None,
) -> dict:
    """Build a provenance envelope. See the TS module for the field contract."""
    if source_kind not in ("measured", "derived", "synthetic", "reference"):
        raise ValueError(f"Unknown source_kind: {source_kind}")
    out = {
        "value": value,
        "unit": unit,
        "source": source,
        "source_kind": source_kind,
        "vintage": vintage or _now_iso(),
        "model_version": model_version,
        "uncertainty": uncertainty.to_dict() if uncertainty else None,
        # Computed, never supplied.
        "is_synthetic": source_kind == "synthetic",
        "is_live": source_kind == "measured",
    }
    if method:
        out["method"] = method
    return out


def measured(value, unit, source, **kw) -> dict:
    return envelope(value, unit, source, "measured", **kw)


def derived(value, unit, source, **kw) -> dict:
    return envelope(value, unit, source, "derived", **kw)


def synthetic(value, unit, source, **kw) -> dict:
    return envelope(value, unit, source, "synthetic", **kw)


def reference(value, unit, source, **kw) -> dict:
    return envelope(value, unit, source, "reference", **kw)


def data_integrity(
    contains_synthetic: bool,
    live_ok: bool,
    degraded_reason: Optional[str] = None,
    staleness_seconds: Optional[float] = None,
) -> dict:
    """
    Dataset-level banner. PRD N-6: degrade gracefully and state staleness —
    never silently extrapolate.
    """
    if not live_ok:
        notice = (
            "DEGRADED — live upstream unavailable. Displayed values are synthetic "
            "and must not be read as observations."
        )
    elif contains_synthetic:
        notice = (
            "MIXED — weather is measured live; operational figures are synthetic "
            "(MOIL operational data is proprietary) and are labelled per field."
        )
    else:
        notice = "All displayed values are measured or derived from measured inputs."
    return {
        "contains_synthetic": contains_synthetic,
        "live_sources_ok": live_ok,
        "degraded_reason": degraded_reason,
        "staleness_seconds": staleness_seconds,
        "notice": notice,
    }
