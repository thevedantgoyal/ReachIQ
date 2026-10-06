"""Celery application configuration for ReachIQ background workers."""

from __future__ import annotations

from celery import Celery
from celery.schedules import schedule

from backend.core.config import settings

celery_app = Celery(
    "reachiq",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "backend.workers.email_worker",
        "backend.workers.reply_watcher",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    "check-all-replies-every-300-seconds": {
        "task": "backend.workers.reply_watcher.check_all_replies",
        "schedule": schedule(run_every=settings.REPLY_CHECK_INTERVAL_SECONDS),
    },
}
