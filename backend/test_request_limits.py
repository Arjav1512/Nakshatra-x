"""
Bounds on what one anonymous request can cost, and on what it can claim.

Each test pins a finding from the critical/high sweep (docs/bug-reports/
2026-10-21-critical-high-sweep.md):

- BE-1  a forecast horizon other than the committed 14 days fitted on
        request and wrote a file into the committed artifact set;
- BE-2  `backtest?compute=true` refitted inside the request for anyone;
- BE-3  alert fields of any size, and a record claiming an SMS / radio /
        SCADA dispatch that never happened;
- BE-4  the CSV upload read the whole body before checking its size, and
        said it had ingested rows it threw away;
- live `prospectivity/predict` reads were unbounded in concurrency.
"""
from __future__ import annotations


import pytest
from fastapi.testclient import TestClient

from app.api import forecast_store as fs
from app.core.config import settings
from app.main import app


@pytest.fixture(scope="module")
def client():
    # One app start for the module: the lifespan (startup warmer, tile
    # registration) is most of a test's cost.
    with TestClient(app) as c:
        yield c


# ---- request body cap ------------------------------------------------------

def test_declared_oversized_body_is_refused_before_reading(client):
    big = b"x" * (settings.max_request_body_bytes + 1)
    res = client.post(
        "/api/v1/dispatch-operational-alert",
        content=big,
        headers={"content-type": "application/json"},
    )
    assert res.status_code == 413, res.text


# ---- BE-3: alerts ----------------------------------------------------------

_ALERT = {"mine_id": 1, "mine_name": "Balaghat", "alert_type": "test",
          "severity": "CRITICAL", "trigger_metric": "m", "action_directive": "d"}


def test_alert_fields_are_bounded(client):
    for field in ("mine_name", "alert_type", "trigger_metric", "action_directive"):
        res = client.post("/api/v1/dispatch-operational-alert",
                          json={**_ALERT, field: "A" * 5000})
        assert res.status_code == 422, (field, res.status_code)


def test_alert_severity_is_an_enum(client):
    res = client.post("/api/v1/dispatch-operational-alert",
                      json={**_ALERT, "severity": "APOCALYPTIC"})
    assert res.status_code == 422


def test_alert_record_claims_no_dispatch(client):
    res = client.post("/api/v1/dispatch-operational-alert", json=_ALERT)
    assert res.status_code == 200
    rec = res.json()["dispatched_alert"]
    assert rec["acknowledgement_status"] == "RECORDED_ONLY"
    text = repr(rec).lower()
    for claim in ("sms", "radio", "scada", "dispatched_to_operations"):
        assert claim not in text, claim


# ---- BE-4: CSV upload ------------------------------------------------------

def test_upload_is_truthful_about_storing_nothing(client):
    res = client.post("/api/v1/upload-operational-csv",
                      files={"file": ("ops.csv", b"date,tonnes\n2026-10-01,120\n", "text/csv")})
    assert res.status_code == 200
    body = res.json()
    assert body["rows_processed"] == 1
    assert body["stored"] is False
    assert "ingested" not in body["message"].lower()


def test_upload_row_count_is_capped(client, monkeypatch):
    from app.api import routes
    monkeypatch.setattr(routes, "CSV_MAX_ROWS", 3)
    csv = b"a\n" + b"1\n" * 4
    res = client.post("/api/v1/upload-operational-csv",
                      files={"file": ("ops.csv", csv, "text/csv")})
    assert res.status_code == 400


# ---- BE-2: on-demand backtest ----------------------------------------------

def test_backtest_compute_is_off_by_default(client):
    assert settings.allow_ondemand_backtest is False
    res = client.get("/api/v1/mines/1/backtest?compute=true&span_days=60&step_days=60")
    assert res.status_code == 403, res.text


# ---- BE-1: unserved forecast horizons -----------------------------------------

def test_unserved_horizon_is_refused_before_any_fit(client):
    before = set(fs.FORECAST_DIR.glob("*.json"))
    for path in ("/api/v1/mines/1/forecast?horizon_days=7",
                 "/api/v1/mines/1/recommendations?horizon_days=30"):
        res = client.get(path)
        assert res.status_code == 400, (path, res.status_code)
    for horizon in (7, 30):
        assert fs._key("MOIL-BAL-01", horizon) not in fs._INFLIGHT
    assert set(fs.FORECAST_DIR.glob("*.json")) == before


def test_served_horizon_is_still_served(client):
    res = client.get("/api/v1/mines/1/forecast?horizon_days=14")
    assert res.status_code in (200, 503), res.status_code  # 503 = warming, never 400


# ---- live prospectivity reads ----------------------------------------------

def test_live_reads_are_bounded_and_degrade_honestly():
    from app.ml import prospectivity as pr
    taken = [pr._LIVE_READS.acquire(blocking=False) for _ in range(pr.MAX_LIVE_READS)]
    assert all(taken)
    try:
        res = pr.predict_point(21.8, 80.2, fetch_live=True)
    finally:
        for _ in taken:
            pr._LIVE_READS.release()
    assert res["error"] == "busy"
    assert res["direct_model_score"] is None and res["features"] is None
    assert res["kriged_prospectivity_score"] is not None
