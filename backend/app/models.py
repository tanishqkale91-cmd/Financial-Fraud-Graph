"""
models.py — All PostgreSQL tables as SQLAlchemy ORM classes.

ORM (Object-Relational Mapping): instead of writing raw SQL, you define a
Python class and SQLAlchemy handles the CREATE TABLE / SELECT / INSERT for you.
Each class = one table; each class attribute = one column.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    String, Float, DateTime, Boolean, Text, Integer,
    ForeignKey, JSON, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def new_uuid() -> str:
    """Generate a UUID string (primary key default)."""
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# accounts
# ---------------------------------------------------------------------------
class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(256))
    bank: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    device_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # back-references (not stored in DB, just Python convenience)
    sent_txns: Mapped[List["Transaction"]] = relationship(
        "Transaction", foreign_keys="Transaction.sender_id", back_populates="sender"
    )
    recv_txns: Mapped[List["Transaction"]] = relationship(
        "Transaction", foreign_keys="Transaction.receiver_id", back_populates="receiver"
    )


# ---------------------------------------------------------------------------
# transactions  (source of truth for all money movement)
# ---------------------------------------------------------------------------
class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_uuid)
    sender_id: Mapped[str] = mapped_column(String(64), ForeignKey("accounts.id"))
    receiver_id: Mapped[str] = mapped_column(String(64), ForeignKey("accounts.id"))
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    timestamp: Mapped[datetime] = mapped_column(DateTime)
    pattern: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # ground truth

    # provenance — where this row came from
    source_file: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    source_row: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    sender: Mapped["Account"] = relationship(
        "Account", foreign_keys=[sender_id], back_populates="sent_txns"
    )
    receiver: Mapped["Account"] = relationship(
        "Account", foreign_keys=[receiver_id], back_populates="recv_txns"
    )


# ---------------------------------------------------------------------------
# alerts
# ---------------------------------------------------------------------------
class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_uuid)
    rule: Mapped[str] = mapped_column(String(64))          # e.g. "CIRCULAR_TRANSFER"
    reason: Mapped[str] = mapped_column(Text)              # plain-English explanation
    evidence_txn_ids: Mapped[list] = mapped_column(JSON)   # list of transaction IDs
    severity: Mapped[str] = mapped_column(String(16), default="MEDIUM")  # LOW/MEDIUM/HIGH
    status: Mapped[str] = mapped_column(String(16), default="OPEN")      # OPEN/IN_REVIEW/CLOSED
    anomaly_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    feedback: Mapped[List["Feedback"]] = relationship("Feedback", back_populates="alert")


# ---------------------------------------------------------------------------
# cases  (human-opened investigation)
# ---------------------------------------------------------------------------
class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(256))
    analyst: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="OPEN")  # OPEN/CLOSED
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # auto-generated
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    alert_links: Mapped[List["CaseAlert"]] = relationship("CaseAlert", back_populates="case")
    decisions: Mapped[List["Decision"]] = relationship("Decision", back_populates="case")


# ---------------------------------------------------------------------------
# case_alerts  (many-to-many: one case can hold many alerts)
# ---------------------------------------------------------------------------
class CaseAlert(Base):
    __tablename__ = "case_alerts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_uuid)
    case_id: Mapped[str] = mapped_column(String(64), ForeignKey("cases.id"))
    alert_id: Mapped[str] = mapped_column(String(64), ForeignKey("alerts.id"))

    case: Mapped["Case"] = relationship("Case", back_populates="alert_links")
    alert: Mapped["Alert"] = relationship("Alert")


# ---------------------------------------------------------------------------
# decisions  (analyst verdict on a case)
# ---------------------------------------------------------------------------
class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_uuid)
    case_id: Mapped[str] = mapped_column(String(64), ForeignKey("cases.id"))
    analyst: Mapped[str] = mapped_column(String(128))
    verdict: Mapped[str] = mapped_column(String(32))   # e.g. "CONFIRMED_FRAUD", "FALSE_POSITIVE"
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    case: Mapped["Case"] = relationship("Case", back_populates="decisions")


# ---------------------------------------------------------------------------
# feedback  (analyst marks an alert as false positive → lowers rule weight)
# ---------------------------------------------------------------------------
class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_uuid)
    alert_id: Mapped[str] = mapped_column(String(64), ForeignKey("alerts.id"))
    analyst: Mapped[str] = mapped_column(String(128))
    is_false_positive: Mapped[bool] = mapped_column(Boolean)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    alert: Mapped["Alert"] = relationship("Alert", back_populates="feedback")


# ---------------------------------------------------------------------------
# rule_weights  (adjusted by feedback to soften noisy rules)
# ---------------------------------------------------------------------------
class RuleWeight(Base):
    __tablename__ = "rule_weights"

    rule_name: Mapped[str] = mapped_column(String(64), primary_key=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0)


# ---------------------------------------------------------------------------
# provenance_log  (every import / transformation is logged here)
# ---------------------------------------------------------------------------
class ProvenanceLog(Base):
    __tablename__ = "provenance_log"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_uuid)
    operation: Mapped[str] = mapped_column(String(64))      # e.g. "CSV_IMPORT"
    source_file: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    row_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
