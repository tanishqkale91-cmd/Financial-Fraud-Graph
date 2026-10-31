"""graph_task.py — Celery task for loading Neo4j. Full logic in Step 4."""
from app.core.celery_app import celery_app


@celery_app.task(name="tasks.load_graph")
def load_graph(import_id: str) -> dict:
    """Placeholder — will call graph service in Step 4."""
    return {"status": "pending", "import_id": import_id}
