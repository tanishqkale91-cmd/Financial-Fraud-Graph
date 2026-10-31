"""
api/alerts.py — FastAPI endpoints for alerts:
- GET /api/alerts (filter by rule_id, status, min_score, limit, offset)
- GET /api/alerts/{id} (returns details, evidence, score_breakdown, transactions)
- POST /api/alerts/{id}/decision (confirmed | false_positive | escalate + note)
- POST /api/alerts/{id}/feedback (backwards-compatible feedback endpoint)
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.db import get_db
from app.models.alert import Alert, AlertTransaction
from app.models.transaction import Transaction
from app.schemas.alerts import (
    AlertListResponse,
    AlertListItem,
    AlertDetailResponse,
    AlertTransactionItem,
    AlertDecisionRequest,
    AlertDecisionResponse,
    AlertFeedbackRequest,
)

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=AlertListResponse)
def list_alerts(
    rule_id: Optional[str] = Query(None, description="Filter by rule ID"),
    status: Optional[str] = Query(None, description="Filter by status (open, confirmed, false_positive, etc.)"),
    min_score: Optional[float] = Query(None, description="Minimum risk score threshold"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List fraud alerts with optional filters and pagination."""
    query = db.query(Alert)
    if rule_id:
        query = query.filter(Alert.rule_id == rule_id)
    if status:
        query = query.filter(Alert.status == status)
    if min_score is not None:
        query = query.filter(Alert.score >= min_score)

    total = query.count()
    alerts = query.order_by(desc(Alert.score), desc(Alert.created_at)).offset(offset).limit(limit).all()

    items = [
        AlertListItem(
            id=str(a.id),
            rule_id=a.rule_id,
            rule_version=a.rule_version,
            score=round(a.score, 4),
            reason=a.reason,
            status=a.status,
            entity_id=str(a.entity_id) if a.entity_id else None,
            created_at=a.created_at.isoformat() if a.created_at else "",
        )
        for a in alerts
    ]

    return AlertListResponse(total=total, items=items)


@router.get("/{id}", response_model=AlertDetailResponse)
def get_alert_detail(
    id: uuid.UUID = Path(..., description="Alert UUID"),
    db: Session = Depends(get_db),
):
    """Retrieve full details of an alert including evidence, score_breakdown, and linked transactions."""
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Fetch linked transactions
    linked_txns = (
        db.query(Transaction)
        .join(AlertTransaction, AlertTransaction.transaction_id == Transaction.id)
        .filter(AlertTransaction.alert_id == id)
        .all()
    )

    txn_items = [
        AlertTransactionItem(
            id=t.id,
            txn_ts=t.txn_ts.isoformat() if t.txn_ts else "",
            from_entity_id=str(t.from_entity_id),
            to_entity_id=str(t.to_entity_id),
            amount=float(t.amount),
            currency=t.currency,
        )
        for t in linked_txns
    ]

    return AlertDetailResponse(
        id=str(alert.id),
        rule_id=alert.rule_id,
        rule_version=alert.rule_version,
        score=round(alert.score, 4),
        reason=alert.reason,
        status=alert.status,
        evidence=alert.evidence or {},
        score_breakdown=alert.score_breakdown,
        transactions=txn_items,
        entity_id=str(alert.entity_id) if alert.entity_id else None,
        created_at=alert.created_at.isoformat() if alert.created_at else "",
    )


@router.post("/{id}/decision", response_model=AlertDecisionResponse)
def decide_alert(
    payload: AlertDecisionRequest,
    id: uuid.UUID = Path(..., description="Alert UUID"),
    db: Session = Depends(get_db),
):
    """Record an analyst decision on an alert: confirmed, false_positive, or escalate."""
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    allowed_decisions = {"confirmed", "false_positive", "escalate"}
    decision = payload.decision.lower().strip()
    if decision not in allowed_decisions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decision '{payload.decision}'. Must be one of: {allowed_decisions}",
        )

    # Map decision to status
    status_map = {
        "confirmed": "confirmed",
        "false_positive": "false_positive",
        "escalate": "escalated",
    }
    alert.status = status_map[decision]

    evidence_data = dict(alert.evidence or {})
    evidence_data["last_decision"] = decision
    if payload.note:
        evidence_data["decision_note"] = payload.note
    evidence_data["decided_at"] = datetime.now(timezone.utc).isoformat()
    alert.evidence = evidence_data

    db.commit()

    return AlertDecisionResponse(
        id=str(alert.id),
        status=alert.status,
        decision=decision,
        note=payload.note,
    )


@router.post("/{id}/feedback")
def submit_feedback(
    payload: AlertFeedbackRequest,
    id: uuid.UUID = Path(..., description="Alert UUID"),
    db: Session = Depends(get_db),
):
    """Feedback loop endpoint supporting verdict=false_positive|confirmed."""
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    verdict = payload.verdict.lower().strip()
    if verdict not in {"confirmed", "false_positive"}:
        raise HTTPException(status_code=400, detail="Verdict must be 'confirmed' or 'false_positive'")

    alert.status = verdict
    if payload.note:
        ev = dict(alert.evidence or {})
        ev["feedback_note"] = payload.note
        alert.evidence = ev

    db.commit()
    return {"alert_id": str(alert.id), "status": alert.status}

