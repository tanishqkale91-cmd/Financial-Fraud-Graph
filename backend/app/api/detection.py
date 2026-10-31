"""
api/detection.py — FastAPI endpoints for running detection:
- POST /api/detection/run
- POST /api/detect/run (alias)
- GET /api/tasks/{task_id} (task status lookup)
"""
import uuid
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session
from celery.result import AsyncResult

from app.core.db import get_db
from app.core.celery_app import celery_app
from app.schemas.detection import DetectionRunRequest, DetectionRunResponse
from app.tasks.detect_task import run_detectors, execute_detection

router = APIRouter(tags=["detection"])


@router.post("/api/detection/run", response_model=DetectionRunResponse)
@router.post("/api/detect/run", response_model=DetectionRunResponse)
def trigger_detection(
    payload: Optional[DetectionRunRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Run fraud detection rules:
    - Rapid movement (money in then out within 30 min, small retained amount)
    - Circular transfers (NetworkX simple_cycles, length <= 6, top 2,000 active accounts)
    - Shared device/phone groups (>= 3 accounts)
    - Isolation Forest on per-account features (txn count, total amount, unique counterparties, top 1%)
    Excludes self-transfers everywhere.
    Runs via Celery task with synchronous fallback if worker/broker is unavailable.
    """
    rules = payload.rules if payload else None
    batch_id = payload.batch_id if payload else None

    task_id = str(uuid.uuid4())
    try:
        async_result = run_detectors.delay(batch_id=batch_id, rules=rules)
        task_id = async_result.id
        return DetectionRunResponse(
            task_id=task_id,
            status="PENDING",
        )
    except Exception:
        # Worker or broker offline: synchronous fallback execution
        result = execute_detection(db, batch_id=batch_id, rules=rules)
        return DetectionRunResponse(
            task_id=task_id,
            status="SUCCESS",
            alerts_created=result.get("alerts_created", 0),
            breakdown=result.get("breakdown", {}),
        )


@router.get("/api/tasks/{task_id}")
def get_task_status(task_id: str = Path(...)):
    """Check status of a background Celery task."""
    try:
        res = AsyncResult(task_id, app=celery_app)
        state = res.state
        result = res.result if res.ready() else {}
        return {"state": state, "result": result if isinstance(result, dict) else str(result)}
    except Exception as e:
        return {"state": "UNKNOWN", "error": str(e)}

