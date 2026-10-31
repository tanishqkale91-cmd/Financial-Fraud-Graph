"""schemas/alerts.py — Pydantic schemas for alerts endpoints."""
from typing import Dict, List, Any, Optional
from pydantic import BaseModel


class AlertListItem(BaseModel):
    id: str
    rule_id: str
    rule_version: int
    score: float
    reason: str
    status: str
    entity_id: Optional[str] = None
    created_at: str


class AlertListResponse(BaseModel):
    total: int
    items: List[AlertListItem]


class AlertTransactionItem(BaseModel):
    id: int
    txn_ts: str
    from_entity_id: str
    to_entity_id: str
    amount: float
    currency: str


class AlertDetailResponse(BaseModel):
    id: str
    rule_id: str
    rule_version: int
    score: float
    reason: str
    status: str
    evidence: Dict[str, Any]
    score_breakdown: Optional[Dict[str, Any]] = None
    transactions: List[AlertTransactionItem] = []
    entity_id: Optional[str] = None
    created_at: str


class AlertDecisionRequest(BaseModel):
    decision: str  # confirmed | false_positive | escalate
    note: Optional[str] = None


class AlertDecisionResponse(BaseModel):
    id: str
    status: str
    decision: str
    note: Optional[str] = None


class AlertFeedbackRequest(BaseModel):
    verdict: str  # false_positive | confirmed
    note: Optional[str] = None

