"""
Deterministic synthetic data generator for the ingestion contract.

PRD §8.2: MOIL's operational data is proprietary and no dataset is attached to
the problem statement. Development and demonstration therefore run on
"open surrogates plus synthetic data generated to realistic distributions,
clearly labelled as such". Every row this module emits carries
`is_synthetic=True`.

Determinism: all randomness comes from `numpy.random.default_rng(seed)`. The
same seed reproduces the dataset byte-for-byte (PRD N-4). This is a separate
stream from the live operational generator in `app/core/synthetic.py`, which
must stay bit-compatible with its TypeScript twin; batch generation has no such
constraint and uses PCG64 for speed.

--------------------------------------------------------------------------
WHAT IS CALIBRATED, AND WHAT IS INVENTED
--------------------------------------------------------------------------
Calibrated to public figures: total annual production is anchored to MOIL's
published scale of roughly 1.1-1.3 million tonnes of manganese ore per year
across about ten mines, and Balaghat is the largest producer.

Everything below that level -- the per-mine split, the grade mix, seasonal
amplitudes, equipment failure rates, blast cadence and every coefficient in the
production model -- is **invented to be plausible**. These are not MOIL's
figures and must never be presented as measurements of MOIL's operations.

--------------------------------------------------------------------------
THE PRODUCTION MODEL
--------------------------------------------------------------------------
Production is generated from an explicit data-generating process so that a
forecaster has genuine structure to learn, rather than noise dressed up as a
series:

    tonnes = base(mine, grade)
             x trend(year)
             x seasonality(day-of-year, mine_type)
             x (1 - rain_drag - downtime_drag - blast_drag)
             x lognormal noise

The drag terms are driven by the equipment, blast and weather rows emitted
alongside, so the covariates a model sees are the ones that actually generated
the target. A seasonal-naive baseline can recover trend and seasonality but not
the year-specific weather and equipment shocks; a model given those covariates
can. That is why a gradient-boosting model is expected to beat the baseline
here -- and the margin is a property of this DGP, not evidence about MOIL.
Noise is deliberately large enough that the improvement is modest.

Opencast mines are made markedly more rain-sensitive than underground ones,
per PRD §13 Q5.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Iterator

import numpy as np

from app.ingestion.schemas import (
    CONTRACT_VERSION,
    Assay,
    BlastRecord,
    Borehole,
    EquipmentEvent,
    Lithology,
    MineType,
    OreGrade,
    PlanTarget,
    ProductionByMineGradePeriod,
)

GENERATOR_SOURCE = "nakshatra-synthetic-v1"
DEFAULT_SEED = 20260921

# Public anchor: MOIL produces roughly 1.1-1.3 Mt of manganese ore a year.
ANNUAL_TOTAL_TONNES = 1_200_000.0


@dataclass(frozen=True)
class MineSpec:
    code: str
    name: str
    mine_type: MineType
    latitude: float
    longitude: float
    # Share of the national total. Invented split; sums to 1.0.
    production_share: float
    # Grade mix for this mine. Invented; each sums to 1.0.
    grade_mix: dict


# Balaghat is the largest producer (public knowledge); the rest of the split is
# invented and merely plausible.
MINES: tuple[MineSpec, ...] = (
    MineSpec("MOIL-BAL-01", "Balaghat", MineType.UNDERGROUND, 21.83, 80.19, 0.26,
             {OreGrade.FERRO: 0.30, OreGrade.SILICO: 0.45, OreGrade.BLAST_FURNACE: 0.20, OreGrade.DIOXIDE: 0.05}),
    MineSpec("MOIL-BHR-02", "Bharweli", MineType.UNDERGROUND, 21.86, 80.26, 0.15,
             {OreGrade.FERRO: 0.25, OreGrade.SILICO: 0.48, OreGrade.BLAST_FURNACE: 0.24, OreGrade.DIOXIDE: 0.03}),
    MineSpec("MOIL-UKW-03", "Ukwa", MineType.UNDERGROUND, 21.93, 80.52, 0.08,
             {OreGrade.FERRO: 0.20, OreGrade.SILICO: 0.50, OreGrade.BLAST_FURNACE: 0.30, OreGrade.DIOXIDE: 0.00}),
    MineSpec("MOIL-TIR-04", "Tirodi", MineType.UNDERGROUND, 22.16, 79.68, 0.09,
             {OreGrade.FERRO: 0.18, OreGrade.SILICO: 0.52, OreGrade.BLAST_FURNACE: 0.30, OreGrade.DIOXIDE: 0.00}),
    MineSpec("MOIL-DON-05", "Dongri Buzurg", MineType.OPENCAST, 20.99, 79.34, 0.11,
             {OreGrade.FERRO: 0.12, OreGrade.SILICO: 0.40, OreGrade.BLAST_FURNACE: 0.28, OreGrade.DIOXIDE: 0.20}),
    MineSpec("MOIL-CHK-06", "Chikla", MineType.OPENCAST, 21.30, 79.66, 0.08,
             {OreGrade.FERRO: 0.15, OreGrade.SILICO: 0.45, OreGrade.BLAST_FURNACE: 0.35, OreGrade.DIOXIDE: 0.05}),
    MineSpec("MOIL-MAN-07", "Mansar", MineType.UNDERGROUND, 21.44, 79.25, 0.09,
             {OreGrade.FERRO: 0.22, OreGrade.SILICO: 0.50, OreGrade.BLAST_FURNACE: 0.28, OreGrade.DIOXIDE: 0.00}),
    MineSpec("MOIL-KAN-08", "Kandri", MineType.UNDERGROUND, 21.38, 79.32, 0.05,
             {OreGrade.FERRO: 0.20, OreGrade.SILICO: 0.50, OreGrade.BLAST_FURNACE: 0.30, OreGrade.DIOXIDE: 0.00}),
    MineSpec("MOIL-GUM-09", "Gumgaon", MineType.UNDERGROUND, 21.33, 79.03, 0.06,
             {OreGrade.FERRO: 0.20, OreGrade.SILICO: 0.48, OreGrade.BLAST_FURNACE: 0.32, OreGrade.DIOXIDE: 0.00}),
    MineSpec("MOIL-BEL-10", "Beldongri", MineType.OPENCAST, 21.16, 79.18, 0.03,
             {OreGrade.FERRO: 0.10, OreGrade.SILICO: 0.42, OreGrade.BLAST_FURNACE: 0.48, OreGrade.DIOXIDE: 0.00}),
)

MINES_BY_CODE = {m.code: m for m in MINES}

# --- model coefficients (invented, documented) -----------------------------
TREND_PER_YEAR = 0.018          # ~1.8% annual growth
RAIN_DRAG_UNDERGROUND = 0.0016  # per mm of 7-day antecedent rainfall above threshold
RAIN_DRAG_OPENCAST = 0.0042     # opencast is far more rain-sensitive (PRD §13 Q5)
RAIN_THRESHOLD_MM = 25.0
DOWNTIME_DRAG_PER_HOUR = 0.011
BLAST_DELAY_DRAG_PER_HOUR = 0.004
MAX_TOTAL_DRAG = 0.65
NOISE_SIGMA = 0.085             # lognormal sigma on daily output


def _seasonal_rainfall_mm(rng: np.random.Generator, day: date) -> float:
    """
    Indian monsoon: a pronounced June-September peak. Daily rainfall is drawn
    from a gamma whose mean follows the seasonal cycle, so wet spells cluster.
    """
    doy = day.timetuple().tm_yday
    # Peak around mid-July (doy ~196).
    seasonal = math.exp(-0.5 * ((doy - 196) / 46.0) ** 2)
    mean_mm = 0.4 + 17.0 * seasonal
    shape = 0.65
    return float(rng.gamma(shape, mean_mm / shape))


def _seasonal_production_factor(day: date, mine_type: MineType) -> float:
    """Monsoon suppresses output; opencast more so."""
    doy = day.timetuple().tm_yday
    monsoon = math.exp(-0.5 * ((doy - 196) / 52.0) ** 2)
    amplitude = 0.22 if mine_type == MineType.OPENCAST else 0.09
    return 1.0 - amplitude * monsoon


class SyntheticDataset:
    """A generated dataset. All rows carry `is_synthetic=True`."""

    def __init__(self, seed: int = DEFAULT_SEED, start: date | None = None, end: date | None = None):
        self.seed = seed
        self.end = end or date(2026, 9, 20)
        self.start = start or (self.end - timedelta(days=365 * 3))
        self._rng = np.random.default_rng(seed)

    # -- weather (a covariate, not an entity in the contract) ---------------
    def daily_rainfall(self) -> dict[date, float]:
        """
        Synthetic daily rainfall per calendar day, shared across mines in the
        belt. Real observed weather is fetched live by the NASA POWER and
        Open-Meteo clients; this series exists so the historical record has a
        matching covariate.
        """
        rng = np.random.default_rng(self.seed + 101)
        out: dict[date, float] = {}
        d = self.start
        while d <= self.end:
            out[d] = _seasonal_rainfall_mm(rng, d)
            d += timedelta(days=1)
        return out

    # -- Track B ------------------------------------------------------------
    def equipment_events(self) -> list[EquipmentEvent]:
        rng = np.random.default_rng(self.seed + 202)
        rows: list[EquipmentEvent] = []
        types = ["shovel", "excavator", "dumper", "loader", "drill", "crusher", "conveyor", "pump"]
        for mine in MINES:
            fleet = max(4, int(round(mine.production_share * 60)))
            for unit in range(fleet):
                eq_type = types[int(rng.integers(0, len(types)))]
                eq_id = f"{mine.code}-{eq_type[:3].upper()}-{unit + 1:02d}"
                d = self.start
                while d <= self.end:
                    # Breakdown hazard; higher in the monsoon.
                    doy = d.timetuple().tm_yday
                    monsoon = math.exp(-0.5 * ((doy - 196) / 52.0) ** 2)
                    p = 0.008 + 0.010 * monsoon
                    if rng.random() < p:
                        scheduled = rng.random() < 0.35
                        hours = float(rng.gamma(2.0, 3.5 if scheduled else 6.0))
                        hours = min(hours, 96.0)
                        started = datetime(d.year, d.month, d.day, int(rng.integers(0, 22)))
                        rows.append(
                            EquipmentEvent(
                                is_synthetic=True,
                                source=GENERATOR_SOURCE,
                                mine_code=mine.code,
                                equipment_id=eq_id,
                                equipment_type=eq_type,  # type: ignore[arg-type]
                                event_type="scheduled_maintenance" if scheduled else "breakdown",
                                started_at=started,
                                ended_at=started + timedelta(hours=hours),
                                downtime_hours=round(hours, 2),
                                failure_mode=None if scheduled else _failure_mode(rng, eq_type),
                            )
                        )
                    d += timedelta(days=1)
        return rows

    def blast_records(self) -> list[BlastRecord]:
        rng = np.random.default_rng(self.seed + 303)
        rows: list[BlastRecord] = []
        for mine in MINES:
            per_week = 6 + mine.production_share * 22
            d = self.start
            n = 0
            while d <= self.end:
                if rng.random() < per_week / 7.0:
                    n += 1
                    planned = datetime(d.year, d.month, d.day, 14 if mine.mine_type == MineType.OPENCAST else 6)
                    # Delay is heavier in the monsoon.
                    doy = d.timetuple().tm_yday
                    monsoon = math.exp(-0.5 * ((doy - 196) / 52.0) ** 2)
                    delayed = rng.random() < (0.10 + 0.22 * monsoon)
                    delay_h = float(rng.gamma(1.6, 5.0)) if delayed else 0.0
                    delay_h = min(delay_h, 72.0)
                    cancelled = delay_h > 48.0
                    rows.append(
                        BlastRecord(
                            is_synthetic=True,
                            source=GENERATOR_SOURCE,
                            mine_code=mine.code,
                            blast_id=f"{mine.code}-BL-{n:05d}",
                            planned_at=planned,
                            executed_at=None if cancelled else planned + timedelta(hours=delay_h),
                            delay_hours=round(delay_h, 2),
                            bench_or_level=f"L{int(rng.integers(1, 9))}" if mine.mine_type == MineType.UNDERGROUND else f"B{int(rng.integers(1, 6))}",
                            holes_charged=int(rng.integers(18, 90)),
                            explosive_kg=round(float(rng.gamma(4.0, 90.0)), 1),
                            tonnes_broken=None if cancelled else round(float(rng.gamma(6.0, 260.0)), 1),
                            mean_fragmentation_cm=round(float(rng.gamma(6.0, 3.2)), 1),
                            outcome="cancelled" if cancelled else ("partial" if delay_h > 12 else "success"),
                        )
                    )
                d += timedelta(days=1)
        return rows

    def production(
        self,
        rainfall: dict[date, float] | None = None,
        equipment: list[EquipmentEvent] | None = None,
        blasts: list[BlastRecord] | None = None,
    ) -> list[ProductionByMineGradePeriod]:
        """
        Daily production per mine per grade, generated from the covariates so a
        model that sees them can genuinely outperform one that does not.
        """
        rainfall = rainfall if rainfall is not None else self.daily_rainfall()
        equipment = equipment if equipment is not None else self.equipment_events()
        blasts = blasts if blasts is not None else self.blast_records()

        downtime_by_mine_day = _daily_downtime(equipment)
        delay_by_mine_day = _daily_blast_delay(blasts)
        rain7 = _rolling_7d(rainfall)

        rng = np.random.default_rng(self.seed + 404)
        rows: list[ProductionByMineGradePeriod] = []
        base_year = self.start.year

        for mine in MINES:
            annual = ANNUAL_TOTAL_TONNES * mine.production_share
            rain_coef = RAIN_DRAG_OPENCAST if mine.mine_type == MineType.OPENCAST else RAIN_DRAG_UNDERGROUND
            d = self.start
            while d <= self.end:
                trend = 1.0 + TREND_PER_YEAR * ((d.year - base_year) + d.timetuple().tm_yday / 365.0)
                seasonal = _seasonal_production_factor(d, mine.mine_type)

                r7 = rain7.get(d, 0.0)
                rain_drag = rain_coef * max(0.0, r7 - RAIN_THRESHOLD_MM)
                down_drag = DOWNTIME_DRAG_PER_HOUR * downtime_by_mine_day.get((mine.code, d), 0.0)
                blast_drag = BLAST_DELAY_DRAG_PER_HOUR * delay_by_mine_day.get((mine.code, d), 0.0)
                drag = min(MAX_TOTAL_DRAG, rain_drag + down_drag + blast_drag)

                noise = float(rng.lognormal(mean=-0.5 * NOISE_SIGMA**2, sigma=NOISE_SIGMA))
                daily_total = (annual / 365.0) * trend * seasonal * (1.0 - drag) * noise

                for grade, share in mine.grade_mix.items():
                    if share <= 0:
                        continue
                    # Small per-grade jitter so grades are not perfectly collinear.
                    g_noise = float(rng.lognormal(mean=-0.5 * 0.03**2, sigma=0.03))
                    rows.append(
                        ProductionByMineGradePeriod(
                            is_synthetic=True,
                            source=GENERATOR_SOURCE,
                            mine_code=mine.code,
                            grade=grade,
                            period_start=d,
                            period_end=d,
                            period_grain="daily",
                            tonnes=round(max(0.0, daily_total * share * g_noise), 2),
                            mine_type=mine.mine_type,
                            operating_hours=round(float(np.clip(rng.normal(20.0, 2.0), 6.0, 24.0)), 1),
                        )
                    )
                d += timedelta(days=1)
        return rows

    def plan_targets(self, production: list[ProductionByMineGradePeriod] | None = None) -> list[PlanTarget]:
        """
        Monthly plan targets per mine per grade. Targets are set from a smoothed
        expectation, not from the realised actuals, so a plan can genuinely be
        missed -- which is the whole point of B-6.
        """
        rng = np.random.default_rng(self.seed + 505)
        rows: list[PlanTarget] = []
        base_year = self.start.year
        for mine in MINES:
            annual = ANNUAL_TOTAL_TONNES * mine.production_share
            d = date(self.start.year, self.start.month, 1)
            while d <= self.end:
                nxt = date(d.year + (d.month // 12), (d.month % 12) + 1, 1)
                last = nxt - timedelta(days=1)
                days = (last - d).days + 1
                mid = d + timedelta(days=days // 2)
                trend = 1.0 + TREND_PER_YEAR * ((mid.year - base_year) + mid.timetuple().tm_yday / 365.0)
                seasonal = _seasonal_production_factor(mid, mine.mine_type)
                # Plans are set slightly optimistically -- they ignore the drag
                # terms and add a stretch factor.
                stretch = float(rng.normal(1.03, 0.02))
                monthly = (annual / 365.0) * days * trend * seasonal * stretch
                for grade, share in mine.grade_mix.items():
                    if share <= 0:
                        continue
                    rows.append(
                        PlanTarget(
                            is_synthetic=True,
                            source=GENERATOR_SOURCE,
                            mine_code=mine.code,
                            grade=grade,
                            period_start=d,
                            period_end=last,
                            target_tonnes=round(monthly * share, 2),
                            plan_version="v1",
                        )
                    )
                d = nxt
        return rows

    # -- Track A ------------------------------------------------------------
    def boreholes(self, per_mine: int = 12) -> list[Borehole]:
        rng = np.random.default_rng(self.seed + 606)
        rows: list[Borehole] = []
        for mine in MINES:
            for i in range(per_mine):
                # Collars scattered within roughly 2 km of the mine centre.
                dlat = float(rng.normal(0, 0.012))
                dlng = float(rng.normal(0, 0.012))
                rows.append(
                    Borehole(
                        is_synthetic=True,
                        source=GENERATOR_SOURCE,
                        borehole_id=f"{mine.code}-BH-{i + 1:03d}",
                        mine_code=mine.code,
                        latitude=round(mine.latitude + dlat, 6),
                        longitude=round(mine.longitude + dlng, 6),
                        collar_elevation_m=round(float(rng.normal(320, 35)), 1),
                        total_depth_m=round(float(np.clip(rng.gamma(6.0, 28.0), 40, 600)), 1),
                        azimuth_deg=round(float(rng.uniform(0, 360)), 1),
                        dip_deg=round(float(rng.uniform(-90, -45)), 1),
                        drilled_on=self.start + timedelta(days=int(rng.integers(0, (self.end - self.start).days))),
                    )
                )
        return rows

    def assays(self, boreholes: list[Borehole] | None = None) -> list[Assay]:
        rng = np.random.default_rng(self.seed + 707)
        boreholes = boreholes if boreholes is not None else self.boreholes()
        rows: list[Assay] = []
        for bh in boreholes:
            depth = 0.0
            # One mineralised horizon per hole, at a random depth.
            horizon_top = float(rng.uniform(0.25, 0.70)) * bh.total_depth_m
            horizon_thk = float(np.clip(rng.gamma(3.0, 2.2), 1.0, 30.0))
            while depth < bh.total_depth_m:
                length = float(np.clip(rng.gamma(2.0, 1.6), 0.5, 6.0))
                to = min(depth + length, bh.total_depth_m)
                # A final sliver can round to zero length at 2 dp, which the
                # schema rejects (to_depth_m must exceed from_depth_m).
                if round(to, 2) <= round(depth, 2):
                    break
                in_horizon = horizon_top <= depth <= horizon_top + horizon_thk
                if in_horizon:
                    mn = float(np.clip(rng.normal(42.0, 6.0), 8.0, 58.0))
                else:
                    mn = float(np.clip(rng.gamma(1.4, 1.6), 0.05, 14.0))
                fe = float(np.clip(rng.normal(9.0 if in_horizon else 5.0, 2.5), 0.1, 30.0))
                sio2 = float(np.clip(rng.normal(12.0 if in_horizon else 46.0, 6.0), 1.0, 70.0))
                # Keep the constituent sum inside the validator's bound.
                if mn + fe + sio2 > 92.0:
                    sio2 = max(1.0, 92.0 - mn - fe)
                rows.append(
                    Assay(
                        is_synthetic=True,
                        source=GENERATOR_SOURCE,
                        borehole_id=bh.borehole_id,
                        from_depth_m=round(depth, 2),
                        to_depth_m=round(to, 2),
                        mn_pct=round(mn, 2),
                        fe_pct=round(fe, 2),
                        sio2_pct=round(sio2, 2),
                        p_pct=round(float(np.clip(rng.normal(0.12, 0.04), 0.001, 1.5)), 3),
                        recovery_pct=round(float(np.clip(rng.normal(93.0, 5.0), 45.0, 100.0)), 1),
                        assay_method="XRF (synthetic)",
                    )
                )
                depth = to
        return rows

    def lithology(self, boreholes: list[Borehole] | None = None) -> list[Lithology]:
        rng = np.random.default_rng(self.seed + 808)
        boreholes = boreholes if boreholes is not None else self.boreholes()
        # Sausar Group host sequence.
        rocks = ["gondite", "quartzite", "mica-schist", "calc-granulite", "manganese ore", "phyllite"]
        rows: list[Lithology] = []
        for bh in boreholes:
            depth = 0.0
            while depth < bh.total_depth_m:
                length = float(np.clip(rng.gamma(3.0, 6.0), 1.0, 60.0))
                to = min(depth + length, bh.total_depth_m)
                if round(to, 2) <= round(depth, 2):
                    break
                rows.append(
                    Lithology(
                        is_synthetic=True,
                        source=GENERATOR_SOURCE,
                        borehole_id=bh.borehole_id,
                        from_depth_m=round(depth, 2),
                        to_depth_m=round(to, 2),
                        rock_type=rocks[int(rng.integers(0, len(rocks)))],
                        formation="Sausar Group / Mansar Formation",
                        weathering=["fresh", "slightly", "moderately", "highly", "completely"][
                            int(np.clip(rng.poisson(1.0), 0, 4))
                        ],  # type: ignore[arg-type]
                    )
                )
                depth = to
        return rows


def _failure_mode(rng: np.random.Generator, eq_type: str) -> str:
    modes = {
        "shovel": ["hydraulic leak", "track failure", "boom pin wear"],
        "excavator": ["hydraulic leak", "engine overheat", "bucket tooth loss"],
        "dumper": ["tyre failure", "brake wear", "transmission fault"],
        "loader": ["hydraulic leak", "axle fault"],
        "drill": ["rod breakage", "compressor fault", "bit wear"],
        "crusher": ["liner wear", "bearing failure", "jam"],
        "conveyor": ["belt tear", "idler seizure", "misalignment"],
        "pump": ["seal failure", "impeller wear", "motor trip"],
    }.get(eq_type, ["unspecified"])
    return modes[int(rng.integers(0, len(modes)))]


def _daily_downtime(events: list[EquipmentEvent]) -> dict[tuple[str, date], float]:
    out: dict[tuple[str, date], float] = {}
    for e in events:
        key = (e.mine_code, e.started_at.date())
        out[key] = out.get(key, 0.0) + float(e.downtime_hours or 0.0)
    return out


def _daily_blast_delay(blasts: list[BlastRecord]) -> dict[tuple[str, date], float]:
    out: dict[tuple[str, date], float] = {}
    for b in blasts:
        key = (b.mine_code, b.planned_at.date())
        out[key] = out.get(key, 0.0) + float(b.delay_hours or 0.0)
    return out


def _rolling_7d(daily: dict[date, float]) -> dict[date, float]:
    days = sorted(daily)
    out: dict[date, float] = {}
    window: list[float] = []
    for d in days:
        window.append(daily[d])
        if len(window) > 7:
            window.pop(0)
        out[d] = sum(window)
    return out


def generate_all(seed: int = DEFAULT_SEED, start: date | None = None, end: date | None = None) -> dict:
    """Generate every entity in the contract, consistently, from one seed."""
    ds = SyntheticDataset(seed=seed, start=start, end=end)
    rainfall = ds.daily_rainfall()
    equipment = ds.equipment_events()
    blasts = ds.blast_records()
    production = ds.production(rainfall=rainfall, equipment=equipment, blasts=blasts)
    boreholes = ds.boreholes()
    return {
        "contract_version": CONTRACT_VERSION,
        "generator": GENERATOR_SOURCE,
        "seed": seed,
        "window": {"start": ds.start.isoformat(), "end": ds.end.isoformat()},
        "rainfall_mm_by_day": {d.isoformat(): round(v, 2) for d, v in rainfall.items()},
        "borehole": boreholes,
        "assay": ds.assays(boreholes),
        "lithology": ds.lithology(boreholes),
        "production_by_mine_grade_period": production,
        "equipment_event": equipment,
        "blast_record": blasts,
        "plan_target": ds.plan_targets(production),
    }
