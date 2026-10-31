"""
anomaly.py — Isolation Forest anomaly detection on per-account features.
Features: txn count, total amount, unique counterparties.
Flags top 1%. Excludes self-transfers everywhere.
"""
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.services.ml.features import extract_account_features


def detect_isolation_forest_anomalies(
    txns_df: pd.DataFrame,
    entities_map: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Run Isolation Forest on per-account features:
    - txn_count
    - total_amount
    - unique_counterparties
    Flag top 1% anomalies.
    Excludes self-transfers everywhere.
    """
    params = params or {}
    contamination = float(params.get("contamination", 0.01))

    if txns_df.empty:
        return []

    entities_map = entities_map or {}

    # Extract features (which already excludes self-transfers)
    features_df = extract_account_features(txns_df)
    if len(features_df) < 5:
        return []

    n_samples = len(features_df)
    # Ensure contamination is valid for the sample size
    eff_contamination = min(max(contamination, 1.0 / n_samples), 0.5)

    X = features_df[["txn_count", "total_amount", "unique_counterparties"]].values

    # Fit Isolation Forest
    model = IsolationForest(
        contamination=eff_contamination,
        random_state=42,
        n_estimators=100,
        n_jobs=-1,
    )
    model.fit(X)

    # Score samples: lower is more anomalous
    raw_scores = -model.score_samples(X)  # higher is now more anomalous
    preds = model.predict(X)  # -1 for anomaly, 1 for inlier

    # Normalize scores to 0..1
    min_s = float(np.min(raw_scores))
    max_s = float(np.max(raw_scores))
    norm_scores = (raw_scores - min_s) / (max_s - min_s + 1e-9)

    # Compute population statistics for feature explainability
    means = features_df.mean()
    stds = features_df.std().replace(0, 1.0)

    # Transaction lookup for linking transactions to accounts
    non_self_df = txns_df[txns_df["from_entity_id"] != txns_df["to_entity_id"]]
    acct_to_txns: Dict[str, List[int]] = {}
    for row in non_self_df.itertuples():
        tid = int(row.id)
        f_id = str(row.from_entity_id)
        t_id = str(row.to_entity_id)
        acct_to_txns.setdefault(f_id, []).append(tid)
        acct_to_txns.setdefault(t_id, []).append(tid)

    findings = []
    # Identify top 1% (preds == -1)
    anom_indices = np.where(preds == -1)[0]

    for idx in anom_indices:
        account_id = str(features_df.index[idx])
        account_key = entities_map.get(account_id, account_id)
        score = float(norm_scores[idx])

        row_vals = features_df.iloc[idx]
        tc = int(row_vals["txn_count"])
        ta = float(row_vals["total_amount"])
        uc = int(row_vals["unique_counterparties"])

        # Z-scores for feature explainability
        z_scores = {
            col: abs(float((row_vals[col] - means[col]) / stds[col]))
            for col in ["txn_count", "total_amount", "unique_counterparties"]
        }
        total_z = sum(z_scores.values()) or 1.0

        top_features = [
            {
                "name": col,
                "value": float(row_vals[col]),
                "contribution": round(z_scores[col] / total_z, 4),
            }
            for col in sorted(z_scores, key=z_scores.get, reverse=True)
        ]

        reason = (
            f"Account {account_key} flagged by Isolation Forest anomaly detection in top 1% "
            f"(score: {score:.2f}) across transaction count ({tc}), "
            f"total volume (${ta:,.2f}), and unique counterparties ({uc})."
        )

        evidence = {
            "account_id": account_id,
            "account_key": account_key,
            "features": {
                "txn_count": tc,
                "total_amount": round(ta, 2),
                "unique_counterparties": uc,
            },
            "anomaly_score": round(score, 4),
            "top_percentile": "1%",
        }

        score_breakdown = {
            "rules": [],
            "ml": {
                "score": round(score, 4),
                "top_features": top_features,
            },
        }

        linked_txns = acct_to_txns.get(account_id, [])[:20]

        findings.append({
            "rule_id": "anomaly_isolation_forest",
            "rule_version": 1,
            "score": round(score, 4),
            "reason": reason,
            "evidence": evidence,
            "transaction_ids": linked_txns,
            "entity_id": account_id,
            "score_breakdown": score_breakdown,
        })

    return findings

