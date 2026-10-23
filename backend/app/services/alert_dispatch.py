"""
Operational alert log.

It said it generated "automated SMS/Email/Radio dispatch orders", and each record
claimed `DISPATCHED_TO_OPERATIONS` over "SMS + Radio + Automated Scada
Interlock". Nothing here sends anything: no SMS gateway, mail server, radio or
SCADA link exists in this system. An alert is recorded in this process's
in-memory log and returned; the record now says exactly that, and the escalation
tier is a suggestion for a person, not an action taken.
"""

from typing import Dict, Any, List
from datetime import datetime


ALERT_LOGS: List[Dict[str, Any]] = []


def dispatch_operational_alert(
    mine_id: int,
    mine_name: str,
    alert_type: str,
    severity: str,
    trigger_metric: str,
    action_directive: str,
    recipient_role: str = "Mine Manager & Pit Superintendent",
) -> Dict[str, Any]:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
    alert_id = f"ALT-MOIL-{mine_id}-{int(datetime.now().timestamp())}"

    # A suggested escalation for whoever reads the log. Nothing is routed.
    escalation_tier = "Tier-1 (Immediate Pit Shift Action)" if severity == "CRITICAL" else "Tier-2 (Daily Plan Adjustment)"

    alert_record = {
        "alert_id": alert_id,
        "mine_id": mine_id,
        "mine_name": mine_name,
        "alert_type": alert_type,
        "severity": severity,
        "trigger_metric": trigger_metric,
        "action_directive": action_directive,
        "recipient_role": recipient_role,
        "escalation_tier": escalation_tier,
        "dispatch_channel": "none: recorded in this service's in-memory log only",
        "dispatch_timestamp": timestamp,
        "acknowledgement_status": "RECORDED_ONLY",
    }

    ALERT_LOGS.insert(0, alert_record)
    if len(ALERT_LOGS) > 100:
        ALERT_LOGS.pop()

    return {
        "success": True,
        "dispatched_alert": alert_record,
        "active_alert_count": len(ALERT_LOGS),
    }


def get_active_dispatched_alerts(mine_id: int = None) -> List[Dict[str, Any]]:
    if mine_id is None:
        return ALERT_LOGS
    return [a for a in ALERT_LOGS if a["mine_id"] == mine_id]
