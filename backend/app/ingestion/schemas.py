"""
Versioned ingestion schemas — the published contract MOIL maps real data onto.

PRD §8.2: MOIL's borehole logs, assay databases, HEMM downtime records and
blasting logs are proprietary and not publicly available. The response is not to
pretend otherwise, but to publish the schema:

    "The system must be built against a documented ingestion contract — a
     published schema that MOIL can map its real data onto. The contract is a
     deliverable in its own right."

Seven entities cover PRD A-1 (geological inputs) and B-1..B-3 (production,
equipment, blasting):

    Track A   borehole · assay · lithology
    Track B   production_by_mine_grade_period · equipment_event ·
              blast_record · plan_target

Every row carries `is_synthetic`. Rows produced by the generator set it True and
the UI says so; rows MOIL supplies set it False. The flag is part of the
contract, not a presentation detail — a dataset that cannot say which rows are
real is not usable for a decision a mine manager has to defend.

Versioning: `CONTRACT_VERSION` is bumped on any breaking field change. Every row
carries `contract_version`, so a stored dataset can be read back with the schema
it was written under.
"""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

CONTRACT_VERSION = "1.0.0"

# PRD §8.4: "area and tonnage computations in an equal-area or appropriate UTM
# projection, never in degrees." Central Indian manganese belt sits in UTM 44N.
WORKING_CRS = "EPSG:32644"  # WGS 84 / UTM zone 44N
GEOGRAPHIC_CRS = "EPSG:4326"


class OreGrade(str, Enum):
    """
    MOIL sells ore by grade, and PRD §3 is explicit that a shortfall in one
    grade is not fungible with a surplus in another. Forecasting is therefore
    grade-aware (PRD B-5 [PS] P0, B-9 [D] P1).
    """

    FERRO = "ferro_manganese"        # high grade, Mn >= 44%
    SILICO = "silico_manganese"      # medium grade, 35% <= Mn < 44%
    BLAST_FURNACE = "blast_furnace"  # low / blending grade, Mn < 35%
    DIOXIDE = "dioxide"              # battery-grade MnO2


class MineType(str, Enum):
    UNDERGROUND = "underground"
    OPENCAST = "opencast"


class _Row(BaseModel):
    """Fields every ingested row carries."""

    contract_version: str = Field(
        default=CONTRACT_VERSION,
        description="Schema version this row was written under.",
    )
    is_synthetic: bool = Field(
        description=(
            "True for generator output, False for data supplied by MOIL. "
            "Required — there is no default, so a producer must state it."
        )
    )
    source: str = Field(
        description="Where the row came from, e.g. 'nakshatra-synthetic-v1' or 'MOIL CMMS export 2026-03'."
    )
    ingested_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"use_enum_values": True}


# ---------------------------------------------------------------------------
# Track A — geological inputs (PRD A-1)
# ---------------------------------------------------------------------------

class Borehole(_Row):
    """A drill collar. One row per hole."""

    borehole_id: str = Field(max_length=64)
    mine_code: str = Field(max_length=32, description="e.g. MOIL-BAL-01")
    # Collar position is carried in BOTH systems: geographic for display,
    # projected for any length/area/tonnage arithmetic (PRD §8.4).
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    easting_m: Optional[float] = Field(default=None, description=f"Northing/easting in {WORKING_CRS}.")
    northing_m: Optional[float] = None
    collar_elevation_m: float = Field(ge=-500, le=9000)
    total_depth_m: float = Field(gt=0, le=2000)
    azimuth_deg: Optional[float] = Field(default=None, ge=0, lt=360)
    dip_deg: Optional[float] = Field(default=None, ge=-90, le=90)
    drilled_on: Optional[date] = None

    @field_validator("mine_code")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()


class Assay(_Row):
    """A downhole assay interval. Many rows per borehole."""

    borehole_id: str = Field(max_length=64)
    from_depth_m: float = Field(ge=0, le=2000)
    to_depth_m: float = Field(gt=0, le=2000)
    mn_pct: float = Field(ge=0, le=100)
    fe_pct: Optional[float] = Field(default=None, ge=0, le=100)
    sio2_pct: Optional[float] = Field(default=None, ge=0, le=100)
    p_pct: Optional[float] = Field(default=None, ge=0, le=20)
    al2o3_pct: Optional[float] = Field(default=None, ge=0, le=100)
    recovery_pct: Optional[float] = Field(default=None, ge=0, le=100)
    # PRD §8.4: "Missing-data policy stated per field. Never impute silently."
    assay_method: Optional[str] = Field(default=None, max_length=64)

    @model_validator(mode="after")
    def _interval_ordered(self):
        if self.to_depth_m <= self.from_depth_m:
            raise ValueError("to_depth_m must be greater than from_depth_m")
        return self

    @model_validator(mode="after")
    def _oxides_plausible(self):
        total = sum(
            v for v in (self.mn_pct, self.fe_pct, self.sio2_pct, self.al2o3_pct) if v is not None
        )
        if total > 100.0:
            raise ValueError(f"assay constituents sum to {total:.1f}%, which exceeds 100%")
        return self


class Lithology(_Row):
    """A logged lithological interval."""

    borehole_id: str = Field(max_length=64)
    from_depth_m: float = Field(ge=0, le=2000)
    to_depth_m: float = Field(gt=0, le=2000)
    rock_type: str = Field(max_length=64, description="e.g. gondite, quartzite, mica-schist")
    formation: Optional[str] = Field(
        default=None, max_length=64, description="e.g. Sausar Group / Mansar Formation"
    )
    weathering: Optional[Literal["fresh", "slightly", "moderately", "highly", "completely"]] = None

    @model_validator(mode="after")
    def _interval_ordered(self):
        if self.to_depth_m <= self.from_depth_m:
            raise ValueError("to_depth_m must be greater than from_depth_m")
        return self


# ---------------------------------------------------------------------------
# Track B — production, equipment, blasting (PRD B-1..B-3)
# ---------------------------------------------------------------------------

class ProductionByMineGradePeriod(_Row):
    """
    Production actuals. The grain is (mine, grade, period) — PRD B-1 names all
    three, and grade-awareness is required at P0 by B-5.
    """

    mine_code: str = Field(max_length=32)
    grade: OreGrade
    period_start: date
    period_end: date
    tonnes: float = Field(ge=0, le=1_000_000)
    mine_type: Optional[MineType] = None
    # Recorded so a resampling policy is explicit rather than assumed (PRD §8.4).
    period_grain: Literal["daily", "weekly", "monthly"] = "daily"
    operating_hours: Optional[float] = Field(default=None, ge=0, le=744)

    @model_validator(mode="after")
    def _period_ordered(self):
        if self.period_end < self.period_start:
            raise ValueError("period_end must not precede period_start")
        return self


class EquipmentEvent(_Row):
    """
    HEMM availability and downtime (PRD B-2). One row per event, not a daily
    roll-up, so MTBF/MTTR are derivable.
    """

    mine_code: str = Field(max_length=32)
    equipment_id: str = Field(max_length=64)
    equipment_type: Literal[
        "shovel", "excavator", "dumper", "loader", "drill", "crusher", "conveyor", "pump", "other"
    ]
    event_type: Literal["breakdown", "scheduled_maintenance", "idle", "operating"]
    started_at: datetime
    ended_at: Optional[datetime] = None
    downtime_hours: Optional[float] = Field(default=None, ge=0, le=8760)
    failure_mode: Optional[str] = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def _times_ordered(self):
        if self.ended_at and self.ended_at < self.started_at:
            raise ValueError("ended_at must not precede started_at")
        return self


class BlastRecord(_Row):
    """Blasting schedule, delays and outcome (PRD B-3)."""

    mine_code: str = Field(max_length=32)
    blast_id: str = Field(max_length=64)
    planned_at: datetime
    executed_at: Optional[datetime] = None
    delay_hours: Optional[float] = Field(default=None, ge=0, le=8760)
    bench_or_level: Optional[str] = Field(default=None, max_length=64)
    holes_charged: Optional[int] = Field(default=None, ge=0, le=10000)
    explosive_kg: Optional[float] = Field(default=None, ge=0)
    tonnes_broken: Optional[float] = Field(default=None, ge=0)
    mean_fragmentation_cm: Optional[float] = Field(
        default=None, ge=0, le=500, description="P50 fragment size."
    )
    outcome: Optional[Literal["success", "partial", "misfire", "cancelled"]] = None


class PlanTarget(_Row):
    """
    The planned target a shortfall is measured against (PRD B-6:
    "Compute shortfall risk against the planned target").
    """

    mine_code: str = Field(max_length=32)
    grade: Optional[OreGrade] = Field(
        default=None, description="Null means the target is across all grades."
    )
    period_start: date
    period_end: date
    target_tonnes: float = Field(gt=0, le=10_000_000)
    plan_version: str = Field(default="v1", max_length=32)

    @model_validator(mode="after")
    def _period_ordered(self):
        if self.period_end < self.period_start:
            raise ValueError("period_end must not precede period_start")
        return self


# ---------------------------------------------------------------------------

ENTITIES: dict[str, type[_Row]] = {
    "borehole": Borehole,
    "assay": Assay,
    "lithology": Lithology,
    "production_by_mine_grade_period": ProductionByMineGradePeriod,
    "equipment_event": EquipmentEvent,
    "blast_record": BlastRecord,
    "plan_target": PlanTarget,
}


def json_schema(entity: str) -> dict:
    """JSON Schema for one entity, for MOIL's mapping work and for validators."""
    if entity not in ENTITIES:
        raise KeyError(f"Unknown entity '{entity}'. Known: {sorted(ENTITIES)}")
    return ENTITIES[entity].model_json_schema()


def all_json_schemas() -> dict:
    return {
        "contract_version": CONTRACT_VERSION,
        "working_crs": WORKING_CRS,
        "geographic_crs": GEOGRAPHIC_CRS,
        "entities": {name: json_schema(name) for name in ENTITIES},
    }
