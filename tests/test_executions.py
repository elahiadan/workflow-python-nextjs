"""Execution: success, condition stop, multi-step, retry exhaustion, history APIs."""
from tests.conftest import TestingSession
from app.db import models


def _wf(client, headers, steps, trigger=None):
    r = client.post("/api/v1/workflows", headers=headers, json={
        "name": "E2E", "trigger": trigger or {"type": "webhook", "config": {}},
        "steps": steps})
    assert r.status_code == 201, r.text
    wid = r.json()["id"]
    client.post(f"/api/v1/workflows/{wid}/activate", headers=headers)
    return r.json()


def _token(client, headers, wid):
    r = client.get("/api/v1/webhooks", headers=headers)
    for w in r.json():
        if w["workflow_id"] == wid:
            return w["token"]
    raise AssertionError("no webhook token")


def test_successful_execution_and_history(client, auth_headers):
    wf = _wf(client, auth_headers, [
        {"type": "condition", "config": {"field": "order.amount", "operator": ">",
                                         "value": 5000}},
        {"type": "action", "action": "send_email",
         "config": {"to": "admin@example.com", "subject": "big", "body": "hi"}},
        {"type": "action", "action": "send_slack_message",
         "config": {"webhook_url": "mock://slack/test", "text": "new order"}},
    ])
    token = _token(client, auth_headers, wf["id"])
    r = client.post(f"/api/v1/webhooks/{token}",
                    json={"order": {"amount": 6000}}, headers={"X-Event-Id": "evt-1"})
    assert r.status_code == 202, r.text
    eid = r.json()["execution_id"]

    r = client.get(f"/api/v1/executions/{eid}", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "success"
    assert len(body["step_executions"]) == 3
    assert all(s["status"] in ("success", "skipped") for s in body["step_executions"])
    assert len(body["logs"]) >= 4
    assert body["trigger_payload"]["order"]["amount"] == 6000

    r = client.get(f"/api/v1/workflows/{wf['id']}/executions", headers=auth_headers)
    assert len(r.json()) == 1
    r = client.get("/api/v1/executions", headers=auth_headers)
    assert len(r.json()) == 1


def test_condition_failure_stops_workflow(client, auth_headers):
    wf = _wf(client, auth_headers, [
        {"type": "condition", "config": {"field": "order.amount", "operator": ">",
                                         "value": 5000}},
        {"type": "action", "action": "send_email",
         "config": {"to": "admin@example.com", "subject": "big"}},
    ])
    token = _token(client, auth_headers, wf["id"])
    r = client.post(f"/api/v1/webhooks/{token}", json={"order": {"amount": 10}})
    eid = r.json()["execution_id"]
    body = client.get(f"/api/v1/executions/{eid}", headers=auth_headers).json()
    assert body["status"] == "success"  # stopped cleanly, no failure
    statuses = [s["status"] for s in body["step_executions"]]
    assert statuses[0] == "skipped"
    assert len(body["step_executions"]) == 1  # second step never ran


def test_retry_exhaustion_marks_failed(client, auth_headers):
    wf = _wf(client, auth_headers, [
        {"type": "action", "action": "send_slack_message",
         "config": {"webhook_url": "mock://fail", "text": "x"},
         "max_attempts": 3, "retry_delay_seconds": 0},
    ])
    token = _token(client, auth_headers, wf["id"])
    r = client.post(f"/api/v1/webhooks/{token}", json={"a": 1})
    eid = r.json()["execution_id"]
    body = client.get(f"/api/v1/executions/{eid}", headers=auth_headers).json()
    assert body["status"] == "failed"
    step = body["step_executions"][0]
    assert step["status"] == "failed"
    assert step["attempt"] == 3
    assert step["error"]
    assert body["error"]


def test_step_records_have_attempt_timing(client, auth_headers):
    wf = _wf(client, auth_headers, [
        {"type": "action", "action": "delay", "config": {"seconds": 0}},
    ])
    token = _token(client, auth_headers, wf["id"])
    eid = client.post(f"/api/v1/webhooks/{token}", json={}).json()["execution_id"]
    step = client.get(f"/api/v1/executions/{eid}", headers=auth_headers).json()["step_executions"][0]
    assert step["attempt"] >= 1 and step["started_at"] and step["completed_at"]
    assert step["duration_ms"] is not None
