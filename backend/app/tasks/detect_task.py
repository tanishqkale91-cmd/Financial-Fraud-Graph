"""
detect_task.py — Detection task orchestrator and Celery task with synchronous execution support.
Runs:
1. Rapid movement (money in then out within 30 min, small retained amount)
2. Circular transfers (NetworkX simple_cycles, length <= 6, on 2,000 most active accounts)
3. Shared device/phone groups (>= 3 accounts)
4. Isolation Forest on per-account features (txn count, total amount, unique counterparties, top 1%)
Excludes self-transfers everywhere.
"""
import uuid
import logging
from typing import Dict, Any, List, Optional
import pandas as pd
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.db import SessionLocal
from app.models.alert import Alert, AlertTransaction
from app.models.transaction import Transaction
from app.models.entity import Entity
from app.models.raw_record import RawRecord
from app.services.detection.rapid_movement import detect_rapid_movement
from app.services.detection.cycles import detect_cycles
from app.services.detection.shared_infra import detect_shared_infra
from app.services.ml.anomaly import detect_isolation_forest_anomalies

logger = logging.getLogger(__name__)


def execute_detection(
    db: Session,
    batch_id: Optional[str] = None,
    rules: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Execute detection pipeline synchronously against database transactions.
    """
    # 1. Fetch transactions, excluding self-transfers
    query = db.query(Transaction).filter(Transaction.from_entity_id != Transaction.to_entity_id)
    if batch_id:
        try:
            b_uuid = uuid.UUID(batch_id)
            query = query.filter(Transaction.batch_id == b_uuid)
        except Exception:
            pass

    txns = query.all()
    if not txns:
        return {"alerts_created": 0, "breakdown": {}}

    # Convert to DataFrame
    records = []
    for t in txns:
        records.append({
            "id": t.id,
            "batch_id": str(t.batch_id),
            "txn_ts": t.txn_ts,
            "from_entity_id": str(t.from_entity_id),
            "to_entity_id": str(t.to_entity_id),
            "amount": float(t.amount),
            "currency": t.currency,
            "payment_format": t.payment_format,
            "device_entity_id": str(t.device_entity_id) if t.device_entity_id else None,
            "ip": t.ip,
        })
    df_txns = pd.DataFrame(records)

    # 2. Build entities lookup
    entities = db.query(Entity).all()
    entities_map = {str(e.id): e.display_name or e.canonical_key for e in entities}
    entity_id_set = {str(e.id) for e in entities}

    # Fetch phone entities and raw record phone links for shared phone detection
    phone_links = []
    try:
        phone_entities = {
            str(e.id): e.canonical_key
            for e in entities if e.entity_type == "phone"
        }
        # Check raw records for phone mappings if available
        raw_recs = db.query(RawRecord.raw).limit(50000).all()
        for r in raw_recs:
            if not r.raw:
                continue
            s_phone = r.raw.get("Sender_phone") or r.raw.get("phone")
            s_acct = r.raw.get("Account") or r.raw.get("from_account")
            if s_phone and s_acct:
                phone_links.append({
                    "phone_id": str(s_phone),
                    "phone_key": str(s_phone),
                    "account_id": str(s_acct),
                })
    except Exception:
        pass

    all_findings: List[Dict[str, Any]] = []
    active_rules = set(rules) if rules else {
        "rapid_movement",
        "cycles",
        "shared_infra",
        "anomaly_isolation_forest",
        "isolation_forest",
    }

    # Run detectors
    # 1. Rapid movement
    if "rapid_movement" in active_rules:
        findings_rm = detect_rapid_movement(df_txns, entities_map, {"window_minutes": 30, "pass_through_ratio": 0.85})
        all_findings.extend(findings_rm)

    # 2. Cycles (NetworkX simple_cycles, length <= 6, top 2000 active accounts)
    if "cycles" in active_rules:
        findings_cyc = detect_cycles(df_txns, entities_map, {"max_len": 6, "max_active_accounts": 2000})
        all_findings.extend(findings_cyc)

    # 3. Shared infrastructure (>= 3 accounts)
    if "shared_infra" in active_rules:
        findings_infra = detect_shared_infra(df_txns, entities_map, {"min_accounts": 3}, phone_links=phone_links)
        all_findings.extend(findings_infra)

    # 4. Isolation Forest
    if "anomaly_isolation_forest" in active_rules or "isolation_forest" in active_rules:
        findings_ml = detect_isolation_forest_anomalies(df_txns, entities_map, {"contamination": 0.01})
        all_findings.extend(findings_ml)

    # Deduplicate against existing open alerts in DB
    existing_alerts = db.query(Alert.rule_id, Alert.entity_id).filter(Alert.status == "open").all()
    existing_set = {(a.rule_id, str(a.entity_id) if a.entity_id else None) for a in existing_alerts}

    alerts_to_insert = []
    alert_txns_to_insert = []
    breakdown: Dict[str, int] = {}

    for finding in all_findings:
        r_id = finding["rule_id"]
        ent_id_raw = finding.get("entity_id")
        
        # Valid entity UUID
        valid_ent_uuid = None
        if ent_id_raw and str(ent_id_raw) in entity_id_set:
            valid_ent_uuid = uuid.UUID(str(ent_id_raw))

        dedup_key = (r_id, str(valid_ent_uuid) if valid_ent_uuid else None)
        if dedup_key in existing_set and valid_ent_uuid is not None:
            continue
        existing_set.add(dedup_key)

        alert_id = uuid.uuid4()
        score = float(finding["score"])
        reason = finding["reason"]
        evidence = finding["evidence"]
        score_breakdown = finding.get("score_breakdown")
        r_version = int(finding.get("rule_version", 1))

        alerts_to_insert.append(Alert(
            id=alert_id,
            rule_id=r_id,
            rule_version=r_version,
            score=score,
            reason=reason,
            evidence=evidence,
            entity_id=valid_ent_uuid,
            status="open",
            score_breakdown=score_breakdown,
        ))

        for txn_id in finding.get("transaction_ids", []):
            alert_txns_to_insert.append(AlertTransaction(
                alert_id=alert_id,
                transaction_id=int(txn_id),
            ))

        breakdown[r_id] = breakdown.get(r_id, 0) + 1

    # Bulk insert alerts and transactions
    if alerts_to_insert:
        db.add_all(alerts_to_insert)
        db.commit()

    if alert_txns_to_insert:
        db.add_all(alert_txns_to_insert)
        db.commit()

    return {
        "alerts_created": len(alerts_to_insert),
        "breakdown": breakdown,
    }


@celery_app.task(name="tasks.detect")
def run_detectors(batch_id: Optional[str] = None, rules: Optional[List[str]] = None) -> Dict[str, Any]:
    """Celery background task for running fraud detectors."""
    db: Session = SessionLocal()
    try:
        res = execute_detection(db, batch_id=batch_id, rules=rules)
        return {"status": "SUCCESS", **res}
    except Exception as e:
        logger.error(f"Detection task failed: {e}")
        return {"status": "FAILURE", "error": str(e)}
    finally:
        db.close()
