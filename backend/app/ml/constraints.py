"""
Hard constraint engine (PRD C-5 [D] P0).

PRD §6.3 marks this load-bearing, in as many words:

    "**C-5 is load-bearing.** A recommender that suggests blasting during a
     statutory rest period, or moving a shovel between mines 200 km apart
     overnight, discredits the whole system in one demo. Constraints must be
     explicit and enforced, not learned and hoped for."

Both of those exact failures are checked below.

Design
------
Constraints are **enforced, never learned**. Each is a named, inspectable rule
that returns a verdict with a reason. The recommender cannot bypass the engine:
`gate()` filters a candidate list and an action that fails is dropped, not
downgraded. Every surviving action carries the list of checks it passed, so a
planner can see what was verified rather than trusting a score.

Scope
-----
Shifts, blasting windows, equipment compatibility and relocation feasibility.

**Ventilation is deliberately excluded.** The architecture diagram lists it, but
PRD §4 non-goal 6 makes "mine safety and ventilation management" an explicit
non-goal, and the PRD wins. Recorded in docs/DECISIONS.md (D-008).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from enum import Enum
from typing import Iterable, Sequence

ENGINE_VERSION = "nakshatra-constraint-engine-v1"


class ActionType(str, Enum):
    RESCHEDULE_SHIFT = "reschedule_shift"      # PRD C-1
    BLAST_RESCHEDULE = "blast_reschedule"      # PRD C-2
    EQUIPMENT_RELOCATION = "equipment_relocation"  # PRD C-3
    MAINTENANCE = "maintenance"
    DRAINAGE = "drainage"
    NONE = "none"


# --- operating rules -------------------------------------------------------
# Plausible operating rules for an Indian manganese mine. They are stated here
# as explicit constants so a MOIL planner can correct them in one place; they
# are assumptions, not regulation quoted verbatim.

#: Statutory rest / no-blast window (night). Blasting is confined to daylight
#: shift boundaries in practice.
BLAST_WINDOW_START = time(6, 0)
BLAST_WINDOW_END = time(18, 0)

#: Underground blasting is conventionally done between shifts, when the face is
#: clear of personnel.
UNDERGROUND_BLAST_WINDOWS = ((time(6, 0), time(7, 0)), (time(14, 0), time(15, 0)))

#: Minimum hours between consecutive blasts at the same face.
MIN_HOURS_BETWEEN_BLASTS = 8.0

#: Road speed for heavy-equipment transport (km/h), plus fixed load/unload time.
HEMM_TRANSPORT_KMH = 25.0
HEMM_LOAD_UNLOAD_HOURS = 6.0

#: Equipment that cannot be used underground.
OPENCAST_ONLY_EQUIPMENT = {"dragline", "large_shovel", "haul_truck_100t"}
UNDERGROUND_ONLY_EQUIPMENT = {"lhd", "jumbo_drill", "low_profile_dumper"}

#: Maximum consecutive operating hours before a mandatory maintenance stop.
MAX_CONTINUOUS_OPERATING_HOURS = 20.0


@dataclass
class MineContext:
    mine_code: str
    mine_type: str             # "underground" | "opencast"
    latitude: float
    longitude: float


@dataclass
class ProposedAction:
    """A candidate corrective action, before any constraint has been applied."""
    id: str
    action_type: ActionType
    mine_code: str
    description: str
    #: For blast rescheduling.
    proposed_at: datetime | None = None
    last_blast_at: datetime | None = None
    #: For equipment relocation.
    equipment_id: str | None = None
    equipment_class: str | None = None
    from_mine: str | None = None
    to_mine: str | None = None
    available_hours: float | None = None
    #: For shift changes.
    additional_hours: float | None = None
    expected_recovery_tonnes: float = 0.0


@dataclass
class Violation:
    rule: str
    detail: str


@dataclass
class Verdict:
    feasible: bool
    checks_passed: list[str] = field(default_factory=list)
    violations: list[Violation] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "feasible": self.feasible,
            "checks_passed": self.checks_passed,
            "violations": [{"rule": v.rule, "detail": v.detail} for v in self.violations],
            "engine_version": ENGINE_VERSION,
        }


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Great-circle distance in km.

    PRD §8.4 forbids computing distances in degrees. This is a proper spherical
    distance, not `degrees x 111`.
    """
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class ConstraintEngine:
    """Evaluates proposed actions against hard operating rules."""

    def __init__(self, mines: dict[str, MineContext]):
        self.mines = mines

    # -- individual rules ---------------------------------------------------

    def _check_blast_window(self, a: ProposedAction, v: Verdict) -> None:
        if a.proposed_at is None:
            v.violations.append(Violation("blast_window", "No proposed time supplied for a blast action."))
            return
        mine = self.mines.get(a.mine_code)
        t = a.proposed_at.time()

        if mine and mine.mine_type == "underground":
            ok = any(start <= t <= end for start, end in UNDERGROUND_BLAST_WINDOWS)
            if not ok:
                windows = ", ".join(f"{s.strftime('%H:%M')}-{e.strftime('%H:%M')}" for s, e in UNDERGROUND_BLAST_WINDOWS)
                v.violations.append(Violation(
                    "blast_window",
                    f"Proposed {t.strftime('%H:%M')} is outside the underground inter-shift blasting windows ({windows}).",
                ))
                return
        else:
            if not (BLAST_WINDOW_START <= t <= BLAST_WINDOW_END):
                v.violations.append(Violation(
                    "blast_window",
                    f"Proposed {t.strftime('%H:%M')} falls in the statutory night rest period "
                    f"(blasting permitted {BLAST_WINDOW_START.strftime('%H:%M')}-{BLAST_WINDOW_END.strftime('%H:%M')}).",
                ))
                return
        v.checks_passed.append("blast_window")

    def _check_blast_separation(self, a: ProposedAction, v: Verdict) -> None:
        if a.proposed_at is None or a.last_blast_at is None:
            v.checks_passed.append("blast_separation (no prior blast on record)")
            return
        gap = (a.proposed_at - a.last_blast_at).total_seconds() / 3600.0
        if gap < MIN_HOURS_BETWEEN_BLASTS:
            v.violations.append(Violation(
                "blast_separation",
                f"Only {gap:.1f} h since the previous blast; minimum separation is {MIN_HOURS_BETWEEN_BLASTS:.0f} h.",
            ))
            return
        v.checks_passed.append("blast_separation")

    def _check_equipment_compatibility(self, a: ProposedAction, v: Verdict) -> None:
        if not a.equipment_class:
            v.checks_passed.append("equipment_compatibility (no class specified)")
            return
        dest = self.mines.get(a.to_mine or a.mine_code)
        if not dest:
            v.violations.append(Violation("equipment_compatibility", f"Unknown destination mine '{a.to_mine or a.mine_code}'."))
            return
        cls = a.equipment_class.lower()
        if dest.mine_type == "underground" and cls in OPENCAST_ONLY_EQUIPMENT:
            v.violations.append(Violation(
                "equipment_compatibility",
                f"'{a.equipment_class}' is surface equipment and cannot be deployed underground at {dest.mine_code}.",
            ))
            return
        if dest.mine_type == "opencast" and cls in UNDERGROUND_ONLY_EQUIPMENT:
            v.violations.append(Violation(
                "equipment_compatibility",
                f"'{a.equipment_class}' is underground equipment and is not suited to the opencast face at {dest.mine_code}.",
            ))
            return
        v.checks_passed.append("equipment_compatibility")

    def _check_relocation_feasibility(self, a: ProposedAction, v: Verdict) -> None:
        if not (a.from_mine and a.to_mine):
            v.checks_passed.append("relocation_feasibility (not a relocation)")
            return
        src, dst = self.mines.get(a.from_mine), self.mines.get(a.to_mine)
        if not src or not dst:
            v.violations.append(Violation("relocation_feasibility", "Unknown source or destination mine."))
            return
        km = haversine_km(src.latitude, src.longitude, dst.latitude, dst.longitude)
        hours = km / HEMM_TRANSPORT_KMH + HEMM_LOAD_UNLOAD_HOURS
        if a.available_hours is not None and hours > a.available_hours:
            v.violations.append(Violation(
                "relocation_feasibility",
                f"Moving {a.equipment_id or 'the unit'} from {a.from_mine} to {a.to_mine} covers {km:.0f} km "
                f"and needs about {hours:.1f} h including load/unload, but only {a.available_hours:.1f} h are available.",
            ))
            return
        v.checks_passed.append(f"relocation_feasibility ({km:.0f} km, ~{hours:.1f} h)")

    def _check_shift_hours(self, a: ProposedAction, v: Verdict) -> None:
        if a.additional_hours is None:
            v.checks_passed.append("shift_hours (no shift extension proposed)")
            return
        if a.additional_hours <= 0:
            v.violations.append(Violation("shift_hours", "Shift extension must be positive."))
            return
        if a.additional_hours > MAX_CONTINUOUS_OPERATING_HOURS:
            v.violations.append(Violation(
                "shift_hours",
                f"Extending by {a.additional_hours:.1f} h exceeds the {MAX_CONTINUOUS_OPERATING_HOURS:.0f} h "
                "continuous-operating limit before a mandatory maintenance stop.",
            ))
            return
        v.checks_passed.append("shift_hours")

    # -- public API ---------------------------------------------------------

    def check(self, action: ProposedAction) -> Verdict:
        """Evaluate one action. Feasible only if no rule is violated."""
        v = Verdict(feasible=True)

        if action.action_type == ActionType.BLAST_RESCHEDULE:
            self._check_blast_window(action, v)
            self._check_blast_separation(action, v)
        if action.action_type == ActionType.EQUIPMENT_RELOCATION:
            self._check_equipment_compatibility(action, v)
            self._check_relocation_feasibility(action, v)
        if action.action_type == ActionType.RESCHEDULE_SHIFT:
            self._check_shift_hours(action, v)

        v.feasible = not v.violations
        return v

    def gate(self, actions: Iterable[ProposedAction]) -> tuple[list[dict], list[dict]]:
        """
        Filter candidates. Returns (approved, rejected).

        An action that violates a constraint is **removed**, not downgraded and
        not shown with a warning: PRD C-5 requires that the recommender never
        propose the physically impossible. Rejections are returned separately
        so the reasoning stays auditable.
        """
        approved: list[dict] = []
        rejected: list[dict] = []
        for a in actions:
            v = self.check(a)
            payload = {
                "id": a.id,
                "action_type": a.action_type.value,
                "mine_code": a.mine_code,
                "description": a.description,
                "expected_recovery_tonnes": round(a.expected_recovery_tonnes, 1),
                "constraint_check": v.to_dict(),
            }
            (approved if v.feasible else rejected).append(payload)
        return approved, rejected
