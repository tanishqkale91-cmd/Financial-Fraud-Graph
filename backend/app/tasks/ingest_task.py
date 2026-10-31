"""ingest_task.py — Celery tasks for ingestion."""
from app.core.celery_app import celery_app


@celery_app.task(name="app.tasks.ingest_task.ping")
def ping() -> str:
    """Health check task returning 'pong'."""
    return "pong"
