"""models/batch.py — import_batches table."""
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import Text, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")  # pending|running|done|failed
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    mapping: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    row_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    valid_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    invalid_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
