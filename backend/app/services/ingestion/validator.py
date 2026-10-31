"""
validator.py — Pandas-based validation for the mapped (internal-schema) DataFrame.

Returns a ValidationResult with:
  - clean_df  : rows that passed all checks
  - errors    : list of human-readable problem descriptions
  - stats     : counts (total, valid, dropped)

Pandas concept: a DataFrame is like a 2-D table.
  df.dropna()  → remove rows with missing values
  df.duplicated() → boolean mask; True where the row is a duplicate
  df[mask]     → filter rows by a boolean mask (like WHERE in SQL)
"""

from dataclasses import dataclass, field
from datetime import datetime

import pandas as pd


@dataclass
class ValidationResult:
    clean_df: pd.DataFrame
    errors: list[str] = field(default_factory=list)
    stats: dict = field(default_factory=dict)


REQUIRED_COLUMNS = [
    "txn_id", "sender_id", "receiver_id",
    "amount", "currency", "timestamp",
]


def validate(df: pd.DataFrame, source_file: str = "unknown") -> ValidationResult:
    """
    Run all validation checks on a mapped DataFrame.
    Drops bad rows and collects error descriptions.
    """
    errors: list[str] = []
    total = len(df)

    # 1. Required columns present?
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns after mapping: {missing_cols}")

    # 2. Drop rows where required fields are null
    before = len(df)
    df = df.dropna(subset=REQUIRED_COLUMNS)
    dropped_nulls = before - len(df)
    if dropped_nulls:
        errors.append(f"{dropped_nulls} rows dropped: missing required fields.")

    # 3. Amount must be positive
    before = len(df)
    df = df[df["amount"] > 0]
    dropped_amount = before - len(df)
    if dropped_amount:
        errors.append(f"{dropped_amount} rows dropped: amount <= 0.")

    # 4. Timestamp must be valid (NaT = failed to parse)
    before = len(df)
    df = df[df["timestamp"].notna()]
    dropped_ts = before - len(df)
    if dropped_ts:
        errors.append(f"{dropped_ts} rows dropped: unparseable timestamp.")

    # 5. Timestamp must not be in the future (more than 1 day ahead)
    now = pd.Timestamp(datetime.utcnow())
    before = len(df)
    df = df[df["timestamp"] <= now + pd.Timedelta(days=1)]
    dropped_future = before - len(df)
    if dropped_future:
        errors.append(f"{dropped_future} rows dropped: timestamp in the future.")

    # 6. Duplicate txn_id — keep first occurrence
    before = len(df)
    df = df[~df["txn_id"].duplicated(keep="first")]
    dropped_dupes = before - len(df)
    if dropped_dupes:
        errors.append(f"{dropped_dupes} rows dropped: duplicate txn_id.")

    # 7. Self-loops (sender == receiver) — warn but keep
    self_loops = (df["sender_id"] == df["receiver_id"]).sum()
    if self_loops:
        errors.append(f"WARNING: {self_loops} transactions where sender == receiver (kept).")

    stats = {
        "total":          total,
        "valid":          len(df),
        "dropped_nulls":  dropped_nulls,
        "dropped_amount": dropped_amount,
        "dropped_ts":     dropped_ts,
        "dropped_future": dropped_future,
        "dropped_dupes":  dropped_dupes,
        "self_loops":     int(self_loops),
        "source_file":    source_file,
    }

    return ValidationResult(clean_df=df, errors=errors, stats=stats)
