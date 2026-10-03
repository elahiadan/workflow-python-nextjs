"""Webhook ingestion (public) + management (authenticated)."""
import hashlib
import hmac
import secrets

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, rate_limit_webhook
from app.core.exceptions import BadRequestError, NotFoundError
from app.db import models
from app.db.database import get_db
from app.services.execution.engine import create_execution, queue_execution

public_router = APIRouter(tags=["webhooks"])
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_signature(secret: str, body: bytes, signature: str | None) -> None:
    if not secret:
        return
    if not signature:
        raise BadRequestError("Missing webhook signature", "INVALID_SIGNATURE")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature.replace("sha256=", "")):
        raise BadRequestError("Invalid webhook signature", "INVALID_SIGNATURE")


@public_router.post("/webhooks/{token}", status_code=202,
                    dependencies=[Depends(rate_limit_webhook)])
async def ingest_webhook(token: str, request: Request,
                         x_event_id: str | None = Header(default=None),
                         x_webhook_signature: str | None = Header(default=None),
                         db: Session = Depends(get_db)):
    raw = await request.body()
    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            payload = {"data": payload}
    except Exception:
        payload = {}
    hook = db.query(models.Webhook).filter_by(token=token).first()
    if not hook or not hook.is_active:
        raise NotFoundError("Webhook not found", "WEBHOOK_NOT_FOUND")
    _verify_signature(hook.secret or "", raw, x_webhook_signature)
    wf = db.query(models.Workflow).filter_by(id=hook.workflow_id).first()
    if not wf:
        raise NotFoundError("Workflow not found", "WORKFLOW_NOT_FOUND")
    if wf.status != "active":
        raise BadRequestError("Workflow is not active", "WORKFLOW_NOT_ACTIVE")
    event_id = x_event_id or (payload.get("event_id") if isinstance(payload, dict) else None)
    if event_id:  # idempotent replay
        existing = db.query(models.WorkflowExecution).filter_by(
            workflow_id=wf.id, event_id=str(event_id)).first()
        if existing:
            return {"success": True, "execution_id": existing.id, "status": existing.status,
                    "deduplicated": True}
    exc = create_execution(db, wf, payload, trigger_type="webhook",
                           event_id=str(event_id) if event_id else None)
    from app.core.config import get_settings as _gs
    if _gs().CELERY_TASK_ALWAYS_EAGER:
        from app.services.execution.engine import run_execution as _run
        _run(exc.id, db, eager_test=True)
        mode = "eager"
    else:
        mode = queue_execution(exc.id)
    return {"success": True, "execution_id": exc.id, "status": "queued", "mode": mode,
            "deduplicated": False}


@router.get("", response_model=list[dict])
def list_webhooks(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return [{"id": w.id, "workflow_id": w.workflow_id, "token": w.token,
             "is_active": w.is_active, "created_at": w.created_at}
            for w in db.query(models.Webhook).filter_by(user_id=user.id).all()]


@router.post("/{webhook_id}/rotate")
def rotate_webhook(webhook_id: str, db: Session = Depends(get_db),
                   user: models.User = Depends(get_current_user)):
    hook = db.query(models.Webhook).filter_by(id=webhook_id, user_id=user.id).first()
    if not hook:
        raise NotFoundError("Webhook not found", "WEBHOOK_NOT_FOUND")
    hook.token = secrets.token_urlsafe(32)
    db.commit()
    return {"id": hook.id, "token": hook.token}
