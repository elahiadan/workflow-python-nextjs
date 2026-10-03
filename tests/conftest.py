"""Pytest fixtures: isolated SQLite DB, eager execution, TestClient."""
import os

os.environ["CELERY_TASK_ALWAYS_EAGER"] = "true"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only"
os.environ["EMAIL_PROVIDER"] = "mock"  # never hit real SMTP in tests

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.db.database as _dbmod
import app.services.execution.engine as _engmod
import app.workers.tasks as _tasksmod
from app.core.rate_limit import reset_rate_limits
from app.db.database import Base, get_db
from app.main import create_app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                       poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False,
                              expire_on_commit=False)
# Route all non-request sessions (eager execution, scheduler) to the test DB.
_dbmod.SessionLocal = TestingSession


@pytest.fixture(autouse=True)
def _db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    reset_rate_limits()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    s = TestingSession()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def client():
    app = create_app()

    def _override():
        s = TestingSession()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _register(client, email="user@example.com", password="password123"):
    r = client.post("/api/v1/auth/register",
                    json={"email": email, "password": password, "full_name": "Test"})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def auth_headers(client):
    data = _register(client)
    token = data["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers2(client):
    data = _register(client, email="other@example.com")
    return {"Authorization": f"Bearer {data['tokens']['access_token']}"}
