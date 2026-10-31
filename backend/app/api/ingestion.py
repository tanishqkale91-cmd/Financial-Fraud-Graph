"""
api/ingestion.py — FastAPI routes for CSV import.

POST /api/ingest/upload  → upload a CSV file (multipart/form-data)
GET  /api/ingest/status  → list provenance log entries
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
import pandas as pd
import io

from app.core.db import get_db
from app.models import ProvenanceLog
from app.services.ingestion.schema_mapper import apply_schema
from app.services.ingestion.validator import validate
from app.services.ingestion.importer import run_import

router = APIRouter(prefix="/api/ingest", tags=["ingestion"])


@router.post("/upload")
def upload_csv(
    file: UploadFile = File(...),
    schema: str = Form(default="auto"),   # "auto", "native", or "ibm_aml"
    db: Session = Depends(get_db),
):
    """
    Upload a CSV file and import it into PostgreSQL.
    - schema: which column mapping to use ('auto' lets us detect it)
    - Returns validation stats + insert counts
    """
    # 1. Read uploaded bytes into a DataFrame
    try:
        contents = file.file.read()
        df_raw = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read CSV: {e}")

    # 2. Apply schema mapping
    schema_arg = None if schema == "auto" else schema
    try:
        df_mapped, detected_schema = apply_schema(df_raw, schema=schema_arg)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # 3. Validate
    result = validate(df_mapped, source_file=file.filename or "upload")

    # 4. Import clean rows into Postgres
    try:
        import_summary = run_import(result.clean_df, source_file=file.filename or "upload", db=db)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {e}")

    return {
        "schema_detected":  detected_schema,
        "validation_stats": result.stats,
        "validation_errors": result.errors,
        "import":           import_summary,
    }


@router.get("/status")
def list_imports(db: Session = Depends(get_db)):
    """Return the last 50 provenance log entries."""
    logs = (
        db.query(ProvenanceLog)
        .order_by(ProvenanceLog.ts.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id":          l.id,
            "operation":   l.operation,
            "source_file": l.source_file,
            "row_count":   l.row_count,
            "notes":       l.notes,
            "ts":          l.ts.isoformat() if l.ts else None,
        }
        for l in logs
    ]
