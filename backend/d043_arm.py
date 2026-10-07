"""
pytest plugin: run the forecaster's suites under one D-043 ablation arm.

    NAKSHATRA_FORECASTER_ARM=crossing python -m pytest -p d043_arm test_track_b.py

DECISIONS.md D-043 amendment 2 judges every arm by the same suites. The arm is
chosen by the forecaster's constructor switches (`rearrange`, `day_blocks`);
this changes their defaults for the session, not the code, so the suites run
exactly what that arm runs. Loaded only by name; never by default.
"""
from __future__ import annotations

import os

import pytest

ARMS = {
    "both": {"rearrange": True, "day_blocks": True},
    "crossing": {"rearrange": True, "day_blocks": False},
    "blocks": {"rearrange": False, "day_blocks": True},
    "none": {"rearrange": False, "day_blocks": False},
}


def pytest_configure(config):
    arm = os.environ.get("NAKSHATRA_FORECASTER_ARM", "")
    if arm not in ARMS:
        raise pytest.UsageError(f"NAKSHATRA_FORECASTER_ARM must be one of {sorted(ARMS)}, got {arm!r}")
    from app.ml import forecaster

    defaults = ARMS[arm]
    original = forecaster.ProductionForecaster.__init__

    def __init__(self, *args, **kwargs):
        for key, value in defaults.items():
            kwargs.setdefault(key, value)
        original(self, *args, **kwargs)

    forecaster.ProductionForecaster.__init__ = __init__
    config._d043_arm = arm


def pytest_report_header(config):
    arm = getattr(config, "_d043_arm", None)
    return f"D-043 forecaster arm: {arm} {ARMS.get(arm)}" if arm else None
