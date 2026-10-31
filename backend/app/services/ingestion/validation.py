"""
validation.py — Validate ingested transactions.
"""
from typing import Tuple, Dict, Any, List
from datetime import datetime
import pandas as pd
from dateutil import parser as date_parser

FATAL_RULES = {"required_missing", "invalid_timestamp", "invalid_amount"}


def _parse_timestamp(val: Any) -> Tuple[bool, Any]:
    if pd.isna(val) or val is None or str(val).strip() == "":
        return False, None
    s = str(val).strip()
    # Try common formats first for speed
    for fmt in ("%d-%m-%Y %H:%M", "%Y/%m/%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return True, datetime.strptime(s, fmt)
        except ValueError:
            pass
    try:
        dt = date_parser.parse(s)
        return True, dt
    except Exception:
        return False, None


def validate(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Validate mapped DataFrame.
    Returns:
      (valid_df, report)
    Report structure:
      {
        "total": int,
        "valid": int,
        "invalid": int,
        "by_rule": { rule_name: count },
        "examples": { rule_name: [list of sample row dicts] }
      }
    """
    total = len(df)
    by_rule: Dict[str, int] = {}
    examples: Dict[str, List[Dict[str, Any]]] = {}

    def record_violation(rule: str, row_data: Dict[str, Any]) -> None:
        by_rule[rule] = by_rule.get(rule, 0) + 1
        if rule not in examples:
            examples[rule] = []
        if len(examples[rule]) < 5:
            examples[rule].append(row_data)

    is_valid_list: List[bool] = []
    errors_list: List[List[str]] = []
    parsed_timestamps: List[Any] = []
    cleaned_amounts: List[Any] = []

    seen_txn_ids = set()

    for idx, row in df.iterrows():
        row_dict = row.to_dict()
        row_errors: List[str] = []
        fatal = False

        # 1. Required fields
        from_acct = str(row.get("from_account", "") or "").strip()
        to_acct = str(row.get("to_account", "") or "").strip()
        raw_amt = row.get("amount", None)
        raw_ts = row.get("timestamp", None)

        if not from_acct or not to_acct or raw_amt is None or pd.isna(raw_amt) or raw_ts is None or pd.isna(raw_ts):
            row_errors.append("required_missing")
            record_violation("required_missing", {"row": idx, "reason": "Missing required field"})
            fatal = True

        # 2. Timestamp parseable
        ts_ok, dt_val = _parse_timestamp(raw_ts)
        if not ts_ok:
            row_errors.append("invalid_timestamp")
            record_violation("invalid_timestamp", {"row": idx, "value": raw_ts})
            fatal = True
            parsed_timestamps.append(None)
        else:
            parsed_timestamps.append(dt_val)

        # 3. Amount numeric and > 0
        try:
            amt_num = float(raw_amt)
            if amt_num <= 0 or pd.isna(amt_num):
                row_errors.append("invalid_amount")
                record_violation("invalid_amount", {"row": idx, "value": raw_amt})
                fatal = True
                cleaned_amounts.append(None)
            else:
                cleaned_amounts.append(amt_num)
        except (ValueError, TypeError):
            row_errors.append("invalid_amount")
            record_violation("invalid_amount", {"row": idx, "value": raw_amt})
            fatal = True
            cleaned_amounts.append(None)

        # 4. Self-transfer (Account == Account.1) -> FLAGGED, not fatal
        if from_acct and to_acct and from_acct.upper() == to_acct.upper():
            row_errors.append("self_transfer")
            record_violation("self_transfer", {"row": idx, "account": from_acct})

        # 5. Currency is 3 letters (informational flag)
        curr = str(row.get("currency", "") or "").strip()
        if curr and len(curr) != 3:
            row_errors.append("currency_not_3_letters")
            record_violation("currency_not_3_letters", {"row": idx, "currency": curr})

        # 6. Duplicate txn_id (if present)
        txn_id = row.get("txn_id", None)
        if txn_id and not pd.isna(txn_id) and str(txn_id).strip():
            t_str = str(txn_id).strip()
            if t_str in seen_txn_ids:
                row_errors.append("duplicate_txn_id")
                record_violation("duplicate_txn_id", {"row": idx, "txn_id": t_str})
            else:
                seen_txn_ids.add(t_str)

        is_valid = not fatal
        is_valid_list.append(is_valid)
        errors_list.append(row_errors)

    out_df = df.copy()
    out_df["_is_valid"] = is_valid_list
    out_df["_errors"] = errors_list
    out_df["_parsed_ts"] = parsed_timestamps
    out_df["_cleaned_amount"] = cleaned_amounts

    valid_count = sum(is_valid_list)
    invalid_count = total - valid_count

    report = {
        "total": total,
        "valid": valid_count,
        "invalid": invalid_count,
        "by_rule": by_rule,
        "examples": examples,
    }

    valid_df = out_df[out_df["_is_valid"]].copy()
    return valid_df, report
