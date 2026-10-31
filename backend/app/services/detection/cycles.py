"""
cycles.py — Circular transfers detector using NetworkX simple_cycles.
Rule ID: cycles, Version: 1.
"""
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
import networkx as nx


def detect_cycles(
    txns_df: pd.DataFrame,
    entities_map: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Detect circular transfers:
    Funds returning to the origin through a loop of accounts (length <= 6).
    Restricted to the 2,000 most active accounts.
    Excludes self-transfers everywhere.
    Capped under 30s.
    """
    start_time = time.time()
    params = params or {}
    min_len = int(params.get("min_len", 3))
    max_len = int(params.get("max_len", 6))
    window_hours = float(params.get("window_hours", 72.0))
    amount_tolerance = float(params.get("amount_tolerance", 0.2))
    max_active_accounts = int(params.get("max_active_accounts", 2000))
    time_budget_seconds = float(params.get("time_budget_seconds", 15.0))

    if txns_df.empty:
        return []

    entities_map = entities_map or {}

    # 1. Exclude self-transfers
    df = txns_df[txns_df["from_entity_id"] != txns_df["to_entity_id"]].copy()
    if df.empty:
        return []

    # Ensure datetimes & amounts
    if not pd.api.types.is_datetime64_any_dtype(df["txn_ts"]):
        df["txn_ts"] = pd.to_datetime(df["txn_ts"])
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)

    # 2. Identify top 2,000 most active accounts
    from_counts = df["from_entity_id"].value_counts()
    to_counts = df["to_entity_id"].value_counts()
    total_activity = from_counts.add(to_counts, fill_value=0).sort_values(ascending=False)
    active_accounts = set(total_activity.head(max_active_accounts).index)

    # Filter to transactions among active accounts
    df_active = df[
        df["from_entity_id"].isin(active_accounts) & df["to_entity_id"].isin(active_accounts)
    ].sort_values("txn_ts")

    if df_active.empty:
        return []

    # 3. Build directed graph and edge transaction lookup
    G = nx.DiGraph()
    edge_txns: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}

    for row in df_active.itertuples():
        u = str(row.from_entity_id)
        v = str(row.to_entity_id)
        if u == v:
            continue
        G.add_edge(u, v)
        pair = (u, v)
        if pair not in edge_txns:
            edge_txns[pair] = []
        edge_txns[pair].append({
            "id": int(row.id),
            "amount": float(row.amount),
            "ts": row.txn_ts,
            "from": u,
            "to": v,
        })

    findings = []
    seen_canonical_cycles = set()
    cycles_checked = 0

    # 4. Search simple cycles
    try:
        for cycle in nx.simple_cycles(G):
            cycles_checked += 1
            if time.time() - start_time > time_budget_seconds or cycles_checked > 8000:
                break

            cycle_len = len(cycle)
            if cycle_len < min_len or cycle_len > max_len:
                continue

            # Canonical representation to avoid duplicate alerts for rotated cycles
            sorted_nodes = sorted(cycle)
            min_idx = cycle.index(sorted_nodes[0])
            canonical = tuple(cycle[min_idx:] + cycle[:min_idx])
            if canonical in seen_canonical_cycles:
                continue

            # Verify chronologically forward and amount tolerance
            # Hops: (c[0], c[1]), (c[1], c[2]), ..., (c[k-1], c[0])
            hops_pairs = [(cycle[i], cycle[(i + 1) % cycle_len]) for i in range(cycle_len)]
            
            # Simple backtrack/greedy search for valid hop sequence
            def find_valid_hop_seq(hop_idx: int, prev_ts: Optional[datetime], first_ts: Optional[datetime], amounts: List[float], chosen_hops: List[Dict[str, Any]]):
                if hop_idx == cycle_len:
                    if len(amounts) == cycle_len and first_ts and prev_ts:
                        span = (prev_ts - first_ts).total_seconds() / 3600.0
                        if span <= window_hours:
                            max_a = max(amounts)
                            min_a = min(amounts)
                            if max_a > 0 and ((max_a - min_a) / max_a) <= amount_tolerance:
                                return chosen_hops
                    return None

                pair = hops_pairs[hop_idx]
                for cand in edge_txns.get(pair, []):
                    c_ts = cand["ts"]
                    c_amt = cand["amount"]
                    if prev_ts is not None and c_ts < prev_ts:
                        continue
                    new_first = first_ts if first_ts is not None else c_ts
                    if (c_ts - new_first).total_seconds() / 3600.0 > window_hours:
                        continue
                    if amounts:
                        curr_max = max(max(amounts), c_amt)
                        curr_min = min(min(amounts), c_amt)
                        if curr_max > 0 and ((curr_max - curr_min) / curr_max) > amount_tolerance:
                            continue
                    
                    res = find_valid_hop_seq(
                        hop_idx + 1,
                        c_ts,
                        new_first,
                        amounts + [c_amt],
                        chosen_hops + [cand],
                    )
                    if res:
                        return res
                return None

            valid_seq = find_valid_hop_seq(0, None, None, [], [])
            if not valid_seq:
                continue

            seen_canonical_cycles.add(canonical)
            amounts = [h["amount"] for h in valid_seq]
            max_amt = max(amounts)
            min_amt = min(amounts)
            amount_similarity = 1.0 - ((max_amt - min_amt) / max_amt if max_amt > 0 else 0.0)
            hours = (valid_seq[-1]["ts"] - valid_seq[0]["ts"]).total_seconds() / 3600.0

            score = min(1.0, 0.5 + 0.1 * (6 - cycle_len) + 0.2 * amount_similarity)
            path_names = [entities_map.get(x, x) for x in cycle] + [entities_map.get(cycle[0], cycle[0])]
            path_str = " -> ".join(path_names)

            reason = (
                f"Funds moved through a loop of {cycle_len} accounts ({path_str}) "
                f"and returned to the start within {hours:.1f} hours, which suggests round-tripping."
            )

            evidence = {
                "cycle": [str(x) for x in cycle],
                "length": cycle_len,
                "hops": [
                    {
                        "txn_id": h["id"],
                        "from": entities_map.get(h["from"], h["from"]),
                        "to": entities_map.get(h["to"], h["to"]),
                        "amount": round(h["amount"], 2),
                        "ts": h["ts"].isoformat() if hasattr(h["ts"], "isoformat") else str(h["ts"]),
                    }
                    for h in valid_seq
                ],
                "total_span_hours": round(hours, 2),
            }

            score_breakdown = {
                "rules": [{"rule_id": "cycles", "weight": 1.2, "score": round(score, 4)}],
                "ml": None,
            }

            findings.append({
                "rule_id": "cycles",
                "rule_version": 1,
                "score": round(score, 4),
                "reason": reason,
                "evidence": evidence,
                "transaction_ids": [h["id"] for h in valid_seq],
                "entity_id": str(cycle[0]),
                "score_breakdown": score_breakdown,
            })
    except Exception:
        pass

    return findings

