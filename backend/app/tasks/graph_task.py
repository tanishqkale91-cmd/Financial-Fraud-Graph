"""
graph_task.py — Celery task for synchronizing graph data to Neo4j.
"""
from typing import Dict, Any
from app.core.celery_app import celery_app
from app.core.db import SessionLocal
from app.services.graph.neo4j_sync import sync_alert_graph_to_neo4j


@celery_app.task(name="tasks.load_graph")
def load_graph() -> Dict[str, Any]:
    """Sync alert-related entities and edges to Neo4j."""
    db = SessionLocal()
    try:
        result = sync_alert_graph_to_neo4j(db)
        return {"status": "SUCCESS", **result}
    except Exception as e:
        return {"status": "FAILURE", "error": str(e)}
    finally:
        db.close()
