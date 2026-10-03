"""Integrations: CRUD with encrypted secrets, no secret leakage, mocked externals."""
from app.core.crypto import decrypt_dict
from app.db import models


def test_integration_crud_hides_secrets(client, auth_headers, db):
    r = client.post("/api/v1/integrations", headers=auth_headers, json={
        "type": "slack", "name": "team",
        "config": {"webhook_url": "mock://slack/team", "token": "xoxb-super-secret"}})
    assert r.status_code == 201, r.text
    iid = r.json()["id"]
    assert "xoxb-super-secret" not in r.text  # never exposed
    assert r.json()["config_preview"]["token"] == "***REDACTED***"

    # stored encrypted at rest
    row = db.query(models.Integration).filter_by(id=iid).first()
    assert "xoxb-super-secret" not in row.config_encrypted
    assert decrypt_dict(row.config_encrypted)["token"] == "xoxb-super-secret"

    r = client.get(f"/api/v1/integrations/{iid}", headers=auth_headers)
    assert "xoxb-super-secret" not in r.text

    r = client.put(f"/api/v1/integrations/{iid}", headers=auth_headers,
                   json={"config": {"channel": "#alerts"}})
    assert r.json()["config_preview"]["channel"] == "#alerts"

    r = client.delete(f"/api/v1/integrations/{iid}", headers=auth_headers)
    assert r.status_code == 200


def test_mock_actions_run_without_network(client, auth_headers):
    r = client.post("/api/v1/workflows", headers=auth_headers, json={
        "name": "mocked", "trigger": {"type": "webhook", "config": {}},
        "steps": [
            {"type": "action", "action": "send_email",
             "config": {"to": "someone@other.com", "subject": "hi {{order.id}}",
                        "body": "amount {{order.amount}}"}},
            {"type": "action", "action": "http_request",
             "config": {"method": "POST", "url": "mock://api/receiver"}},
        ]})
    wid = r.json()["id"]
    client.post(f"/api/v1/workflows/{wid}/activate", headers=auth_headers)
    token = client.get("/api/v1/webhooks", headers=auth_headers).json()[0]["token"]
    eid = client.post(f"/api/v1/webhooks/{token}",
                      json={"order": {"id": "A1", "amount": 42}}).json()["execution_id"]
    body = client.get(f"/api/v1/executions/{eid}", headers=auth_headers).json()
    assert body["status"] == "success"


def test_ssrf_blocked(client, auth_headers):
    r = client.post("/api/v1/actions/http", headers=auth_headers, json={
        "method": "GET", "url": "http://169.254.169.254/latest/meta-data"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "SSRF_BLOCKED"
    r = client.post("/api/v1/actions/http", headers=auth_headers, json={
        "method": "GET", "url": "ftp://example.com/x"})
    assert r.status_code == 400
