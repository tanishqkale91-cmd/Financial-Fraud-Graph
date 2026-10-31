"""schemas/ingestion.py — Pydantic schemas for ingestion endpoints."""
from pydantic import BaseModel
from typing import Dict, List, Any, Optional


class UploadResponse(BaseModel):
    batch_id: str
    filename: str
    columns: List[str]
    sample_rows: List[Dict[str, Any]]
    suggested_mapping: Dict[str, str]


class MappingRequest(BaseModel):
    mapping: Dict[str, str]


class MappingResponse(BaseModel):
    batch_id: str
    status: str
    mapping: Dict[str, str]


class TemplateCreate(BaseModel):
    name: str
    mapping: Dict[str, str]


class TemplateResponse(BaseModel):
    id: str
    name: str
    mapping: Dict[str, str]


class RunResponse(BaseModel):
    task_id: str
    batch_id: str


class BatchStatusResponse(BaseModel):
    batch_id: str
    status: str
    row_count: Optional[int] = None
    valid_count: Optional[int] = None
    invalid_count: Optional[int] = None
    report: Optional[Dict[str, Any]] = None


class ProvenanceItem(BaseModel):
    step: str
    detail: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
