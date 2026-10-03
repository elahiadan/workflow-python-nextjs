"""Pluggable action architecture: registry + HTTP/Email/Slack/Delay."""
import smtplib
import time
from abc import ABC, abstractmethod
from email.message import EmailMessage
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.exceptions import AppException, BadRequestError
from app.core.ssrf import assert_safe_url


class ActionError(AppException):
    def __init__(self, message: str, retryable: bool = True, details=None):
        super().__init__(message, "ACTION_FAILED", 502 if retryable else 400, details)
        self.retryable = retryable


class BaseAction(ABC):
    name: str = "base"

    @abstractmethod
    def execute(self, config: dict, context: dict) -> dict:
        """Run synchronously, return JSON-serializable output. Raise ActionError on failure."""


class ActionRegistry:
    _actions: dict[str, BaseAction] = {}

    @classmethod
    def register(cls, action: BaseAction) -> None:
        cls._actions[action.name] = action

    @classmethod
    def get(cls, name: str) -> BaseAction:
        try:
            return cls._actions[name]
        except KeyError:
            raise BadRequestError(f"Unknown action: {name}", "UNKNOWN_ACTION") from None

    @classmethod
    def names(cls) -> list[str]:
        return sorted(cls._actions)


def render_template(value: Any, payload: dict) -> Any:
    """Minimal {{field.path}} interpolation for strings in action configs."""
    if isinstance(value, str) and "{{" in value:
        out = value
        start = 0
        from app.services.conditions.evaluator import resolve_field
        while True:
            s = out.find("{{", start)
            e = out.find("}}", s + 2) if s != -1 else -1
            if s == -1 or e == -1:
                break
            path = out[s + 2:e].strip()
            resolved = resolve_field(payload, path)
            out = out[:s] + ("" if resolved is None else str(resolved)) + out[e + 2:]
            start = s + 1
        return out
    if isinstance(value, dict):
        return {k: render_template(v, payload) for k, v in value.items()}
    if isinstance(value, list):
        return [render_template(v, payload) for v in value]
    return value


class HttpRequestAction(BaseAction):
    name = "http_request"

    def execute(self, config: dict, context: dict) -> dict:
        payload = context.get("trigger_payload", {})
        method = str(config.get("method", "POST")).upper()
        url = render_template(str(config.get("url", "")), payload)
        if not url:
            raise ActionError("HTTP action requires 'url'", retryable=False)
        assert_safe_url(url)
        if url.startswith("mock://"):  # test double, no network
            if "fail" in url:
                raise ActionError(f"Mock HTTP failure for {url}", retryable=True)
            return {"mock": True, "method": method, "url": url, "status_code": 200}
        headers = render_template(dict(config.get("headers", {}) or {}), payload)
        params = render_template(dict(config.get("params", {}) or {}), payload)
        body = render_template(config.get("body"), payload)
        timeout = int(config.get("timeout", 30))
        try:
            resp = httpx.request(method, url, headers=headers, params=params,
                                 json=body if isinstance(body, (dict, list)) else None,
                                 content=None if isinstance(body, (dict, list, type(None))) else str(body),
                                 timeout=timeout)
        except (httpx.TimeoutException, httpx.ConnectError) as e:
            raise ActionError(f"HTTP {method} {url} failed: {e}", retryable=True) from e
        except httpx.HTTPError as e:
            raise ActionError(f"HTTP error: {e}", retryable=True) from e
        if resp.status_code == 429 or resp.status_code >= 500:
            raise ActionError(f"HTTP {resp.status_code} from {url}", retryable=True,
                              details={"status_code": resp.status_code})
        if resp.status_code >= 400:
            raise ActionError(f"HTTP {resp.status_code} from {url}", retryable=False,
                              details={"status_code": resp.status_code})
        try:
            data = resp.json()
        except Exception:
            data = {"text": resp.text[:4000]}
        return {"status_code": resp.status_code, "response": data}


class EmailAction(BaseAction):
    name = "send_email"

    def execute(self, config: dict, context: dict) -> dict:
        payload = context.get("trigger_payload", {})
        to = render_template(str(config.get("to") or config.get("recipient", "")), payload)
        subject = render_template(str(config.get("subject", "(no subject)")), payload)
        body = render_template(str(config.get("body", "")), payload)
        if not to:
            raise ActionError("Email action requires 'to'", retryable=False)
        settings = get_settings()
        if settings.EMAIL_PROVIDER == "mock" or to.endswith("@example.com") or not settings.SMTP_USER:
            return {"mock": True, "to": to, "subject": subject, "provider": "mock"}
        msg = EmailMessage()
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        try:
            if settings.SMTP_USE_SSL:
                with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT,
                                      timeout=15) as s:
                    if settings.SMTP_USER:
                        s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    s.send_message(msg)
            else:
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as s:
                    if settings.SMTP_USE_TLS:
                        s.starttls()
                    if settings.SMTP_USER:
                        s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    s.send_message(msg)
        except (smtplib.SMTPException, OSError) as e:
            raise ActionError(f"SMTP send failed: {e}", retryable=True) from e
        return {"sent": True, "to": to, "subject": subject}


class SlackAction(BaseAction):
    name = "send_slack_message"

    def execute(self, config: dict, context: dict) -> dict:
        payload = context.get("trigger_payload", {})
        webhook_url = render_template(str(config.get("webhook_url") or config.get("url", "")), payload)
        text = render_template(str(config.get("text") or config.get("message", "")), payload)
        channel = render_template(str(config.get("channel", "")), payload)
        if not webhook_url:
            raise ActionError("Slack action requires 'webhook_url'", retryable=False)
        assert_safe_url(webhook_url)
        if webhook_url.startswith("mock://"):
            if "fail" in webhook_url:
                raise ActionError("Mock Slack failure", retryable=True)
            return {"mock": True, "channel": channel, "text": text}
        try:
            resp = httpx.post(webhook_url, json={"text": text, "channel": channel or None},
                              timeout=int(config.get("timeout", 30)))
        except (httpx.TimeoutException, httpx.ConnectError) as e:
            raise ActionError(f"Slack webhook failed: {e}", retryable=True) from e
        if resp.status_code == 429 or resp.status_code >= 500:
            raise ActionError(f"Slack webhook HTTP {resp.status_code}", retryable=True)
        if resp.status_code >= 400:
            raise ActionError(f"Slack webhook HTTP {resp.status_code}", retryable=False)
        return {"sent": True, "status_code": resp.status_code}


class DelayAction(BaseAction):
    name = "delay"

    def execute(self, config: dict, context: dict) -> dict:
        seconds = int(config.get("seconds", config.get("delay_seconds", 0)))
        seconds = max(0, min(seconds, 3600))
        # Never block workers on long waits in request path; cap real sleep.
        if context.get("eager_test"):
            return {"delayed_seconds": seconds, "mock_sleep": True}
        time.sleep(min(seconds, 5))
        return {"delayed_seconds": seconds}


ActionRegistry.register(HttpRequestAction())
ActionRegistry.register(EmailAction())
ActionRegistry.register(SlackAction())
ActionRegistry.register(DelayAction())
