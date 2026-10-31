"""
schema_mapper.py — maps any supported CSV format to our internal column names.

We support two schemas:
  "native"  — output of our own generate_data.py
  "ibm_aml" — IBM HI-Small AML dataset (with enriched columns)

The mapper returns a clean DataFrame with these exact columns:
  txn_id, sender_id, receiver_id, amount, currency,
  timestamp, pattern, source_file, source_row,
  sender_name, sender_device, sender_phone, sender_ip,
  beneficiary_id, beneficiary_name
"""

import pandas as pd
import uuid


def _new_id() -> str:
    return str(uuid.uuid4())[:12]


# ── IBM AML mapping ────────────────────────────────────────────────────────────
# IBM node identity rule: "{bank}_{account}"
def _ibm_node_id(bank: pd.Series, account: pd.Series) -> pd.Series:
    return bank.astype(str) + "_" + account.astype(str)


def map_ibm_aml(df: pd.DataFrame) -> pd.DataFrame:
    """
    Map IBM HI-Small (enriched) columns to our internal schema.
    Node ID = f"{bank}_{account}" as required by architecture rules.
    """
    out = pd.DataFrame()

    # Unique transaction ID (IBM has none — generate one)
    out["txn_id"] = [_new_id() for _ in range(len(df))]

    # Node identities
    out["sender_id"]   = _ibm_node_id(df["From Bank"], df["Account"])
    out["receiver_id"] = _ibm_node_id(df["To Bank"],   df["Account.1"])

    # Amount — use Amount Paid as the "sent" amount
    out["amount"]   = df["Amount Paid"]
    out["currency"] = df["Payment Currency"].str.strip()

    # Timestamp — IBM format is "DD-MM-YYYY HH:MM"
    out["timestamp"] = pd.to_datetime(df["Timestamp"], format="%d-%m-%Y %H:%M", errors="coerce")

    # Ground truth label from IBM
    out["pattern"] = df["Is Laundering"].map({1: "LAUNDERING", 0: "NORMAL"})

    # Provenance
    out["source_file"] = df.get("source_file", pd.Series(["HI-Small_50k_enriched.csv"] * len(df)))
    out["source_row"]  = df.get("source_row",  pd.Series(range(len(df))))

    # Enriched fields (synthesized in the enriched CSV)
    out["sender_name"]      = df.get("Sender_name",      pd.Series([None] * len(df)))
    out["sender_device"]    = df.get("Sender_device",    pd.Series([None] * len(df)))
    out["sender_phone"]     = df.get("Sender_phone",     pd.Series([None] * len(df))).astype(str)
    out["sender_ip"]        = df.get("Sender_ip",        pd.Series([None] * len(df)))
    out["beneficiary_id"]   = df.get("Beneficiary_id",   pd.Series([None] * len(df)))
    out["beneficiary_name"] = df.get("Beneficiary_name", pd.Series([None] * len(df)))
    out["payment_format"]   = df.get("Payment Format",   pd.Series([None] * len(df)))

    return out


# ── Native (generate_data.py) mapping ─────────────────────────────────────────
def map_native(df: pd.DataFrame) -> pd.DataFrame:
    """
    Our own CSV already uses internal names — just normalise and add empty enriched cols.
    """
    out = df.rename(columns={"txn_id": "txn_id"}).copy()

    out["timestamp"] = pd.to_datetime(out["timestamp"], errors="coerce")

    # Add enriched columns with None if not present
    for col in ["sender_name", "sender_device", "sender_phone",
                "sender_ip", "beneficiary_id", "beneficiary_name", "payment_format"]:
        if col not in out.columns:
            out[col] = None

    return out


# ── Public entry point ─────────────────────────────────────────────────────────
SCHEMA_MAP = {
    "ibm_aml": map_ibm_aml,
    "native":  map_native,
}


def detect_schema(df: pd.DataFrame) -> str:
    """
    Auto-detect the schema by looking at column names.
    Returns 'ibm_aml' or 'native'.
    """
    if "From Bank" in df.columns and "Account.1" in df.columns:
        return "ibm_aml"
    if "txn_id" in df.columns and "sender_id" in df.columns:
        return "native"
    raise ValueError(
        f"Cannot detect schema. Columns found: {list(df.columns)[:8]} ..."
    )


def apply_schema(df: pd.DataFrame, schema: str | None = None) -> tuple[pd.DataFrame, str]:
    """
    Apply the column mapping.
    If schema is None, auto-detect it.
    Returns (mapped_df, schema_name).
    """
    if schema is None:
        schema = detect_schema(df)
    if schema not in SCHEMA_MAP:
        raise ValueError(f"Unknown schema '{schema}'. Valid: {list(SCHEMA_MAP)}")
    mapped = SCHEMA_MAP[schema](df)
    return mapped, schema
