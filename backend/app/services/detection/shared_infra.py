"""
shared_infra.py — Shared infrastructure detector (devices / phones shared across >= 3 accounts).
Rule ID: shared_infra, Version: 1.
"""
from typing import List, Dict, Any, Optional
import pandas as pd


def detect_shared_infra(
    txns_df: pd.DataFrame,
    entities_map: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
    phone_links: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Detect shared hardware or contact details:
    One device or phone linked to >= min_accounts distinct accounts (default: 3).
    Excludes self-transfers everywhere.
    """
    params = params or {}
    min_accounts = int(params.get("min_accounts", 3))

    if txns_df.empty:
        return []

    entities_map = entities_map or {}

    # Exclude self-transfers
    df = txns_df[txns_df["from_entity_id"] != txns_df["to_entity_id"]].copy()
    if df.empty:
        return []

    findings = []
    seen_shared = set()

    # 1. Device sharing
    if "device_entity_id" in df.columns:
        valid_devs = df[df["device_entity_id"].notna() & (df["device_entity_id"] != "")]
        for dev_id, group in valid_devs.groupby("device_entity_id"):
            dev_str = str(dev_id)
            accounts = [str(a) for a in group["from_entity_id"].unique() if a]
            n_accounts = len(accounts)
            if n_accounts >= min_accounts:
                if ("device", dev_str) in seen_shared:
                    continue
                seen_shared.add(("device", dev_str))

                dev_key = entities_map.get(dev_str, dev_str)
                score = min(1.0, 0.4 + 0.15 * (n_accounts - min_accounts + 1))
                txn_count = len(group)
                sample_txns = [int(tid) for tid in group["id"].dropna().head(50)]

                reason = (
                    f"{n_accounts} accounts share the same device ({dev_key}); "
                    f"shared hardware or contact details across accounts is a common sign "
                    f"of coordinated mule activity."
                )

                evidence = {
                    "shared_type": "device",
                    "shared_id": dev_str,
                    "shared_key": dev_key,
                    "accounts": [entities_map.get(a, a) for a in accounts],
                    "account_ids": accounts,
                    "account_count": n_accounts,
                    "txn_count_among_accounts": txn_count,
                }

                score_breakdown = {
                    "rules": [{"rule_id": "shared_infra", "weight": 1.0, "score": round(score, 4)}],
                    "ml": None,
                }

                findings.append({
                    "rule_id": "shared_infra",
                    "rule_version": 1,
                    "score": round(score, 4),
                    "reason": reason,
                    "evidence": evidence,
                    "transaction_ids": sample_txns,
                    "entity_id": dev_str,
                    "score_breakdown": score_breakdown,
                })

    # 2. Phone sharing
    if phone_links:
        # phone_links: [{"phone_id": ..., "phone_key": ..., "account_id": ..., "txn_id": ...}]
        phone_df = pd.DataFrame(phone_links)
        if not phone_df.empty:
            for phone_id, group in phone_df.groupby("phone_id"):
                phone_str = str(phone_id)
                accounts = [str(a) for a in group["account_id"].unique() if a]
                n_accounts = len(accounts)
                if n_accounts >= min_accounts:
                    if ("phone", phone_str) in seen_shared:
                        continue
                    seen_shared.add(("phone", phone_str))

                    phone_key = str(group["phone_key"].iloc[0]) if "phone_key" in group.columns else phone_str
                    score = min(1.0, 0.4 + 0.15 * (n_accounts - min_accounts + 1))
                    txn_ids = [int(t) for t in group["txn_id"].dropna().unique()][:50] if "txn_id" in group.columns else []

                    reason = (
                        f"{n_accounts} accounts share the same phone ({phone_key}); "
                        f"shared hardware or contact details across accounts is a common sign "
                        f"of coordinated mule activity."
                    )

                    evidence = {
                        "shared_type": "phone",
                        "shared_id": phone_str,
                        "shared_key": phone_key,
                        "accounts": [entities_map.get(a, a) for a in accounts],
                        "account_ids": accounts,
                        "account_count": n_accounts,
                        "txn_count_among_accounts": len(group),
                    }

                    score_breakdown = {
                        "rules": [{"rule_id": "shared_infra", "weight": 1.0, "score": round(score, 4)}],
                        "ml": None,
                    }

                    findings.append({
                        "rule_id": "shared_infra",
                        "rule_version": 1,
                        "score": round(score, 4),
                        "reason": reason,
                        "evidence": evidence,
                        "transaction_ids": txn_ids,
                        "entity_id": phone_str,
                        "score_breakdown": score_breakdown,
                    })

    return findings

