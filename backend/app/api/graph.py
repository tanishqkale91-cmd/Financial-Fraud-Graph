"""
api/graph.py — Graph endpoints:
- GET /api/graph/{account_id}: 2-hop neighborhood of an account as {nodes, edges}
- POST /api/graph/build: sync alert entities and edges to Neo4j
- GET /api/graph/neighborhood: query neighborhood with query parameters
"""
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.graph import GraphNeighborhoodResponse, GraphNode, GraphEdge
from app.services.graph.neo4j_sync import get_2hop_subgraph, sync_alert_graph_to_neo4j
from app.tasks.graph_task import load_graph

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/{account_id}", response_model=GraphNeighborhoodResponse)
def get_account_graph(
    account_id: str = Path(..., description="Account UUID or canonical key"),
    db: Session = Depends(get_db),
):
    """
    Get 2-hop neighborhood of an account as {nodes, edges}.
    Excludes self-transfers everywhere.
    Answers in under 30 seconds (capped at 200 nodes).
    """
    data = get_2hop_subgraph(account_id, db, max_nodes=200)
    return GraphNeighborhoodResponse(**data)


@router.get("/neighborhood", response_model=GraphNeighborhoodResponse)
def get_neighborhood(
    entity_id: str = Query(..., description="Root entity UUID or canonical key"),
    hops: int = Query(2, ge=1, le=2),
    db: Session = Depends(get_db),
):
    """Query neighborhood for an entity (up to 2 hops, max 200 nodes)."""
    data = get_2hop_subgraph(entity_id, db, max_nodes=200)
    return GraphNeighborhoodResponse(**data)


@router.post("/build")
@router.post("/sync")
def trigger_graph_sync(db: Session = Depends(get_db)):
    """
    Trigger batch synchronization of alert-related accounts, devices, phones, and edges to Neo4j.
    Uses Celery with synchronous fallback if worker is unavailable.
    """
    task_id = str(uuid.uuid4())
    try:
        async_res = load_graph.delay()
        task_id = async_res.id
        return {"task_id": task_id, "status": "PENDING"}
    except Exception:
        # Synchronous fallback
        res = sync_alert_graph_to_neo4j(db)
        return {"task_id": task_id, "status": "SUCCESS", **res}

