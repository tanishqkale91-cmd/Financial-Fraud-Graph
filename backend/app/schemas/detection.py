"""schemas/detection.py — Pydantic schemas for detection endpoints."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class DetectionRunRequest(BaseModel):
    rules: Optional[List[str]] = None
    batch_id: Optional[str] = None


class DetectionRunResponse(BaseModel):
    task_id: str
    status: str
    alerts_created: Optional[int] = None
    breakdown: Optional[Dict[str, int]] = None

