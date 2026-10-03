"""Workflow CRUD, activation, ownership isolation."""


def _create(client, headers, name="WF", **kw):
    body = {"name": name, "description": "d", "trigger": {"type": "webhook", "config": {}},
            "steps": kw.get("steps", [])}
    r = client.post("/api/v1/workflows", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_crud_and_activation(client, auth_headers):
    wf = _create(client, auth_headers, "Orders")
    wid = wf["id"]
    assert wf["status"] == "draft"

    r = client.get(f"/api/v1/workflows/{wid}", headers=auth_headers)
    assert r.status_code == 200

    r = client.put(f"/api/v1/workflows/{wid}", json={"name": "Orders v2"},
                   headers=auth_headers)
    assert r.status_code == 200 and r.json()["name"] == "Orders v2"
    assert r.json()["version"] >= 2

    r = client.post(f"/api/v1/workflows/{wid}/activate", headers=auth_headers)
    assert r.json()["status"] == "active"
    r = client.post(f"/api/v1/workflows/{wid}/deactivate", headers=auth_headers)
    assert r.json()["status"] == "inactive"

    r = client.get("/api/v1/workflows", headers=auth_headers)
    assert len(r.json()) >= 1

    r = client.delete(f"/api/v1/workflows/{wid}", headers=auth_headers)
    assert r.status_code == 200
    r = client.get(f"/api/v1/workflows/{wid}", headers=auth_headers)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "WORKFLOW_NOT_FOUND"


def test_ownership_isolation(client, auth_headers, auth_headers2):
    wf = _create(client, auth_headers)
    r = client.get(f"/api/v1/workflows/{wf['id']}", headers=auth_headers2)
    assert r.status_code == 403
    r = client.get("/api/v1/workflows", headers=auth_headers2)
    assert r.json() == []


def test_invalid_step_rejected(client, auth_headers):
    r = client.post("/api/v1/workflows", headers=auth_headers, json={
        "name": "bad", "trigger": {"type": "webhook", "config": {}},
        "steps": [{"type": "condition", "config": {"field": "x", "operator": "EVAL"}}]})
    assert r.status_code == 400
