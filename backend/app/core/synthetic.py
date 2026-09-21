"""
Deterministic synthetic operational-data generator — Python side.

Mirrors `frontend/src/lib/synthetic.ts` (same mulberry32 PRNG, same FNV-1a seed
hash, same stream naming), so a given mine and operating day yields the same
values whichever runtime produces them. That matters for PRD N-4: same inputs,
same model version, same output — exactly.

PRD §8.2: MOIL's equipment, blasting and production records are proprietary and
not publicly available. Values here are generated, flagged `is_synthetic`, and
never labelled live.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone


def hash_seed(text: str) -> int:
    """FNV-1a, 32-bit. Must match the TS implementation exactly."""
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


class SyntheticStream:
    """mulberry32, seeded from a named stream. Matches the TS generator."""

    def __init__(self, seed_label: str):
        self.seed_label = seed_label
        self._a = hash_seed(seed_label) & 0xFFFFFFFF

    def uniform(self) -> float:
        self._a = (self._a + 0x6D2B79F5) & 0xFFFFFFFF
        t = self._a
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        t &= 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    def between(self, lo: float, hi: float) -> float:
        return lo + self.uniform() * (hi - lo)

    def normal(self, mean: float = 0.0, sd: float = 1.0) -> float:
        u1 = max(self.uniform(), 1e-12)
        u2 = self.uniform()
        z = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
        return mean + z * sd

    def bounded_normal(self, mean: float, sd: float, lo: float, hi: float) -> float:
        return min(hi, max(lo, self.normal(mean, sd)))

    def chance(self, p: float) -> bool:
        return self.uniform() < p


def operating_day(now: datetime | None = None) -> str:
    """Stable UTC day bucket, so values hold steady within an operating day."""
    return (now or datetime.now(timezone.utc)).strftime("%Y-%m-%d")


def mine_stream(mine_id: str, channel: str, day: str | None = None) -> SyntheticStream:
    """Canonical stream label — identical to the TS `mineStream()`."""
    return SyntheticStream(f"nakshatra-x|{mine_id}|{channel}|{day or operating_day()}")


def rnd(value: float, dp: int = 1) -> float:
    f = 10 ** dp
    return round(value * f) / f


# Calibration anchors. Order-of-magnitude figures consistent with MOIL's
# publicly reported scale (~1.1-1.3 Mt of manganese ore a year across ~10
# mines). NOT MOIL's actual operating figures and not presented as such.
SYNTHETIC_CALIBRATION = {
    "note": (
        "Synthetic operational model. Scale anchored to MOIL public annual "
        "production totals; per-mine daily values are generated, not observed."
    ),
    "equipment_availability_pct": {"mean": 82.0, "sd": 6.0, "min": 55.0, "max": 95.0},
    "weekly_downtime_hours": {"mean": 9.0, "sd": 4.0, "min": 0.0, "max": 40.0},
    "blasts_per_week": {"mean": 10.0, "sd": 2.5, "min": 3.0, "max": 18.0},
}
