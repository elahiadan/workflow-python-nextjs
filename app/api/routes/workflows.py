"""Workflow CRUD + activate/deactivate."""
import secrets

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, owned_workflow
from app.core.exceptions import BadRequestError
from app.db import models
from app.db.database import get_db
from app.schemas import StepIn, WorkflowCreate, WorkflowListOut, WorkflowOut, WorkflowUpdate

router = APIRouter(prefix="/workflows", tags=["workflows"])

STATUSES = {"draft", "active", "inactive", "archived"}
TRIGGER_TYPES = {"webhook", "schedule"}
STEP_TYPES = {"condition", "action"}


def _validate_steps(steps: list[StepIn]) -> None:
    from app.services.conditions.evaluator import SUPPORTED_OPERATORS
    for s in steps:
        if s.type not in STEP_TYPES:
            raise BadRequestError(f"Invalid step type: {s.type}", "INVALID_STEP")
        if s.type == "condition":
            op = (s.config or {}).get("operator", "")
            if op not in SUPPORTED_OPERATORS:
                raise BadRequestError(f"Unsupported operator: {op}", "INVALID_CONDITION")
            if not (s.config or {}).get("field"):
                raise BadRequestError("Condition step requires 'field'", "INVALID_CONDITION")
        if s.type == "action" and not s.action:
            raise BadRequestError("Action step requires 'action'", "INVALID_STEP")


def _replace_steps(db: Session, wf: models.Workflow, steps: list[StepIn]) -> None:
    db.query(models.WorkflowCondition).filter(
        models.WorkflowCondition.step_id.in_(
            db.query(models.WorkflowStep.id).filter_by(workflow_id=wf.id))).delete(
        synchronize_session=False)
    db.query(models.WorkflowStep).filter_by(workflow_id=wf.id).delete()
    for i, s in enumerate(steps):
        row = models.WorkflowStep(
            workflow_id=wf.id, order_index=s.order if s.order is not None else i,
            type=s.type, action=s.action, name=s.name, config=s.config,
            max_attempts=s.max_attempts, retry_delay_seconds=s.retry_delay_seconds,
            timeout_seconds=s.timeout_seconds,
        )
        db.add(row)
        db.flush()
        if s.type == "condition":
            db.add(models.WorkflowCondition(
                step_id=row.id, field=s.config.get("field", ""),
                operator=s.config.get("operator", ""), value=s.config.get("value")))


def _ensure_webhook(db: Session, wf: models.Workflow) -> None:
    db.flush()  # sessions run with autoflush=False; make pending trigger visible
    trig = db.query(models.WorkflowTrigger).filter_by(workflow_id=wf.id).first()
    if trig and trig.type == "webhook" and not db.query(models.Webhook).filter_by(
            workflow_id=wf.id).first():
        db.add(models.Webhook(workflow_id=wf.id, user_id=wf.user_id,
                              token=secrets.token_urlsafe(32), secret=""))


@router.post("", response_model=WorkflowOut, status_code=201)
def create_workflow(body: WorkflowCreate, db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
    if body.trigger.type not in TRIGGER_TYPES:
        raise BadRequestError("Invalid trigger type", "INVALID_TRIGGER")
    _validate_steps(body.steps)
    wf = models.Workflow(user_id=user.id, name=body.name, description=body.description,
                         status="draft")
    db.add(wf)
    db.flush()
    db.add(models.WorkflowTrigger(workflow_id=wf.id, type=body.trigger.type,
                                  config=body.trigger.config))
    if body.trigger.type == "schedule":
        db.add(models.ScheduledJob(workflow_id=wf.id,
                                   schedule=body.trigger.config.get("schedule")
                                   or body.trigger.config.get("cron", "0 * * * *"),
                                   timezone=body.trigger.config.get("timezone", "UTC")))
    _replace_steps(db, wf, body.steps)
    _ensure_webhook(db, wf)
    db.commit()
    db.refresh(wf)
    return wf


@router.get("", response_model=list[WorkflowListOut])
def list_workflows(status: str | None = Query(default=None),
                   limit: int = Query(default=50, ge=1, le=200),
                   offset: int = Query(default=0, ge=0),
                   db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    q = db.query(models.Workflow).filter_by(user_id=user.id).order_by(
        models.Workflow.created_at.desc())
    if status:
        q = q.filter_by(status=status)
    return q.offset(offset).limit(limit).all()


@router.get("/{workflow_id}", response_model=WorkflowOut)
def get_workflow(workflow_id: str, db: Session = Depends(get_db),
                 user: models.User = Depends(get_current_user)):
    return owned_workflow(workflow_id, user, db)


@router.put("/{workflow_id}", response_model=WorkflowOut)
def update_workflow(workflow_id: str, body: WorkflowUpdate, db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
    wf = owned_workflow(workflow_id, user, db)
    if body.name is not None:
        wf.name = body.name
    if body.description is not None:
        wf.description = body.description
    if body.status is not None:
        if body.status not in STATUSES:
            raise BadRequestError("Invalid status", "INVALID_STATUS")
        wf.status = body.status
    if body.trigger is not None:
        if body.trigger.type not in TRIGGER_TYPES:
            raise BadRequestError("Invalid trigger type", "INVALID_TRIGGER")
        trig = db.query(models.WorkflowTrigger).filter_by(workflow_id=wf.id).first()
        if trig:
            trig.type = body.trigger.type
            trig.config = body.trigger.config
        else:
            db.add(models.WorkflowTrigger(workflow_id=wf.id, type=body.trigger.type,
                                          config=body.trigger.config))
        _ensure_webhook(db, wf)
    if body.steps is not None:
        _validate_steps(body.steps)
        _replace_steps(db, wf, body.steps)
    wf.version += 1
    db.commit()
    db.refresh(wf)
    return wf


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: str, db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
    wf = owned_workflow(workflow_id, user, db)
    db.delete(wf)
    db.commit()
    return {"success": True, "message": "Workflow deleted"}


@router.post("/{workflow_id}/activate", response_model=WorkflowOut)
def activate(workflow_id: str, db: Session = Depends(get_db),
             user: models.User = Depends(get_current_user)):
    wf = owned_workflow(workflow_id, user, db)
    wf.status = "active"
    wf.version += 1
    db.commit()
    db.refresh(wf)
    return wf


@router.post("/{workflow_id}/deactivate", response_model=WorkflowOut)
def deactivate(workflow_id: str, db: Session = Depends(get_db),
               user: models.User = Depends(get_current_user)):
    wf = owned_workflow(workflow_id, user, db)
    wf.status = "inactive"
    wf.version += 1
    db.commit()
    db.refresh(wf)
    return wf
