"""
test_ingestion.py — Unit tests for Phase B2 Ingestion:
1. Schema mapping (Task 2)
2. Validation rules (Task 3)
3. Entity resolution & normalization (Task 4)
4. Provenance audit tracking (Task 5)
"""
import uuid
import pytest
import pandas as pd

from app.services.ingestion.mapping import apply_mapping, suggest_mapping
from app.services.ingestion.validation import validate
from app.services.ingestion.entity_resolution import (
    normalise_phone,
    normalise_account,
    resolve_beneficiary,
)


def test_apply_mapping_success():
    """Verify apply_mapping renames source columns to canonical names."""
    df_raw = pd.DataFrame([
        {
            "Timestamp": "01-09-2022 00:10",
            "SenderAcct": "ACC101",
            "ReceiverAcct": "ACC202",
            "TxnAmount": "5000.00",
            "Currency": "USD",
        }
    ])
    mapping = {
        "timestamp": "Timestamp",
        "from_account": "SenderAcct",
        "to_account": "ReceiverAcct",
        "amount": "TxnAmount",
        "currency": "Currency",
    }
    mapped = apply_mapping(df_raw, mapping)
    assert "timestamp" in mapped.columns
    assert "from_account" in mapped.columns
    assert "to_account" in mapped.columns
    assert "amount" in mapped.columns
    assert mapped.iloc[0]["from_account"] == "ACC101"
    assert mapped.iloc[0]["to_account"] == "ACC202"


def test_apply_mapping_missing_required():
    """Verify apply_mapping raises ValueError if a required field is missing."""
    df_raw = pd.DataFrame([{"Timestamp": "01-09-2022 00:10", "Sender": "A"}])
    mapping = {
        "timestamp": "Timestamp",
        "from_account": "Sender",
        # missing to_account and amount
    }
    with pytest.raises(ValueError) as exc:
        apply_mapping(df_raw, mapping)
    assert "Required canonical field" in str(exc.value)


def test_validation_flags_negative_amount_and_bad_date():
    """Verify validation flags negative amounts and unparseable dates."""
    df = pd.DataFrame([
        {
            "timestamp": "invalid_date_xyz",
            "from_account": "ACC1",
            "to_account": "ACC2",
            "amount": "-500.00",
            "currency": "USD",
        },
        {
            "timestamp": "01-09-2022 00:10",
            "from_account": "ACC3",
            "to_account": "ACC4",
            "amount": "1500.00",
            "currency": "USD",
        },
    ])
    valid_df, report = validate(df)
    assert report["total"] == 2
    assert report["valid"] == 1
    assert report["invalid"] == 1
    assert "invalid_amount" in report["by_rule"]
    assert "invalid_timestamp" in report["by_rule"]
    assert len(valid_df) == 1
    assert valid_df.iloc[0]["from_account"] == "ACC3"


def test_validation_flags_self_transfer_without_dropping():
    """Verify self-transfers (from_account == to_account) are flagged but kept valid."""
    df = pd.DataFrame([
        {
            "timestamp": "01-09-2022 00:10",
            "from_account": "SELF_ACCT",
            "to_account": "SELF_ACCT",
            "amount": "250.00",
            "currency": "USD",
        }
    ])
    valid_df, report = validate(df)
    assert report["total"] == 1
    assert report["valid"] == 1
    assert report["invalid"] == 0
    assert "self_transfer" in report["by_rule"]
    assert len(valid_df) == 1


def test_entity_resolution_phone_and_account():
    """Verify phone normalization (+91, spaces) and account normalization."""
    assert normalise_phone("+91 98765 43210") == "9876543210"
    assert normalise_phone("919876543210") == "9876543210"
    assert normalise_phone("9876543210") == "9876543210"

    assert normalise_account("  acct-abc-123  ") == "ACCT-ABC-123"


def test_entity_resolution_beneficiary_fuzzy_match():
    """Verify 'Rahul Sharma' and 'R. Sharma' fuzzy match with token_sort_ratio >= 90."""
    existing_id = uuid.uuid4()
    existing_beneficiaries = {
        "Rahul Sharma": (existing_id, "Rahul Sharma")
    }

    matched_id, score, reason = resolve_beneficiary("R. Sharma", existing_beneficiaries)
    assert matched_id == existing_id
    assert score is not None and score >= 90.0
    assert "similarity score" in reason
