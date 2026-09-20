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
    
    # 3. Environment data for Mine #1 (Balaghat)
    res = client.get("/api/v1/mines/1/environment")
    assert res.status_code == 200, f"Environment check failed: {res.text}"
    print("✓ NASA POWER Weather for Balaghat:", res.json())
    
    # 4. Satellite STAC imagery for Mine #1
    res = client.get("/api/v1/mines/1/satellite")
    assert res.status_code == 200, f"Satellite STAC check failed: {res.text}"
    print("✓ Sentinel-2 STAC Metadata for Balaghat:", res.json()["provider"])
    
    # 5. Risk & Decision-Support Actions for Mine #1
    res = client.get("/api/v1/mines/1/risk?downtime_hours=16.0&blasting_delay_days=1.5&planned_tonnes=18000&available_tonnes=15400")
    assert res.status_code == 200, f"Risk check failed: {res.text}"
    risk_data = res.json()
    print("✓ Risk Score & Level:", risk_data["risk"]["risk_score"], f"({risk_data['risk']['severity']})")
    
    # 6. Real Case 1: Scipy Simplex Ore Blending Optimizer
    blend_payload = {
        "target_tonnes": 5000.0,
        "target_mn_min": 41.0,
        "target_p_max": 0.15,
        "target_sio2_max": 6.5,
        "stockpiles": [
            {"name": "Balaghat High-Grade SP-1", "available_tonnes": 3200.0, "mn_grade_pct": 46.2, "p_pct": 0.11, "sio2_pct": 4.8, "cost_per_tonne_inr": 8200.0},
            {"name": "Dongri Buzurg Med-Grade SP-2", "available_tonnes": 4500.0, "mn_grade_pct": 37.5, "p_pct": 0.16, "sio2_pct": 7.2, "cost_per_tonne_inr": 5400.0},
            {"name": "Ukwa Silico-Mn Grade SP-3", "available_tonnes": 2800.0, "mn_grade_pct": 34.0, "p_pct": 0.14, "sio2_pct": 8.1, "cost_per_tonne_inr": 4100.0},
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
        "required_tonnes": 5000.0,
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
    borehole_payload = {
        "mine_id": 1,
        "boreholes": [
            {"hole_id": "BH-BAL-101", "x": 100.0, "y": 150.0, "depth_from_m": 45.0, "depth_to_m": 82.0, "mn_pct": 44.5, "recovery_pct": 92.0},
            {"hole_id": "BH-BAL-102", "x": 150.0, "y": 200.0, "depth_from_m": 50.0, "depth_to_m": 94.0, "mn_pct": 41.8, "recovery_pct": 89.0},
        ]
    }
    res = client.post("/api/v1/analyze-borehole-drill", json=borehole_payload)
    assert res.status_code == 200, f"Borehole analysis failed: {res.text}"
    borehole_res = res.json()
    print(f"✓ Core Drill Spatial Kriging: {borehole_res['total_estimated_in_situ_tonnes']} Tonnes @ {borehole_res['weighted_avg_mn_pct']}% Mn ({borehole_res['grade_band']})")
    # Guardrail: no statutory reserve class may be emitted.
    assert "unfc_classification" not in borehole_res, "Statutory UNFC class must not be returned"
    assert borehole_res.get("classification_note"), "Grade band must carry its non-statutory note"

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

    # 9. Real Case 4: Ministry Compliance Report Export
    res = client.get("/api/v1/mines/1/export-compliance-report")
    assert res.status_code == 200, f"Compliance report failed: {res.text}"
    report_res = res.json()
    print(f"✓ Ministry Compliance Export: {report_res['report_id']} - {report_res['compliance_status']}")

    print("\nALL 9 API BACKEND & REAL CASE TESTS PASSED SUCCESSFULLY.")

if __name__ == "__main__":
    test_full_pipeline()
