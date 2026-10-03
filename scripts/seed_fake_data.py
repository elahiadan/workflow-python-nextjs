#!/usr/bin/env python3
"""Seed the running stack with demo users, integrations, workflows and executions.

Drives the public HTTP API only -- no direct DB access -- so it doubles as an
end-to-end smoke test of every subsystem (auth, workflow CRUD, webhooks,
idempotency, conditions, retries, integrations).

Usage:
    python scripts/seed_fake_data.py                # seed the default demo user
    python scripts/seed_fake_data.py --base-url http://127.0.0.1:8000
    python scripts/seed_fake_data.py --email admin@admin.com --password Admin@123

Every workflow uses `mock://` action URLs, so no outbound network traffic and no
real Slack/email/SMTP calls are made.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid

import httpx

DEFAULT_BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8000")
DEFAULT_EMAIL = os.environ.get("SEED_EMAIL", "admin@admin.com")
DEFAULT_PASSWORD = os.environ.get("SEED_PASSWORD", "Admin@123")
TERMINAL = {"success", "failed"}


# --------------------------------------------------------------------------- #
# HTTP helper
# --------------------------------------------------------------------------- #
class Api:
    def __init__(self, base_url: str) -> None:
        self.base = base_url.rstrip("/")
        self.http = httpx.Client(timeout=30.0)
        self.token: str | None = None

    def _headers(self, extra: dict | None = None) -> dict:
        h = dict(extra or {})
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def call(self, method: str, path: str, *, json_body: dict | None = None,
             headers: dict | None = None) -> httpx.Response:
        return self.http.request(
            method, f"{self.base}{path}", json=json_body, headers=self._headers(headers)
        )

    def ok(self, method: str, path: str, *, json_body: dict | None = None,
           headers: dict | None = None, expect: int = 200) -> dict:
        r = self.call(method, path, json_body=json_body, headers=headers)
        if r.status_code != expect:
            raise RuntimeError(
                f"{method} {path} -> {r.status_code} (expected {expect})\n{r.text}"
            )
        return r.json() if r.content else {}


# --------------------------------------------------------------------------- #
# Step / workflow blueprints
# --------------------------------------------------------------------------- #
def wf_happy_path() -> dict:
    """Condition passes -> delay -> mock HTTP -> mock Slack. Ends in success."""
    return {
        "name": "01 Order intake (happy path)",
        "description": "Large orders only. Gate on total, then ping CRM + Slack.",
        "trigger": {"type": "webhook", "config": {}},
        "steps": [
            {
                "name": "Only large orders",
                "type": "condition",
                "config": {"field": "order.total", "operator": ">", "value": 1000},
            },
            {
                "name": "Throttle",
                "type": "action",
                "action": "delay",
                "config": {"seconds": 1},
                "max_attempts": 1,
            },
            {
                "name": "Create CRM lead",
                "type": "action",
                "action": "http_request",
                "config": {
                    "method": "POST",
                    "url": "mock://ok",
                    "headers": {"Content-Type": "application/json"},
                    "params": {"source": "workflow"},
                    "body": {
                        "email": "{{order.customer.email}}",
                        "total": "{{order.total}}",
                        "sku": "{{order.items.0.sku}}",
                    },
                    "timeout": 10,
                },
            },
            {
                "name": "Notify #sales",
                "type": "action",
                "action": "send_slack_message",
                "config": {
                    "webhook_url": "mock://ok",
                    "channel": "#sales",
                    "text": "New order {{order.id}} for ${{order.total}}",
                },
            },
        ],
    }


def wf_retry_drill() -> dict:
    """mock://fail raises a retryable error. Expect 3 attempts then execution: failed."""
    return {
        "name": "02 Retry drill (fails on purpose)",
        "description": "mock://fail always raises a retryable error. Shows backoff + attempt log.",
        "trigger": {"type": "webhook", "config": {}},
        "steps": [
            {
                "name": "Always fails",
                "type": "action",
                "action": "http_request",
                "config": {"method": "GET", "url": "mock://fail"},
                "max_attempts": 3,
                "retry_delay_seconds": 1,
            }
        ],
    }


def wf_condition_stop() -> dict:
    """Condition is false for the seeded payload -> step 0 skipped, workflow halted."""
    return {
        "name": "03 Condition gate (stops early)",
        "description": "Same gate as 01, but the seeded order is too small. Step is 'skipped'.",
        "trigger": {"type": "webhook", "config": {}},
        "steps": [
            {
                "name": "Only large orders",
                "type": "condition",
                "config": {"field": "order.total", "operator": ">", "value": 1000},
            },
            {
                "name": "Should never run",
                "type": "action",
                "action": "http_request",
                "config": {"method": "GET", "url": "mock://ok"},
            },
        ],
    }


def wf_email() -> dict:
    """send_email to an @example.com address hits the mock provider."""
    return {
        "name": "04 Email notification (mocked)",
        "description": "Any @example.com recipient short-circuits to the mock mail provider.",
        "trigger": {"type": "webhook", "config": {}},
        "steps": [
            {
                "name": "Receipt email",
                "type": "action",
                "action": "send_email",
                "config": {
                    "to": "{{order.customer.email}}",
                    "subject": "Order {{order.id}} confirmed",
                    "body": "Thanks {{order.customer.name}}! Total: ${{order.total}}",
                },
            }
        ],
    }


def wf_scheduled() -> dict:
    """Cron trigger. Left inactive; celery-beat picks it up within 60s once active."""
    return {
        "name": "05 Nightly digest (scheduled)",
        "description": "Cron '0 3 * * *'. Activate to let celery-beat enqueue it once a day at 03:00 UTC.",
        "trigger": {"type": "schedule", "config": {"cron": "0 3 * * *", "timezone": "UTC"}},
        "steps": [
            {
                "name": "Warm cache",
                "type": "action",
                "action": "http_request",
                "config": {"method": "GET", "url": "mock://ok"},
            }
        ],
    }


def wf_draft() -> dict:
    """Never activated -- demonstrates that webhooks reject non-active workflows."""
    return {
        "name": "06 Draft (inactive by default)",
        "description": "Firing this webhook returns 400 WORKFLOW_NOT_ACTIVE until you activate it.",
        "trigger": {"type": "webhook", "config": {}},
        "steps": [
            {
                "name": "Noop",
                "type": "action",
                "action": "http_request",
                "config": {"method": "GET", "url": "mock://ok"},
            }
        ],
    }


# --------------------------------------------------------------------------- #
# Fake webhook trigger payloads
# --------------------------------------------------------------------------- #
PAYLOAD_BIG_ORDER = {
    "event_id": f"evt_big_{uuid.uuid4().hex[:8]}",
    "order": {
        "id": "ord_88213",
        "total": 2499.5,
        "currency": "USD",
        "customer": {"email": "buyer@example.com", "name": "Grace H"},
        "items": [
            {"sku": "SKU-100", "name": "Widget", "qty": 2, "price": 999.5},
            {"sku": "SKU-200", "name": "Gadget", "qty": 1, "price": 500.5},
        ],
    },
}

PAYLOAD_SMALL_ORDER = {
    "event_id": f"evt_small_{uuid.uuid4().hex[:8]}",
    "order": {
        "id": "ord_90001",
        "total": 10.0,
        "currency": "USD",
        "customer": {"email": "tiny@example.com", "name": "Pat Q"},
        "items": [{"sku": "SKU-300", "name": "Gum", "qty": 1, "price": 10.0}],
    },
}

INTEGRATIONS = [
    {
        "type": "slack",
        "name": "Slack #sales (demo)",
        "config": {
            "webhook_url": "https://hooks.slack.com/services/T00000/B00000/DEMOREALKEY",
            "channel": "#sales",
        },
    },
    {
        "type": "email",
        "name": "Mailtrap sandbox (demo)",
        "config": {
            "smtp_host": "sandbox.smtp.mailtrap.io",
            "smtp_port": 2525,
            "smtp_user": "demo_user",
            "smtp_password": "demo_password",
            "smtp_from": "no-reply@example.com",
        },
    },
    {
        "type": "http",
        "name": "Example CRM (demo)",
        "config": {
            "base_url": "https://crm.example.com",
            "api_key": "sk-demo-0000000000",
            "timeout": 30,
        },
    },
]


# --------------------------------------------------------------------------- #
# Seeding steps
# --------------------------------------------------------------------------- #
def authenticate(api: Api, email: str, password: str) -> dict:
    r = api.call("POST", "/api/v1/auth/register",
                 json_body={"email": email, "password": password, "full_name": "Admin"})
    if r.status_code == 201:
        data = r.json()
        print(f"  registered {email}")
    else:
        if r.json().get("error", {}).get("code") != "EMAIL_TAKEN":
            raise RuntimeError(f"register failed: {r.status_code} {r.text}")
        data = api.ok("POST", "/api/v1/auth/login",
                      json_body={"email": email, "password": password})
        print(f"  {email} already existed -> logged in")
    api.token = data["tokens"]["access_token"]
    return data


def seed_integrations(api: Api) -> list[dict]:
    out = []
    for spec in INTEGRATIONS:
        out.append(api.ok("POST", "/api/v1/integrations", json_body=spec, expect=201))
    return out


def seed_workflow(api: Api, spec: dict, activate: bool) -> dict:
    wf = api.ok("POST", "/api/v1/workflows", json_body=spec, expect=201)
    if activate:
        wf = api.ok("POST", f"/api/v1/workflows/{wf['id']}/activate")
    return wf


def wait_for_execution(api: Api, execution_id: str, timeout: int = 45) -> dict:
    """Poll until the execution reaches a terminal state (Celery runs it async).

    Raises if it stalls, so a dead worker surfaces immediately instead of
    hanging. Check `docker compose logs celery-worker` when this fires.
    """
    deadline = time.monotonic() + timeout
    exc: dict = {}
    while time.monotonic() < deadline:
        exc = api.ok("GET", f"/api/v1/executions/{execution_id}")
        if exc.get("status") in TERMINAL:
            return exc
        time.sleep(0.5)
    raise RuntimeError(
        f"execution {execution_id} stuck in status={exc.get('status')!r} after {timeout}s. "
        "The Celery worker is most likely not consuming the queue -- check "
        "`docker compose logs celery-worker` for 'unregistered task'."
    )


def fire(api: Api, token: str, payload: dict, expect: int = 202) -> dict:
    r = api.call("POST", f"/api/v1/webhooks/{token}",
                 json_body=payload, headers={"X-Event-Id": payload.get("event_id", "")})
    if r.status_code != expect:
        raise RuntimeError(f"webhook {token} -> {r.status_code} (expected {expect})\n{r.text}")
    return r.json()


def demo_idempotency(api: Api, token: str) -> dict:
    payload = {**PAYLOAD_BIG_ORDER, "event_id": f"evt_dup_{uuid.uuid4().hex[:8]}"}
    first = fire(api, token, payload)
    second = fire(api, token, payload)
    return {"first": first, "second": second}


def demo_draft_rejection(api: Api, token: str) -> dict:
    payload = {**PAYLOAD_SMALL_ORDER, "event_id": f"evt_draft_{uuid.uuid4().hex[:8]}"}
    r = api.call("POST", f"/api/v1/webhooks/{token}", json_body=payload)
    return {"status_code": r.status_code, "body": r.json()}


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL)
    ap.add_argument("--email", default=DEFAULT_EMAIL)
    ap.add_argument("--password", default=DEFAULT_PASSWORD)
    args = ap.parse_args()

    api = Api(args.base_url)

    print(f"\n=== Seeding {args.base_url} ===")
    try:
        api.ok("GET", "/health")
    except Exception as e:
        print(f"  ERROR: API not reachable at {args.base_url}\n  {e}")
        print("  Start it first:  docker compose up -d")
        return 1

    print("\n[1/6] Auth")
    auth = authenticate(api, args.email, args.password)

    print("\n[2/6] Integrations")
    integrations = seed_integrations(api)
    for i in integrations:
        print(f"  {i['type']:6} {i['name']:30} preview={json.dumps(i['config_preview'])}")

    print("\n[3/6] Workflows")
    blueprints = [
        (wf_happy_path(), True),
        (wf_retry_drill(), True),
        (wf_condition_stop(), True),
        (wf_email(), True),
        (wf_scheduled(), False),
        (wf_draft(), False),
    ]
    created: dict[str, dict] = {}
    for spec, activate in blueprints:
        wf = seed_workflow(api, spec, activate)
        created[spec["name"][:2]] = wf
        hook = wf["webhooks"][0]["token"] if wf["webhooks"] else None
        print(f"  [{'active ' if activate else 'draft  '}] {wf['name']:42} webhook={hook or '-'}")

    print("\n[4/6] Triggering executions (webhook flows)")
    results = []
    for key, payload, expect_status in [
        ("01", PAYLOAD_BIG_ORDER, "success"),
        ("02", PAYLOAD_BIG_ORDER, "failed"),
        ("03", PAYLOAD_SMALL_ORDER, "success (condition stopped)"),
        ("04", PAYLOAD_BIG_ORDER, "success"),
    ]:
        wf = created[key]
        token = wf["webhooks"][0]["token"]
        res = fire(api, token, payload)
        exc = wait_for_execution(api, res["execution_id"])
        steps = ", ".join(
            f"{s['step_order']}:{s['step_type']}={s['status']}"
            f"{'/skipped' if s['status'] == 'skipped' else ''}"
            for s in exc.get("step_executions", [])
        )
        results.append((wf["name"], exc.get("status"), steps, exc.get("error")))
        print(f"  {wf['name'][:44]:46} -> {exc.get('status'):8} [{steps}]")
        if exc.get("error"):
            print(f"       error: {exc['error']}")

    print("\n[5/6] Behaviour demos")
    dup = demo_idempotency(api, created["01"]["webhooks"][0]["token"])
    print(f"  idempotency  : 1st={dup['first']['execution_id'][:8]} "
          f"(dedup={dup['first']['deduplicated']}) | "
          f"2nd={dup['second']['execution_id'][:8]} "
          f"(dedup={dup['second']['deduplicated']})")

    draft = demo_draft_rejection(api, created["06"]["webhooks"][0]["token"])
    print(f"  draft guard  : HTTP {draft['status_code']} "
          f"{draft['body'].get('error', {}).get('code')}")

    cat = api.ok("GET", "/api/v1/actions")
    print(f"  action catalog: {cat['actions']}")

    print("\n[6/6] Summary")
    print(f"  user_id      : {auth['user']['id']}")
    print(f"  email        : {args.email}  /  {args.password}")
    print(f"  workflows    : {len(blueprints)} (4 active, 2 draft)")
    print(f"  integrations : {len(integrations)}")
    print(f"  executions   : {len(api.ok('GET', '/api/v1/executions?limit=200'))} total")
    print("\n  Expected outcomes:")
    for name, status, steps, err in results:
        print(f"    {name[:44]:46} {status}")
        if steps:
            print(f"      steps: {steps}")
        if err:
            print(f"      error: {err}")
    print("\n=== Done. Browse http://127.0.0.1:8000/docs ===\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
