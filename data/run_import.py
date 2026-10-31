"""
run_import.py — Standalone script to import a CSV into Postgres.

Bypasses FastAPI and Celery — calls the service layer directly.
Useful for dev: run this once to seed the database.

Usage:
    python data/run_import.py <path_to_csv> [schema]

Examples:
    python data/run_import.py "data/transactions.csv"
    python data/run_import.py "Downloads/HI-Small_50k_enriched.csv" ibm_aml

The script:
  1. Reads the CSV with Pandas
  2. Auto-detects or uses the given schema
  3. Validates rows (drops bad ones, warns you)
  4. Bulk-inserts into Postgres
  5. Prints a summary

Requirements: Postgres must be running (via docker compose up postgres).
"""

import sys
import os
import time
from pathlib import Path

# Make sure Python can find the backend app package
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

# Load .env before importing config (pydantic-settings reads it)
from dotenv import load_dotenv
load_dotenv(REPO_ROOT / ".env")

import pandas as pd

from app.core.db import SessionLocal, engine, Base
import app.models  # registers ORM models with Base
from app.services.ingestion.schema_mapper import apply_schema
from app.services.ingestion.validator import validate
from app.services.ingestion.importer import run_import


def main():
    if len(sys.argv) < 2:
        print("Usage: python data/run_import.py <csv_path> [schema]")
        print("  schema: auto (default), native, ibm_aml")
        sys.exit(1)

    csv_path = Path(sys.argv[1])
    schema   = sys.argv[2] if len(sys.argv) > 2 else "auto"

    if not csv_path.exists():
        print(f"ERROR: File not found: {csv_path}")
        sys.exit(1)

    print("=" * 60)
    print(f"Financial Fraud Graph — CSV Importer")
    print(f"  File   : {csv_path}")
    print(f"  Schema : {schema}")
    print("=" * 60)

    # ── Step 1: Create tables if they don't exist ──────────────────────────────
    print("\n[1/4] Ensuring Postgres tables exist...")
    Base.metadata.create_all(bind=engine)
    print("  OK")

    # ── Step 2: Read CSV ───────────────────────────────────────────────────────
    print(f"\n[2/4] Reading CSV ({csv_path.name})...")
    t0 = time.time()
    df_raw = pd.read_csv(csv_path)
    print(f"  {len(df_raw):,} rows read in {time.time()-t0:.1f}s")

    # ── Step 3: Schema mapping + validation ────────────────────────────────────
    print("\n[3/4] Mapping schema + validating...")
    schema_arg = None if schema == "auto" else schema
    df_mapped, detected = apply_schema(df_raw, schema=schema_arg)
    print(f"  Schema detected: {detected}")

    result = validate(df_mapped, source_file=csv_path.name)

    print(f"  Total rows  : {result.stats['total']:>7,}")
    print(f"  Valid rows  : {result.stats['valid']:>7,}")
    if result.errors:
        print("  Issues found:")
        for e in result.errors:
            print(f"    - {e}")

    if result.stats["valid"] == 0:
        print("\nERROR: No valid rows to import. Aborting.")
        sys.exit(1)

    # ── Step 4: Insert into Postgres ───────────────────────────────────────────
    print(f"\n[4/4] Inserting into Postgres (this may take a moment)...")
    t0 = time.time()
    db = SessionLocal()
    try:
        summary = run_import(result.clean_df, source_file=csv_path.name, db=db)
    finally:
        db.close()

    elapsed = time.time() - t0
    print(f"  Inserted : {summary['inserted_transactions']:,} transactions")
    print(f"  Time     : {elapsed:.1f}s")

    print("\n" + "=" * 60)
    print("IMPORT COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
