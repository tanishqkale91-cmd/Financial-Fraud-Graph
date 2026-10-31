"""models/transaction.py — transactions table."""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import BigInteger, Text, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("import_batches.id"), nullable=False)
    raw_record_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("raw_records.id"), nullable=True)
    txn_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    from_entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    to_entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(Text, nullable=False, default="USD")
    payment_format: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    device_entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=True)
    ip: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    label_laundering: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
