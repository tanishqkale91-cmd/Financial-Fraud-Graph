"""
rapid_movement.py — Rapid movement detector (money in then out within window, small retained amount).
Rule ID: rapid_movement, Version: 1.
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import pandas as pd


def detect_rapid_movement(
    txns_df: pd.DataFrame,
    entities_map: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Detect rapid pass-through / rapid movement:
    Account receives funds and forwards a high percentage within window_minutes.
    Excludes self-transfers everywhere.
    """
    params = params or {}
    window_minutes = float(params.get("window_minutes", 30))
    min_inflow = float(params.get("min_inflow", 10000.0))
    pass_through_ratio = float(params.get("pass_through_ratio", 0.85))

    if txns_df.empty:
        return []

    entities_map = entities_map or {}

    # Exclude self-transfers
    df = txns_df[txns_df["from_entity_id"] != txns_df["to_entity_id"]].copy()
    if df.empty:
        return []

    # Ensure txn_ts is datetime
    if not pd.api.types.is_datetime64_any_dtype(df["txn_ts"]):
        df["txn_ts"] = pd.to_datetime(df["txn_ts"])
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)

    # Sort chronologically
    df = df.sort_values("txn_ts")

    # Inbound and outbound transactions indexed by account
    inbound_txns = df[df["amount"] >= min_inflow]
    outbound_by_account: Dict[str, List[Dict[str, Any]]] = {}

    for row in df.itertuples():
        acc = str(row.from_entity_id)
        if acc not in outbound_by_account:
            outbound_by_account[acc] = []
        outbound_by_account[acc].append({
            "id": row.id,
            "ts": row.txn_ts,
            "amount": float(row.amount),
        })

    findings = []
    seen_alerts = set()

    for in_row in inbound_txns.itertuples():
        account_id = str(in_row.to_entity_id)
        in_ts = in_row.txn_ts
        in_amt = float(in_row.amount)
        in_id = int(in_row.id)

        outbounds = outbound_by_account.get(account_id, [])
        if not outbounds:
            continue

        window_end = in_ts + timedelta(minutes=window_minutes)
        matching_outs = [
            out for out in outbounds
            if in_ts < out["ts"] <= window_end
        ]

        if not matching_outs:
            continue

        outflow_sum = sum(out["amount"] for out in matching_outs)
        ratio = outflow_sum / in_amt if in_amt > 0 else 0.0

        if ratio >= pass_through_ratio:
            first_out = matching_outs[0]
            minutes_to_forward = (first_out["ts"] - in_ts).total_seconds() / 60.0
            speed_factor = max(0.0, 1.0 - (minutes_to_forward / window_minutes))
            score = min(1.0, float(ratio) * 0.6 + 0.4 * speed_factor)

            account_key = entities_map.get(account_id, account_id)
            retained = max(0.0, in_amt - outflow_sum)
            out_ids = [out["id"] for out in matching_outs]

            dedup_key = (account_id, in_id)
            if dedup_key in seen_alerts:
                continue
            seen_alerts.add(dedup_key)

            reason = (
                f"Account {account_key} received ${in_amt:,.2f} and forwarded "
                f"{ratio * 100:.1f}% of it within {minutes_to_forward:.1f} minutes, "
                f"which is consistent with layering."
            )

            evidence = {
                "account_id": account_id,
                "account_key": account_key,
                "inflow_total": round(in_amt, 2),
                "outflow_total": round(outflow_sum, 2),
                "ratio": round(ratio, 4),
                "retained_amount": round(retained, 2),
                "minutes_to_forward": round(minutes_to_forward, 2),
                "in_txns": [in_id],
                "out_txns": out_ids,
            }

            score_breakdown = {
                "rules": [{"rule_id": "rapid_movement", "weight": 1.0, "score": round(score, 4)}],
                "ml": None,
            }

            findings.append({
                "rule_id": "rapid_movement",
                "rule_version": 1,
                "score": round(score, 4),
                "reason": reason,
                "evidence": evidence,
                "transaction_ids": [in_id] + out_ids,
                "entity_id": account_id,
                "score_breakdown": score_breakdown,
            })

    return findings

