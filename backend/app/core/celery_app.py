"""
celery_app.py — creates the Celery application object.

Celery concept: a task queue system.
- Your Python functions decorated with @celery_app.task become "tasks".
- When you call task.delay(...), it sends a message to Redis.
- The worker process picks up the message and runs the function.
- The API stays responsive because heavy work happens in the background.
"""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "fraud_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.ingest_task",
        "app.tasks.detect_task",
        "app.tasks.graph_task",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)
