"""Celery tasks: async workflow execution + scheduled trigger polling."""
from datetime import datetime

from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.execute_workflow_task", bind=True, max_retries=0)
def execute_workflow_task(self, execution_id: str) -> dict:
    from app.db.database import SessionLocal
    from app.services.execution.engine import run_execution
    db = SessionLocal()
    try:
        exc = run_execution(execution_id, db)
        return {"execution_id": exc.id, "status": exc.status}
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks.check_scheduled_workflows")
def check_scheduled_workflows() -> dict:
    """Poll ScheduledJobs + schedule-type triggers and enqueue due runs (1-min granularity)."""
    from croniter import croniter
    from app.db import models
    from app.db.database import SessionLocal
    from app.services.execution.engine import create_execution, queue_execution

    db = SessionLocal()
    enqueued = 0
    try:
        now = datetime.utcnow()
        jobs = db.query(models.ScheduledJob).filter_by(is_active=True).all()
        for job in jobs:
            try:
                cron = croniter(job.schedule, job.last_run_at or now)
                nxt = cron.get_next(datetime)
            except Exception:
                continue
            if job.last_run_at is None or (job.next_run_at and job.next_run_at <= now):
                wf = db.query(models.Workflow).filter_by(id=job.workflow_id).first()
                if wf and wf.status == "active":
                    exc = create_execution(db, wf, {"scheduled_at": now.isoformat()},
                                           trigger_type="schedule")
                    queue_execution(exc.id)
                    enqueued += 1
                job.last_run_at = now
                try:
                    job.next_run_at = croniter(job.schedule, now).get_next(datetime)
                except Exception:
                    job.next_run_at = None
        # schedule-type triggers stored on WorkflowTrigger
        triggers = db.query(models.WorkflowTrigger).filter_by(type="schedule").all()
        for trig in triggers:
            cfg = trig.config or {}
            cron_expr = cfg.get("cron") or cfg.get("schedule", "")
            last = cfg.get("_last_run")
            try:
                base = datetime.fromisoformat(last) if last else now
                nxt = croniter(cron_expr, base).get_next(datetime)
            except Exception:
                continue
            if nxt <= now:
                wf = db.query(models.Workflow).filter_by(id=trig.workflow_id).first()
                if wf and wf.status == "active":
                    exc = create_execution(db, wf, {"scheduled_at": now.isoformat()},
                                           trigger_type="schedule")
                    queue_execution(exc.id)
                    enqueued += 1
                cfg["_last_run"] = now.isoformat()
                trig.config = dict(cfg)
        db.commit()
    finally:
        db.close()
    return {"enqueued": enqueued}
