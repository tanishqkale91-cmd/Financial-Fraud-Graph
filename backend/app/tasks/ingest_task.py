"""ingest_task.py — Celery task for CSV import. Full logic added in Step 6."""
from app.core.celery_app import celery_app


@celery_app.task(name="tasks.ingest")
def ingest_csv(file_path: str, schema_name: str) -> dict:
    """Placeholder — will call ingestion service in Step 6."""
    return {"status": "pending", "file": file_path}
