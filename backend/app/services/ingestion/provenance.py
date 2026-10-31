"""
provenance.py — Audit and data provenance logging.
"""
import uuid
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.models.provenance import Provenance


def log(
    db: Session,
    record_type: str,
    record_id: str,
    batch_id: uuid.UUID,
    step: str,
    detail: Optional[Dict[str, Any]] = None,
    source_file: Optional[str] = None,
    source_row: Optional[int] = None,
) -> Provenance:
    """Record a provenance trace entry."""
    entry = Provenance(
        record_type=record_type,
        record_id=str(record_id),
        batch_id=batch_id,
        source_file=source_file,
        source_row=source_row,
        step=step,
        detail=detail or {},
    )
    db.add(entry)
    return entry


def bulk_log(
    db: Session,
    entries: List[Dict[str, Any]],
) -> None:
    """Bulk insert provenance trace entries."""
    if not entries:
        return
    db.bulk_insert_mappings(Provenance, entries)


def get_provenance(
    db: Session,
    batch_id: uuid.UUID,
    record_type: Optional[str] = None,
    record_id: Optional[str] = None,
) -> List[Provenance]:
    """Retrieve provenance history for a batch and optional record filter."""
    query = db.query(Provenance).filter(Provenance.batch_id == batch_id)
    if record_type:
        query = query.filter(Provenance.record_type == record_type)
    if record_id:
        query = query.filter(Provenance.record_id == str(record_id))
    return query.order_by(Provenance.id.asc()).all()
