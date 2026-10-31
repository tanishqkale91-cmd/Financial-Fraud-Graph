"""
mapping.py — Column mapping and templates for data ingestion.
"""
import json
import uuid
from pathlib import Path
from typing import Dict, List, Any
import pandas as pd

CANONICAL_FIELDS = [
    "txn_id",
    "timestamp",
    "from_account",
    "to_account",
    "amount",
    "currency",
    "payment_format",
    "device_id",
    "phone",
    "ip",
    "beneficiary_name",
]

REQUIRED_FIELDS = ["timestamp", "from_account", "to_account", "amount"]

TEMPLATES_FILE = Path(__file__).resolve().parents[4] / "data" / "mapping_templates.json"

DEFAULT_TEMPLATES = [
    {
        "id": "ibm_aml",
        "name": "IBM AML Dataset",
        "mapping": {
            "timestamp": "Timestamp",
            "from_account": "Account",
            "to_account": "Account.1",
            "amount": "Amount Paid",
            "currency": "Payment Currency",
            "payment_format": "Payment Format",
            "device_id": "sender_device",
            "phone": "sender_phone",
            "ip": "sender_ip",
            "beneficiary_name": "beneficiary_name",
        },
    },
    {
        "id": "native",
        "name": "Native Format",
        "mapping": {
            "txn_id": "txn_id",
            "timestamp": "timestamp",
            "from_account": "from_account",
            "to_account": "to_account",
            "amount": "amount",
            "currency": "currency",
            "payment_format": "payment_format",
            "device_id": "device_id",
            "phone": "phone",
            "ip": "ip",
            "beneficiary_name": "beneficiary_name",
        },
    },
]


def _clean_str(s: str) -> str:
    return s.lower().replace(" ", "").replace("_", "").replace("-", "").replace(".", "")


def suggest_mapping(columns: List[str]) -> Dict[str, str]:
    """Suggest canonical-to-source mapping based on column names."""
    candidates = {
        "timestamp": ["timestamp", "date", "datetime", "time", "txnts"],
        "from_account": ["account", "fromaccount", "sender", "senderid", "senderaccount", "from"],
        "to_account": ["account1", "toaccount", "receiver", "receiverid", "beneficiaryaccount", "to"],
        "amount": ["amountpaid", "amountreceived", "amount", "amt"],
        "currency": ["paymentcurrency", "receivingcurrency", "currency"],
        "payment_format": ["paymentformat", "format", "paymenttype", "type"],
        "device_id": ["senderdevice", "deviceid", "device"],
        "phone": ["senderphone", "phone", "phonenumber", "telephone"],
        "ip": ["senderip", "ip", "ipaddress"],
        "beneficiary_name": ["beneficiaryname", "beneficiary", "receivername"],
        "txn_id": ["txnid", "transactionid", "id"],
    }

    col_map = {_clean_str(col): col for col in columns}
    suggested: Dict[str, str] = {}

    for canonical, keys in candidates.items():
        for key in keys:
            if key in col_map:
                suggested[canonical] = col_map[key]
                break

    return suggested


def apply_mapping(df: pd.DataFrame, mapping: Dict[str, str]) -> pd.DataFrame:
    """
    Rename source columns in df to canonical fields.
    Raises ValueError if any required field is unmapped or missing from df.
    """
    for req in REQUIRED_FIELDS:
        if req not in mapping or not mapping[req]:
            raise ValueError(f"Required canonical field '{req}' is unmapped.")
        src_col = mapping[req]
        if src_col not in df.columns:
            raise ValueError(f"Mapped source column '{src_col}' for '{req}' not found in dataframe.")

    # Create rename dictionary: {source_col: canonical_field}
    rename_dict = {}
    for canonical, src in mapping.items():
        if src in df.columns and canonical in CANONICAL_FIELDS:
            rename_dict[src] = canonical

    mapped_df = df.rename(columns=rename_dict).copy()
    return mapped_df


def get_templates() -> List[Dict[str, Any]]:
    """Retrieve all mapping templates."""
    if not TEMPLATES_FILE.exists():
        TEMPLATES_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(TEMPLATES_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_TEMPLATES, f, indent=2)
        return DEFAULT_TEMPLATES

    try:
        with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_TEMPLATES


def save_template(name: str, mapping: Dict[str, str]) -> Dict[str, Any]:
    """Save a new mapping template."""
    templates = get_templates()
    template_id = str(uuid.uuid4())[:8]
    new_template = {"id": template_id, "name": name, "mapping": mapping}
    templates.append(new_template)
    with open(TEMPLATES_FILE, "w", encoding="utf-8") as f:
        json.dump(templates, f, indent=2)
    return new_template
