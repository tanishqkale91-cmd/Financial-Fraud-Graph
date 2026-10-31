"""models/provenance.py — provenance table."""
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import BigInteger, Text, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Provenance(Base):
    __tablename__ = "provenance"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    record_type: Mapped[str] = mapped_column(Text, nullable=False)  # raw_record|entity|transaction
    record_id: Mapped[str] = mapped_column(Text, nullable=False)
    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("import_batches.id"), nullable=False)
    source_file: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_row: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    step: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
