"""
ingest_task.py — Celery tasks for dataset ingestion.
"""
import uuid
from pathlib import Path
from typing import Dict, Any, List
import pandas as pd
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.db import SessionLocal
from app.models.batch import ImportBatch
from app.models.raw_record import RawRecord
from app.models.entity import Entity
from app.models.alias import EntityAlias
from app.models.transaction import Transaction
from app.models.provenance import Provenance
from app.services.ingestion.mapping import apply_mapping
from app.services.ingestion.validation import validate
from app.services.ingestion.entity_resolution import (
    normalise_phone,
    normalise_account,
    resolve_beneficiary,
    get_or_create_entity,
    pd_isna,
)


@celery_app.task(name="app.tasks.ingest_task.ping")
def ping() -> str:
    """Health check task returning 'pong'."""
    return "pong"


@celery_app.task(name="app.tasks.ingest_task.run_ingest")
def run_ingest(batch_id_str: str) -> Dict[str, Any]:
    """
    Execute background ingestion job for a batch:
    1. Read uploaded CSV
    2. Apply schema mapping
    3. Validate rows
    4. Save raw_records
    5. Resolve entities (accounts, devices, phones, beneficiaries)
    6. Insert transactions in chunks of 5000
    7. Write provenance records
    8. Update batch status to done
    """
    db: Session = SessionLocal()
    try:
        batch_id = uuid.UUID(batch_id_str)
        batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
        if not batch:
            return {"error": f"Batch {batch_id_str} not found"}

        batch.status = "running"
        db.commit()

        # Locate upload file
        uploads_dir = Path(__file__).resolve().parents[3] / "data" / "processed" / "uploads"
        file_path = uploads_dir / f"{batch_id}.csv"
        if not file_path.exists():
            batch.status = "failed"
            db.commit()
            return {"error": f"File {file_path} not found"}

        df_raw = pd.read_csv(file_path, dtype=str)

        # Apply mapping
        mapped_df = apply_mapping(df_raw, batch.mapping or {})

        # Validate
        valid_df, report = validate(mapped_df)

        # 1. Bulk insert raw_records in chunks
        raw_records_to_insert = []
        for idx, row in mapped_df.iterrows():
            is_valid = bool(row.get("_is_valid", True))
            errs = row.get("_errors", [])
            raw_records_to_insert.append({
                "batch_id": batch_id,
                "row_number": idx + 1,
                "raw": {k: v for k, v in row.items() if not k.startswith("_")},
                "is_valid": is_valid,
                "errors": errs,
            })

        for i in range(0, len(raw_records_to_insert), 5000):
            chunk = raw_records_to_insert[i : i + 5000]
            db.bulk_insert_mappings(RawRecord, chunk)
        db.commit()

        # Query raw_record ids mapped by row_number
        raw_ids_map = dict(
            db.query(RawRecord.row_number, RawRecord.id)
            .filter(RawRecord.batch_id == batch_id)
            .all()
        )

        # 2. Entity Resolution & In-memory cache for speed
        # Cache existing entities: (entity_type, canonical_key) -> entity_id
        entity_cache = {
            (e.entity_type, e.canonical_key): e.id
            for e in db.query(Entity).all()
        }

        # Cache beneficiaries for fuzzy resolution: canonical_key -> (id, display_name)
        beneficiary_cache = {
            e.canonical_key: (e.id, e.display_name or e.canonical_key)
            for e in db.query(Entity).filter(Entity.entity_type == "beneficiary").all()
        }

        def get_or_create_cached(etype: str, ckey: str, disp: str = "") -> uuid.UUID:
            key = (etype, ckey)
            if key in entity_cache:
                return entity_cache[key]
            new_id = uuid.uuid4()
            ent = Entity(
                id=new_id,
                entity_type=etype,
                canonical_key=ckey,
                display_name=disp or ckey,
                attributes={},
            )
            db.add(ent)
            entity_cache[key] = new_id
            if etype == "beneficiary":
                beneficiary_cache[ckey] = (new_id, disp or ckey)
            return new_id

        # 3. Process valid transactions
        txns_to_insert = []
        provenance_to_insert = []
        aliases_to_insert = []

        for idx, row in valid_df.iterrows():
            row_num = idx + 1
            raw_rec_id = raw_ids_map.get(row_num)

            # Accounts
            from_acct = normalise_account(row.get("from_account", ""))
            to_acct = normalise_account(row.get("to_account", ""))
            from_ent_id = get_or_create_cached("account", from_acct)
            to_ent_id = get_or_create_cached("account", to_acct)

            # Device
            dev_id_val = row.get("device_id")
            dev_ent_id = None
            if not pd_isna(dev_id_val) and str(dev_id_val).strip():
                dev_clean = str(dev_id_val).strip()
                dev_ent_id = get_or_create_cached("device", dev_clean)

            # Phone
            phone_val = row.get("phone")
            if not pd_isna(phone_val):
                norm_p = normalise_phone(phone_val)
                if norm_p:
                    get_or_create_cached("phone", norm_p)

            # Beneficiary resolution
            ben_name = row.get("beneficiary_name")
            if not pd_isna(ben_name) and str(ben_name).strip():
                raw_ben = str(ben_name).strip()
                matched_id, score, reason = resolve_beneficiary(raw_ben, beneficiary_cache)
                if matched_id:
                    aliases_to_insert.append({
                        "entity_id": matched_id,
                        "alias_value": raw_ben,
                        "alias_type": "name",
                        "match_score": score,
                        "match_reason": reason,
                        "batch_id": batch_id,
                    })
                else:
                    get_or_create_cached("beneficiary", raw_ben, raw_ben)

            # Cleaned values
            txn_ts = row.get("_parsed_ts")
            amount = row.get("_cleaned_amount")
            curr = str(row.get("currency") or "USD").strip()
            pmt_fmt = row.get("payment_format")
            ip_val = row.get("ip")

            # Label laundering
            is_laundering = None
            raw_lbl = row.get("is_laundering") or row.get("Is Laundering")
            if not pd_isna(raw_lbl):
                is_laundering = str(raw_lbl).strip() in ("1", "1.0", "True", "true")

            txns_to_insert.append({
                "batch_id": batch_id,
                "raw_record_id": raw_rec_id,
                "txn_ts": txn_ts,
                "from_entity_id": from_ent_id,
                "to_entity_id": to_ent_id,
                "amount": amount,
                "currency": curr,
                "payment_format": str(pmt_fmt).strip() if not pd_isna(pmt_fmt) else None,
                "device_entity_id": dev_ent_id,
                "ip": str(ip_val).strip() if not pd_isna(ip_val) else None,
                "label_laundering": is_laundering,
            })

            # Record provenance steps for this transaction
            provenance_to_insert.append({
                "record_type": "transaction",
                "record_id": str(row_num),
                "batch_id": batch_id,
                "source_file": batch.filename,
                "source_row": row_num,
                "step": "ingested",
                "detail": {"raw_row": row_num},
            })
            provenance_to_insert.append({
                "record_type": "transaction",
                "record_id": str(row_num),
                "batch_id": batch_id,
                "source_file": batch.filename,
                "source_row": row_num,
                "step": "validated",
                "detail": {"is_valid": True, "amount": float(amount) if amount else None},
            })
            provenance_to_insert.append({
                "record_type": "transaction",
                "record_id": str(row_num),
                "batch_id": batch_id,
                "source_file": batch.filename,
                "source_row": row_num,
                "step": "loaded",
                "detail": {"from_account": from_acct, "to_account": to_acct},
            })

        # Commit entities before inserting transactions
        db.commit()

        # Insert aliases
        if aliases_to_insert:
            for i in range(0, len(aliases_to_insert), 5000):
                db.bulk_insert_mappings(EntityAlias, aliases_to_insert[i : i + 5000])
            db.commit()

        # Insert transactions in chunks of 5000
        for i in range(0, len(txns_to_insert), 5000):
            chunk = txns_to_insert[i : i + 5000]
            db.bulk_insert_mappings(Transaction, chunk)
        db.commit()

        # Insert provenance in chunks of 5000
        for i in range(0, len(provenance_to_insert), 5000):
            chunk = provenance_to_insert[i : i + 5000]
            db.bulk_insert_mappings(Provenance, chunk)
        db.commit()

        # Final batch updates
        batch.row_count = report["total"]
        batch.valid_count = report["valid"]
        batch.invalid_count = report["invalid"]
        mapping_data = batch.mapping or {}
        mapping_data["_report"] = report
        batch.mapping = mapping_data
        batch.status = "done"
        db.commit()

        return {
            "status": "done",
            "batch_id": batch_id_str,
            "row_count": report["total"],
            "valid_count": report["valid"],
            "invalid_count": report["invalid"],
        }
    except Exception as e:
        db.rollback()
        try:
            batch.status = "failed"
            db.commit()
        except Exception:
            pass
        return {"error": str(e), "batch_id": batch_id_str}
    finally:
        db.close()
