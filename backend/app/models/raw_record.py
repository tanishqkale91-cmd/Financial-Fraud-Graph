"""models/raw_record.py — raw_records table."""
import uuid
from typing import Optional, Dict, Any, List
from sqlalchemy import BigInteger, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class RawRecord(Base):
    __tablename__ = "raw_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("import_batches.id"), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    raw: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False)
    errors: Mapped[Optional[List[Any]]] = mapped_column(JSONB, nullable=True)
