"""Workflow execution engine: resolver -> execution -> steps -> conditions/actions -> logging."""
import time
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db import models
from app.integrations.actions import ActionError, ActionRegistry
from app.services.conditions.evaluator import evaluate_condition

log = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.utcnow()


def _ms_since(start: datetime) -> int:
    return int((_utcnow() - start).total_seconds() * 1000)


def add_log(db: Session, execution_id: str, message: str, level: str = "INFO",
            step_execution_id: Optional[str] = None, **ctx) -> None:
    db.add(models.ExecutionLog(
        execution_id=execution_id, step_execution_id=step_execution_id,
        level=level, message=message, context=ctx or {},
    ))


def create_execution(db: Session, workflow: models.Workflow, trigger_payload: dict,
                     trigger_type: str = "webhook",
                     event_id: Optional[str] = None) -> models.WorkflowExecution:
    """Create an execution row. Idempotent on (workflow_id, event_id)."""
    if event_id:
        existing = db.query(models.WorkflowExecution).filter_by(
            workflow_id=workflow.id, event_id=event_id).first()
        if existing:
            return existing
    exc = models.WorkflowExecution(
        workflow_id=workflow.id, user_id=workflow.user_id,
        trigger_type=trigger_type, trigger_payload=trigger_payload or {},
        event_id=event_id, status="pending",
    )
    db.add(exc)
    try:
        db.commit()
    except IntegrityError:  # concurrent duplicate delivery
        db.rollback()
        existing = db.query(models.WorkflowExecution).filter_by(
            workflow_id=workflow.id, event_id=event_id).first()
        if existing:
            return existing
        raise
    db.refresh(exc)
    return exc


def execute_step_action(step: models.WorkflowStep, trigger_payload: dict,
                        context: dict) -> dict:
    action = ActionRegistry.get(step.action or "")
    merged_config = {**(action_config_from_integration(context, step) or {}), **(step.config or {})}
    return action.execute(merged_config, {**context, "trigger_payload": trigger_payload})


def action_config_from_integration(context: dict, step: models.WorkflowStep) -> dict:
    # Hook: if step.config.integration_id is set, merge decrypted credentials server-side.
    # Kept minimal: credentials are resolved by the caller when available.
    return {}


def run_execution(execution_id: str, db: Session, eager_test: bool = False) -> models.WorkflowExecution:
    """Synchronously run one execution (called by Celery worker or inline)."""
    exc = db.query(models.WorkflowExecution).filter_by(id=execution_id).first()
    if not exc:
        raise ValueError(f"Execution {execution_id} not found")
    workflow = db.query(models.Workflow).filter_by(id=exc.workflow_id).first()
    if not workflow:
        exc.status = "failed"
        exc.error = "Workflow not found"
        db.commit()
        return exc

    logger = get_logger(__name__, workflow_id=workflow.id, execution_id=exc.id)
    exc.status = "running"
    exc.started_at = _utcnow()
    db.commit()
    add_log(db, exc.id, "execution started", workflow_id=workflow.id)
    db.commit()
    logger.info("execution started")

    steps = (db.query(models.WorkflowStep).filter_by(workflow_id=workflow.id)
             .order_by(models.WorkflowStep.order_index).all())

    context: dict = {"eager_test": eager_test, "execution_id": exc.id,
                     "trigger_payload": exc.trigger_payload or {}}
    failed = False
    stopped_by_condition = False

    for step in steps:
        s_log = get_logger(__name__, workflow_id=workflow.id, execution_id=exc.id, step_id=step.id)
        started = _utcnow()
        step_exec = models.StepExecution(
            execution_id=exc.id, step_id=step.id, step_order=step.order_index,
            step_type=step.type, action=step.action, status="running",
            attempt=1, max_attempts=step.max_attempts,
            input_data={"config": step.config, "trigger_payload": exc.trigger_payload},
            output_data={}, started_at=started,
        )
        db.add(step_exec)
        db.commit()
        add_log(db, exc.id, "step started", step_execution_id=step_exec.id,
                step_order=step.order_index, step_type=step.type, action=step.action)
        db.commit()
        s_log.info("step started")

        try:
            if step.type == "condition":
                try:
                    result = evaluate_condition(step.config or {}, exc.trigger_payload or {})
                except ValueError as e:
                    raise ActionError(str(e), retryable=False) from e
                step_exec.output_data = {"result": result}
                if result:
                    step_exec.status = "success"
                    add_log(db, exc.id, "condition passed", step_execution_id=step_exec.id,
                            result=result)
                else:
                    step_exec.status = "skipped"
                    step_exec.output_data = {"result": False, "stopped_workflow": True}
                    stopped_by_condition = True
                    add_log(db, exc.id, "condition not met, stopping workflow",
                            step_execution_id=step_exec.id, result=False)
                    step_exec.completed_at = _utcnow()
                    step_exec.duration_ms = _ms_since(started)
                    db.commit()
                    s_log.info("condition stopped workflow")
                    break
            elif step.type == "action":
                output = None
                last_err: Optional[str] = None
                retryable = True
                for attempt in range(1, (step.max_attempts or 1) + 1):
                    step_exec.attempt = attempt
                    try:
                        output = execute_step_action(step, exc.trigger_payload or {}, context)
                        last_err = None
                        retryable = True
                        break
                    except ActionError as e:
                        last_err = e.message
                        retryable = e.retryable
                        add_log(db, exc.id, f"step attempt {attempt} failed: {e.message}",
                                level="WARNING", step_execution_id=step_exec.id,
                                attempt=attempt, retryable=retryable)
                        db.commit()
                        if not retryable or attempt >= (step.max_attempts or 1):
                            break
                        if not eager_test and step.retry_delay_seconds > 0:
                            time.sleep(min(step.retry_delay_seconds, 5))
                        else:
                            add_log(db, exc.id, f"retry scheduled (attempt {attempt + 1})",
                                    step_execution_id=step_exec.id)
                            db.commit()
                if last_err is not None:
                    step_exec.status = "failed"
                    step_exec.error = last_err
                    exc.error = f"Step {step.order_index} ({step.action}) failed: {last_err}"
                    add_log(db, exc.id, "step failed", level="ERROR",
                            step_execution_id=step_exec.id, error=last_err)
                    failed = True
                else:
                    step_exec.status = "success"
                    step_exec.output_data = output or {}
                    add_log(db, exc.id, "step completed", step_execution_id=step_exec.id)
            else:
                raise ActionError(f"Unknown step type: {step.type}", retryable=False)
        except ActionError as e:
            step_exec.status = "failed"
            step_exec.error = e.message
            exc.error = e.message
            add_log(db, exc.id, "step failed", level="ERROR",
                    step_execution_id=step_exec.id, error=e.message)
            failed = True
        except Exception as e:  # never silently ignore
            step_exec.status = "failed"
            step_exec.error = f"{type(e).__name__}: {e}"
            exc.error = step_exec.error
            add_log(db, exc.id, "step failed unexpectedly", level="ERROR",
                    step_execution_id=step_exec.id, error=step_exec.error)
            logger.exception("unexpected step error")
            failed = True

        step_exec.completed_at = _utcnow()
        step_exec.duration_ms = _ms_since(started)
        db.commit()
        s_log.info("step %s", step_exec.status)
        if failed:
            break

    exc.completed_at = _utcnow()
    exc.duration_ms = _ms_since(exc.started_at or exc.completed_at)
    if failed:
        exc.status = "failed"
        add_log(db, exc.id, "execution completed: FAILED", level="ERROR")
        logger.info("execution failed")
    elif stopped_by_condition:
        exc.status = "success"
        add_log(db, exc.id, "execution completed: stopped by condition")
        logger.info("execution stopped by condition")
    else:
        exc.status = "success"
        add_log(db, exc.id, "execution completed: SUCCESS")
        logger.info("execution completed")
    db.commit()
    db.refresh(exc)
    return exc


def queue_execution(execution_id: str) -> str:
    """Hand off to Celery; fall back to synchronous execution if broker missing/eager."""
    from app.core.config import get_settings
    settings = get_settings()
    if settings.CELERY_TASK_ALWAYS_EAGER:
        from app.db.database import SessionLocal
        db = SessionLocal()
        try:
            run_execution(execution_id, db, eager_test=True)
        finally:
            db.close()
        return "eager"
    try:
        from app.workers.tasks import execute_workflow_task
        execute_workflow_task.delay(execution_id)
        return "queued"
    except Exception:
        from app.db.database import SessionLocal
        db = SessionLocal()
        try:
            run_execution(execution_id, db)
        finally:
            db.close()
        return "sync-fallback"
