"""
features.py — Extract per-account features for ML anomaly detection.
Features: txn count, total amount, unique counterparties.
Excludes self-transfers everywhere.
"""
from typing import Dict, Any
import pandas as pd
import numpy as np


def extract_account_features(txns_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute per-account features:
    - txn_count: total non-self transactions
    - total_amount: total transaction volume
    - unique_counterparties: distinct non-self counterparties
    Excludes self-transfers (from_entity_id == to_entity_id).
    """
    if txns_df.empty:
        return pd.DataFrame(columns=["txn_count", "total_amount", "unique_counterparties"])

    # Exclude self-transfers
    df = txns_df[txns_df["from_entity_id"] != txns_df["to_entity_id"]].copy()
    if df.empty:
        return pd.DataFrame(columns=["txn_count", "total_amount", "unique_counterparties"])

    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)

    # Outbound features
    out_grp = df.groupby("from_entity_id")
    out_count = out_grp.size()
    out_sum = out_grp["amount"].sum()
    out_cps = out_grp["to_entity_id"].apply(lambda s: set(s.dropna()))

    # Inbound features
    in_grp = df.groupby("to_entity_id")
    in_count = in_grp.size()
    in_sum = in_grp["amount"].sum()
    in_cps = in_grp["from_entity_id"].apply(lambda s: set(s.dropna()))

    all_accounts = sorted(list(set(out_count.index).union(set(in_count.index))))

    records = []
    for acc in all_accounts:
        c_out = int(out_count.get(acc, 0))
        c_in = int(in_count.get(acc, 0))
        total_txns = c_out + c_in

        s_out = float(out_sum.get(acc, 0.0))
        s_in = float(in_sum.get(acc, 0.0))
        total_vol = s_out + s_in

        cps = set()
        if acc in out_cps:
            cps.update(out_cps[acc])
        if acc in in_cps:
            cps.update(in_cps[acc])
        cps.discard(acc)
        n_cps = len(cps)

        records.append({
            "account_id": str(acc),
            "txn_count": total_txns,
            "total_amount": total_vol,
            "unique_counterparties": n_cps,
        })

    feat_df = pd.DataFrame(records)
    if not feat_df.empty:
        feat_df.set_index("account_id", inplace=True)
    return feat_df

