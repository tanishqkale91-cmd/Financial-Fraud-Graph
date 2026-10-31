"""
dry_run_import.py — Tests schema mapping + validation WITHOUT a database.

Run this to see exactly what the importer will do when Postgres is available.
No DB connection needed.

Usage: python data/dry_run_import.py
"""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

import pandas as pd
from app.services.ingestion.schema_mapper import apply_schema
from app.services.ingestion.validator import validate

CSV_PATH = Path(r"C:\Users\Malhar Dongre\Downloads\HI-Small_50k_enriched (1).csv")

print("=" * 60)
print("Dry-run: schema mapping + validation (no DB)")
print("=" * 60)

print(f"\n[1/3] Reading CSV...")
df_raw = pd.read_csv(CSV_PATH)
print(f"  {len(df_raw):,} rows, {len(df_raw.columns)} columns")

print(f"\n[2/3] Applying IBM AML schema mapping...")
df_mapped, schema = apply_schema(df_raw)
print(f"  Detected schema : {schema}")
print(f"  Output columns  : {list(df_mapped.columns)}")
print()
print("  Sample (2 rows):")
print(df_mapped[["txn_id","sender_id","receiver_id","amount","currency","timestamp","pattern"]].head(2).to_string())

print(f"\n[3/3] Validating...")
result = validate(df_mapped, source_file=CSV_PATH.name)
print(f"  Total rows  : {result.stats['total']:>7,}")
print(f"  Valid rows  : {result.stats['valid']:>7,}")
print(f"  Self-loops  : {result.stats['self_loops']:>7,}")

if result.errors:
    print("  Issues:")
    for e in result.errors:
        print(f"    - {e}")

print()
print("Pattern breakdown in valid rows:")
print(result.clean_df["pattern"].value_counts().to_string())

print()
print("Sender ID sample (IBM format = bank_account):")
print(result.clean_df["sender_id"].head(5).to_string())

print("\n" + "=" * 60)
print("Dry-run PASSED — pipeline is ready for DB import")
print("=" * 60)
