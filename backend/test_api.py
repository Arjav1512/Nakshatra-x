"""
API pipeline tests.

Split by what they need (backend/conftest.py, THE NETWORK):

- test_full_pipeline: every endpoint that answers from this process. Offline.
- test_upstreams_degrade_honestly_when_unreachable: /environment and /satellite
  with NASA POWER and STAC refused — the path a demo hall with bad wifi takes.
  Offline, and required in CI.
- test_live_upstreams: the same two endpoints against the real services.
  Marked `network`; runs in CI's non-blocking network job.

The two upstream steps used to sit inside test_full_pipeline and assert only
HTTP 200, which the degraded path also returns — so the test could not tell
"NASA POWER answered" from "NASA POWER was down". Each case now asserts what
it is about.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_full_pipeline():
    client = TestClient(app)
    
    # 1. Health check
    res = client.get("/api/v1/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("✓ Health Check:", res.json())
    
    # 2. List mines
    res = client.get("/api/v1/mines")
    assert res.status_code == 200, f"List mines failed: {res.text}"
    mines = res.json()
    assert len(mines) >= 10, f"Expected 10 mines, got {len(mines)}"
    print(f"✓ Seeded Mines: {len(mines)} mines available")
    
    # 3-4. Environment (NASA POWER) and satellite (STAC) need an upstream: see
    # test_upstreams_degrade_honestly_when_unreachable and test_live_upstreams.

    # 5. /mines/{id}/risk was removed: it returned a fixed "last_evaluated"
    #    timestamp and silently defaulted the operational inputs it scored.
    #    test_route_table.py keeps that class of endpoint out.

    # 6. Real Case 1: Scipy Simplex Ore Blending Optimizer
    blend_payload = {
        "target_tonnes": 5000.0,
        "target_mn_min": 41.0,
        "target_p_max": 0.15,
        "target_sio2_max": 6.5,
        "stockpiles": [
            {"name": "Illustrative SP-1", "available_tonnes": 3200.0, "mn_grade_pct": 46.2, "p_pct": 0.11, "sio2_pct": 4.8, "cost_per_tonne_inr": 8200.0},
            {"name": "Illustrative SP-2", "available_tonnes": 4500.0, "mn_grade_pct": 37.5, "p_pct": 0.16, "sio2_pct": 7.2, "cost_per_tonne_inr": 5400.0},
            {"name": "Illustrative SP-3", "available_tonnes": 2800.0, "mn_grade_pct": 34.0, "p_pct": 0.14, "sio2_pct": 8.1, "cost_per_tonne_inr": 4100.0},
        ]
    }
    res = client.post("/api/v1/optimize-blending", json=blend_payload)
    assert res.status_code == 200, f"Blending optimization failed: {res.text}"
    blend_res = res.json()
    assert blend_res["success"] is True
    print(f"✓ Ore Blending Optimizer: Achieved {blend_res['blended_mn_grade_pct']}% Mn @ ₹{blend_res['avg_cost_per_tonne_inr']}/T")

    # 6b. Blending optimiser must report INFEASIBLE honestly.
    #
    # No combination of the stockpiles below can reach 50% Mn — the richest is
    # 46.2%, and a blend cannot exceed its best input. A solver that returns
    # "success" here would be inventing a plan that cannot be executed, which
    # is precisely the failure mode this test exists to catch.
    infeasible_payload = {
        "target_tonnes": 5000.0,
        "target_mn_min": 50.0,          # unreachable
        "target_p_max": 0.15,
        "target_sio2_max": 6.5,
        "stockpiles": [
            {"name": "SP-1", "available_tonnes": 3200.0, "mn_grade_pct": 46.2, "p_pct": 0.11, "sio2_pct": 4.8, "cost_per_tonne_inr": 8200.0},
            {"name": "SP-2", "available_tonnes": 4500.0, "mn_grade_pct": 37.5, "p_pct": 0.16, "sio2_pct": 7.2, "cost_per_tonne_inr": 5400.0},
        ]
    }
    res = client.post("/api/v1/optimize-blending", json=infeasible_payload)
    assert res.status_code == 200, f"Infeasible blend request errored: {res.text}"
    infeasible_res = res.json()
    assert infeasible_res["success"] is False, (
        "Optimiser claimed success for an unsatisfiable spec "
        f"(50% Mn from a 46.2% max input): {infeasible_res}"
    )
    print(f"✓ Blend Infeasibility Honesty: correctly reported infeasible — {infeasible_res.get('message')}")

    # 7. Real Case 2: Core Drill Borehole 3D Spatial Estimation
    #
    # This payload used to omit fe_pct, sio2_pct and density_t_m3 and still
    # receive a full tonnage and grade analysis, because the schema defaulted
    # them to 6.0, 8.0 and 3.8. In-situ tonnage is
    # thickness x area x density x recovery, so the headline number was partly
    # a function of a density nobody measured. The fields are now required, and
    # a complete assay is what a real borehole record carries.
    borehole_payload = {
        "mine_id": 1,
        "boreholes": [
            {"hole_id": "BH-BAL-101", "x": 100.0, "y": 150.0, "depth_from_m": 45.0, "depth_to_m": 82.0,
             "mn_pct": 44.5, "fe_pct": 7.2, "sio2_pct": 5.1, "recovery_pct": 92.0, "density_t_m3": 3.9},
            {"hole_id": "BH-BAL-102", "x": 150.0, "y": 200.0, "depth_from_m": 50.0, "depth_to_m": 94.0,
             "mn_pct": 41.8, "fe_pct": 8.0, "sio2_pct": 5.8, "recovery_pct": 89.0, "density_t_m3": 3.8},
        ]
    }
    res = client.post("/api/v1/analyze-borehole-drill", json=borehole_payload)
    assert res.status_code == 200, f"Borehole analysis failed: {res.text}"
    borehole_res = res.json()
    print(f"✓ Core Drill Spatial Kriging: {borehole_res['total_estimated_in_situ_tonnes']} Tonnes @ {borehole_res['weighted_avg_mn_pct']}% Mn ({borehole_res['grade_band']})")
    # Guardrail: no statutory reserve class may be emitted.
    assert "unfc_classification" not in borehole_res, "Statutory UNFC class must not be returned"
    assert borehole_res.get("classification_note"), "Grade band must carry its non-statutory note"
    # No fabricated confidence: the old response carried
    # geostatistical_confidence_pct = min(96, recovery*0.95 + n_holes*1.5).
    assert "geostatistical_confidence_pct" not in borehole_res, (
        "A confidence with no interval behind it must not be returned"
    )

    # An incomplete assay must be rejected, not inferred.
    incomplete = {
        "mine_id": 1,
        "boreholes": [
            {"hole_id": "BH-BAL-103", "x": 200.0, "y": 180.0, "depth_from_m": 60.0,
             "depth_to_m": 110.0, "mn_pct": 38.6, "recovery_pct": 86.0},
        ],
    }
    res = client.post("/api/v1/analyze-borehole-drill", json=incomplete)
    assert res.status_code == 422, (
        "A borehole missing density and the other assay fields must be rejected, "
        f"not completed from defaults (got {res.status_code}: {res.text[:200]})"
    )
    print("✓ Borehole assay completeness: incomplete assay rejected with 422")

    # An empty request must not fall back to a built-in borehole set.
    res = client.post("/api/v1/analyze-borehole-drill", json={})
    assert res.status_code == 422, (
        "An empty request used to return a full analysis of four invented "
        f"boreholes (got {res.status_code})"
    )
    print("✓ Borehole defaults: empty request rejected with 422")

    # 8. Real Case 3: Operational Alert Dispatcher
    alert_payload = {
        "mine_id": 1,
        "mine_name": "Balaghat",
        "alert_type": "MONSOON_HAUL_ROAD_SLIPPAGE",
        "severity": "CRITICAL",
        "trigger_metric": "14d Rainfall 118mm > 90mm threshold",
        "action_directive": "Reroute dumper trucks to West Highwall Bench",
    }
    res = client.post("/api/v1/dispatch-operational-alert", json=alert_payload)
    assert res.status_code == 200, f"Alert dispatch failed: {res.text}"
    alert_res = res.json()
    print(f"✓ Incident Alert Dispatcher: Alert {alert_res['dispatched_alert']['alert_id']} triggered ({alert_res['dispatched_alert']['escalation_tier']})")

    # 9. /mines/{id}/export-compliance-report was removed: a "Ministry of Steel"
    #    report with a GOI-styled id, a fixed timestamp, figures from invented
    #    constant inputs and an approval status nobody gave. Both endpoints are
    #    asserted absent in test_route_table.py.

    print("\nALL API BACKEND & REAL CASE TESTS PASSED SUCCESSFULLY.")


def test_upstreams_degrade_honestly_when_unreachable(monkeypatch):
    """
    NASA POWER and STAC refused: both endpoints still answer, and say so.

    The upstreams are pointed at the discard port (NAKSHATRA_OFFLINE's sink), so
    this is deterministic whatever the real services are doing.
    """
    from app.core.config import OFFLINE_SINK, settings

    monkeypatch.setattr(settings, "nasa_power_base_url", f"{OFFLINE_SINK}/api")
    monkeypatch.setattr(settings, "stac_base_url", OFFLINE_SINK)
    client = TestClient(app)

    res = client.get("/api/v1/mines/1/environment")
    assert res.status_code == 200, res.text
    env = res.json()
    assert env["is_live"] is False, env
    assert env["is_synthetic"] is True, env
    assert "Not observed data" in env["source"], env
    assert env.get("degraded_reason"), env

    res = client.get("/api/v1/mines/1/satellite")
    assert res.status_code == 200, res.text
    sat = res.json()
    assert sat["is_live"] is False, sat
    assert sat["scene_count"] == 0 and sat["recent_scenes"] == [], sat
    assert sat.get("error"), sat


@pytest.mark.network
def test_live_upstreams():
    """NASA POWER and STAC, for real. Non-blocking in CI: it reports, it does not gate."""
    client = TestClient(app)

    res = client.get("/api/v1/mines/1/environment")
    assert res.status_code == 200, f"Environment check failed: {res.text}"
    env = res.json()
    assert env["is_live"] is True, f"NASA POWER did not answer: {env.get('degraded_reason')}"
    print("✓ NASA POWER Weather for Balaghat:", env)

    res = client.get("/api/v1/mines/1/satellite")
    assert res.status_code == 200, f"Satellite STAC check failed: {res.text}"
    sat = res.json()
    assert sat["is_live"] is True, f"STAC did not answer: {sat.get('error')}"
    print("✓ Sentinel-2 STAC Metadata for Balaghat:", sat["provider"])


if __name__ == "__main__":
    test_full_pipeline()
