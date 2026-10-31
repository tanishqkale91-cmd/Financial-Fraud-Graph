"""
importer.py — Writes validated transaction + account data into PostgreSQL.

Uses SQLAlchemy bulk inserts (much faster than inserting one row at a time).
Also writes a ProvenanceLog entry so we know what file was loaded and when.

Key idea: we extract unique accounts from the transaction rows,
upsert them (INSERT … ON CONFLICT DO NOTHING), then insert the transactions.
"""

import uuid
from datetime import datetime

import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models import Entity, Transaction, Provenance


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _upsert_accounts(df: pd.DataFrame, db: Session) -> None:
    """
    Extract unique accounts from sender/receiver columns and upsert into DB.
    'Upsert' = insert if not exists, skip if already there (ON CONFLICT DO NOTHING).
    """
    # Build a set of (id, name, device, phone) from both sides
    senders = df[["sender_id"]].rename(columns={"sender_id": "id"})
    senders["name"]      = df.get("sender_name",   pd.Series([None] * len(df))).values
    senders["device_id"] = df.get("sender_device", pd.Series([None] * len(df))).values
    senders["phone"]     = df.get("sender_phone",  pd.Series([None] * len(df))).values

    receivers = df[["receiver_id"]].rename(columns={"receiver_id": "id"})
    receivers["name"]      = df.get("beneficiary_name", pd.Series([None] * len(df))).values
    receivers["device_id"] = None
    receivers["phone"]     = None

    all_accs = pd.concat([senders, receivers], ignore_index=True)
    all_accs = all_accs.drop_duplicates(subset=["id"])
    all_accs = all_accs[all_accs["id"].notna()]

    records = all_accs.to_dict("records")

    if not records:
        return

    stmt = pg_insert(Account).values(records)
    stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
    db.execute(stmt)


def _insert_transactions(df: pd.DataFrame, db: Session) -> int:
    """
    Bulk-insert transactions. Returns the count inserted.
    Skips any whose txn_id already exists (on conflict do nothing).
    """
    records = []
    for _, row in df.iterrows():
        records.append({
            "id":          row["txn_id"],
            "sender_id":   row["sender_id"],
            "receiver_id": row["receiver_id"],
            "amount":      float(row["amount"]),
            "currency":    str(row.get("currency", "USD")),
            "timestamp":   row["timestamp"].to_pydatetime() if hasattr(row["timestamp"], "to_pydatetime") else row["timestamp"],
            "pattern":     row.get("pattern", None),
            "source_file": row.get("source_file", None),
            "source_row":  int(row["source_row"]) if pd.notna(row.get("source_row")) else None,
        })

    if not records:
        return 0

    stmt = pg_insert(Transaction).values(records)
    stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
    db.execute(stmt)
    return len(records)


def _log_provenance(
    db: Session,
    operation: str,
    source_file: str,
    row_count: int,
    notes: str = "",
) -> None:
    log = ProvenanceLog(
        id=_new_uuid(),
        operation=operation,
        source_file=source_file,
        row_count=row_count,
        notes=notes,
    )
    db.add(log)


def run_import(
    df: pd.DataFrame,
    source_file: str,
    db: Session,
) -> dict:
    """
    Main entry point for ingestion.
    df must already be mapped + validated (clean_df from validator).
    Returns a summary dict.
    """
    print(f"[importer] Upserting accounts...")
    _upsert_accounts(df, db)

    print(f"[importer] Inserting {len(df)} transactions...")
    count = _insert_transactions(df, db)

    _log_provenance(db, "CSV_IMPORT", source_file, count, notes=f"schema auto-detected")

    db.commit()

    print(f"[importer] Done. {count} rows committed.")
    return {
        "inserted_transactions": count,
        "source_file": source_file,
        "timestamp": datetime.utcnow().isoformat(),
    }
