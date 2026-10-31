"""
api/ingestion.py — FastAPI routes for CSV ingestion, mapping, validation, and provenance.
"""
import uuid
import io
import shutil
from pathlib import Path
from typing import Optional, List, Dict, Any

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.batch import ImportBatch
from app.models.provenance import Provenance
from app.schemas.ingestion import (
    UploadResponse,
    MappingRequest,
    MappingResponse,
    TemplateCreate,
    TemplateResponse,
    RunResponse,
    BatchStatusResponse,
    ProvenanceItem,
)
from app.services.ingestion.mapping import (
    suggest_mapping,
    get_templates,
    save_template,
)
from app.tasks.ingest_task import run_ingest

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])

UPLOADS_DIR = Path(__file__).resolve().parents[3] / "data" / "processed" / "uploads"


@router.post("/upload", response_model=UploadResponse)
def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a CSV file, save to data/processed/uploads/<batch_id>.csv,
    create an import_batches row with status='pending', and return preview + suggested mapping.
    """
    batch_id = uuid.uuid4()
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    target_path = UPLOADS_DIR / f"{batch_id}.csv"

    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {e}")

    try:
        df_preview = pd.read_csv(target_path, nrows=5, dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse CSV file: {e}")

    columns = list(df_preview.columns)
    sample_rows = df_preview.fillna("").to_dict(orient="records")
    suggested = suggest_mapping(columns)

    batch = ImportBatch(
        id=batch_id,
        filename=file.filename or f"{batch_id}.csv",
        status="pending",
        mapping=suggested,
    )
    db.add(batch)
    db.commit()

    return UploadResponse(
        batch_id=str(batch_id),
        filename=file.filename or f"{batch_id}.csv",
        columns=columns,
        sample_rows=sample_rows,
        suggested_mapping=suggested,
    )


@router.post("/{batch_id}/mapping", response_model=MappingResponse)
def set_mapping(
    batch_id: uuid.UUID,
    payload: MappingRequest,
    db: Session = Depends(get_db),
):
    """Save column mapping configuration for a batch."""
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch.mapping = payload.mapping
    db.commit()

    return MappingResponse(
        batch_id=str(batch.id),
        status=batch.status,
        mapping=batch.mapping,
    )


@router.get("/mappings/templates", response_model=List[TemplateResponse])
def list_templates():
    """List reusable schema mapping templates."""
    return get_templates()


@router.post("/mappings/templates", response_model=TemplateResponse)
def create_template(payload: TemplateCreate):
    """Create a new reusable schema mapping template."""
    return save_template(payload.name, payload.mapping)


@router.post("/{batch_id}/run", response_model=RunResponse)
def start_ingest_job(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Trigger background Celery ingestion job for a batch."""
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    task_id = str(uuid.uuid4())
    try:
        # Enqueue with Celery
        async_result = run_ingest.delay(str(batch_id))
        task_id = async_result.id
    except Exception:
        # Fallback to direct synchronous execution if worker broker is offline
        run_ingest(str(batch_id))

    return RunResponse(
        task_id=task_id,
        batch_id=str(batch_id),
    )


@router.get("/{batch_id}", response_model=BatchStatusResponse)
def get_batch_status(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Get status, row counts, and validation report for a batch."""
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    report = None
    if batch.mapping and "_report" in batch.mapping:
        report = batch.mapping["_report"]

    return BatchStatusResponse(
        batch_id=str(batch.id),
        status=batch.status,
        row_count=batch.row_count,
        valid_count=batch.valid_count,
        invalid_count=batch.invalid_count,
        report=report,
    )


@router.get("/{batch_id}/provenance", response_model=List[ProvenanceItem])
def get_batch_provenance(
    batch_id: uuid.UUID,
    record_type: Optional[str] = Query(None),
    record_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Query provenance audit trail for a batch."""
    query = db.query(Provenance).filter(Provenance.batch_id == batch_id)
    if record_type:
        query = query.filter(Provenance.record_type == record_type)
    if record_id:
        query = query.filter(Provenance.record_id == str(record_id))

    logs = query.order_by(Provenance.id.asc()).limit(100).all()

    return [
        ProvenanceItem(
            step=l.step,
            detail=l.detail,
            created_at=l.created_at.isoformat() if l.created_at else None,
        )
        for l in logs
    ]
