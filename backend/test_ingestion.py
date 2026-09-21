"""
Ingestion contract and generator tests (PRD Phase 3).

Covers the three claims the contract makes: the schemas validate and reject bad
data, the generator is deterministic given a seed, and every generated row is
flagged synthetic.
"""
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pydantic

from app.ingestion.generator import (
    ANNUAL_TOTAL_TONNES,
    DEFAULT_SEED,
    MINES,
    SyntheticDataset,
    generate_all,
)
from app.ingestion.schemas import (
    CONTRACT_VERSION,
    ENTITIES,
    Assay,
    OreGrade,
    ProductionByMineGradePeriod,
    all_json_schemas,
)

ENTITY_KEYS = [
    "borehole", "assay", "lithology", "production_by_mine_grade_period",
    "equipment_event", "blast_record", "plan_target",
]


def test_all_entities_have_schemas():
    assert set(ENTITIES) == set(ENTITY_KEYS), "entity set drifted from the contract"
    bundle = all_json_schemas()
    assert bundle["contract_version"] == CONTRACT_VERSION
    for name in ENTITY_KEYS:
        schema = bundle["entities"][name]
        assert "properties" in schema and schema["properties"], f"{name} has no properties"
        # is_synthetic is required on every entity — a producer must state it.
        assert "is_synthetic" in schema["required"], f"{name} does not require is_synthetic"
    print(f"✓ {len(ENTITY_KEYS)} entities have JSON Schemas, all requiring is_synthetic")


def test_schemas_reject_invalid_rows():
    """The contract has to actually catch bad data, or it is decoration."""
    # Inverted depth interval.
    try:
        Assay(is_synthetic=True, source="t", borehole_id="B1",
              from_depth_m=10.0, to_depth_m=5.0, mn_pct=40.0)
        raise AssertionError("accepted an inverted depth interval")
    except pydantic.ValidationError:
        pass

    # Constituents summing above 100%.
    try:
        Assay(is_synthetic=True, source="t", borehole_id="B1",
              from_depth_m=0.0, to_depth_m=1.0, mn_pct=60.0, fe_pct=30.0, sio2_pct=30.0)
        raise AssertionError("accepted constituents summing over 100%")
    except pydantic.ValidationError:
        pass

    # Missing is_synthetic.
    try:
        ProductionByMineGradePeriod(source="t", mine_code="X", grade=OreGrade.FERRO,
                                    period_start=date(2026, 1, 1), period_end=date(2026, 1, 1),
                                    tonnes=10.0)
        raise AssertionError("accepted a row without is_synthetic")
    except pydantic.ValidationError:
        pass

    # Period end before start.
    try:
        ProductionByMineGradePeriod(is_synthetic=True, source="t", mine_code="X",
                                    grade=OreGrade.FERRO, period_start=date(2026, 2, 1),
                                    period_end=date(2026, 1, 1), tonnes=10.0)
        raise AssertionError("accepted an inverted period")
    except pydantic.ValidationError:
        pass
    print("✓ Schemas reject inverted intervals, impossible assays, inverted periods, missing is_synthetic")


def test_generator_is_deterministic():
    a = generate_all(seed=DEFAULT_SEED)
    b = generate_all(seed=DEFAULT_SEED)
    for key in ENTITY_KEYS:
        ra = [r.model_dump(mode="json") for r in a[key]]
        rb = [r.model_dump(mode="json") for r in b[key]]
        # ingested_at is a wall-clock stamp, not part of the generated content.
        for rows in (ra, rb):
            for r in rows:
                r.pop("ingested_at", None)
        assert ra == rb, f"{key} not reproducible for the same seed"
    assert a["rainfall_mm_by_day"] == b["rainfall_mm_by_day"]
    print(f"✓ Generator reproducible: {sum(len(a[k]) for k in ENTITY_KEYS):,} rows identical for seed {DEFAULT_SEED}")


def test_different_seeds_differ():
    a = generate_all(seed=DEFAULT_SEED)
    c = generate_all(seed=DEFAULT_SEED + 1)
    pa = [r.tonnes for r in a["production_by_mine_grade_period"][:200]]
    pc = [r.tonnes for r in c["production_by_mine_grade_period"][:200]]
    assert pa != pc, "a different seed produced identical output"
    print("✓ A different seed produces a different dataset")


def test_every_row_is_flagged_synthetic():
    d = generate_all()
    total = 0
    for key in ENTITY_KEYS:
        for row in d[key]:
            assert row.is_synthetic is True, f"{key} row not flagged synthetic"
            assert row.contract_version == CONTRACT_VERSION
            assert row.source, f"{key} row has no source"
            total += 1
    print(f"✓ All {total:,} rows carry is_synthetic=True, a source and a contract version")


def test_production_matches_public_scale():
    """
    Calibration check: annual totals should sit in MOIL's published range of
    roughly 1.1-1.3 Mt/yr. This guards against a coefficient change silently
    moving the dataset off its only real anchor.
    """
    d = generate_all()
    by_year = defaultdict(float)
    days_by_year = defaultdict(set)
    for r in d["production_by_mine_grade_period"]:
        by_year[r.period_start.year] += r.tonnes
        days_by_year[r.period_start.year].add(r.period_start)

    full_years = [y for y, days in days_by_year.items() if len(days) >= 365]
    assert full_years, "no complete year generated"
    for y in full_years:
        total = by_year[y]
        assert 0.9e6 <= total <= 1.45e6, (
            f"{y} total {total:,.0f} t is outside the plausible MOIL range"
        )
    print(f"✓ Annual totals within MOIL's published scale: "
          + ", ".join(f"{y}={by_year[y]:,.0f} t" for y in sorted(full_years)))


def test_production_is_grade_aware():
    """PRD B-5 [PS] P0: forecast production per mine PER GRADE."""
    d = generate_all()
    seen = defaultdict(set)
    for r in d["production_by_mine_grade_period"]:
        seen[r.mine_code].add(r.grade)
    assert len(seen) == len(MINES), "not every mine produced rows"
    for code, grades in seen.items():
        assert len(grades) >= 2, f"{code} is not grade-split"
    print(f"✓ Production is grade-split for all {len(seen)} mines "
          f"(e.g. {sorted(seen['MOIL-BAL-01'])})")


def test_covariates_actually_drive_production():
    """
    The generator's claim is that production depends on rainfall, downtime and
    blast delay. If it did not, a covariate-aware forecaster could not beat a
    seasonal baseline and the Phase 4 comparison would be meaningless.
    """
    ds = SyntheticDataset()
    rainfall = ds.daily_rainfall()
    equip = ds.equipment_events()
    blasts = ds.blast_records()
    base = ds.production(rainfall=rainfall, equipment=equip, blasts=blasts)

    # Same seed, but with the weather shock removed.
    dry = {d: 0.0 for d in rainfall}
    no_rain = ds.production(rainfall=dry, equipment=equip, blasts=blasts)

    wet_total = sum(r.tonnes for r in base)
    dry_total = sum(r.tonnes for r in no_rain)
    assert dry_total > wet_total, "removing rainfall did not increase output — rain is not driving the DGP"
    lift = 100 * (dry_total - wet_total) / wet_total
    print(f"✓ Rainfall genuinely suppresses output: removing it lifts total production by {lift:.1f}%")


if __name__ == "__main__":
    test_all_entities_have_schemas()
    test_schemas_reject_invalid_rows()
    test_generator_is_deterministic()
    test_different_seeds_differ()
    test_every_row_is_flagged_synthetic()
    test_production_matches_public_scale()
    test_production_is_grade_aware()
    test_covariates_actually_drive_production()
    print("\nALL INGESTION CONTRACT TESTS PASSED.")
