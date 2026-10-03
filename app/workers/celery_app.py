"""Celery app + tasks (execution worker + scheduler)."""
from celery import Celery
from celery.schedules import schedule

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "workflow",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    beat_schedule={
        "schedule-due-workflows": {
            "task": "app.workers.tasks.check_scheduled_workflows",
            "schedule": schedule(run_every=60.0),
        },
    },
)
