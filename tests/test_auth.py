"""Auth: registration, login, invalid credentials, token validation, protected routes."""
from tests.conftest import _register


def test_register_login_me_logout(client):
    data = _register(client)
    assert data["user"]["email"] == "user@example.com"
    token = data["tokens"]["access_token"]

    r = client.post("/api/v1/auth/login",
                    json={"email": "user@example.com", "password": "password123"})
    assert r.status_code == 200, r.text
    access = r.json()["tokens"]["access_token"]
    refresh = r.json()["tokens"]["refresh_token"]

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200 and r.json()["email"] == "user@example.com"

    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200 and "access_token" in r.json()

    r = client.post("/api/v1/auth/logout", json={"refresh_token": refresh},
                    headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200

    # revoked refresh token must fail
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 401


def test_duplicate_registration(client):
    _register(client)
    r = client.post("/api/v1/auth/register",
                    json={"email": "user@example.com", "password": "password123"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "EMAIL_TAKEN"


def test_invalid_credentials(client):
    _register(client)
    r = client.post("/api/v1/auth/login",
                    json={"email": "user@example.com", "password": "wrongpass1"})
    assert r.status_code == 401


def test_protected_route_requires_token(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


def test_error_envelope_shape(client):
    r = client.get("/api/v1/auth/me")
    body = r.json()
    assert body["success"] is False
    assert "message" in body and "error" in body and "code" in body["error"]
