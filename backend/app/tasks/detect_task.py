"""detect_task.py — Celery task for running detectors. Full logic in Step 6."""
from app.core.celery_app import celery_app


@celery_app.task(name="tasks.detect")
def run_detectors(import_id: str) -> dict:
    """Placeholder — will call detection service in Step 6."""
    return {"status": "pending", "import_id": import_id}
