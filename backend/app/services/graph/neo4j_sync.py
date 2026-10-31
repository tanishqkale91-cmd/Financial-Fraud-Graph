"""
neo4j_sync.py — Sync alert-related entities and edges to Neo4j in batches,
and query 2-hop neighborhood with PostgreSQL fallback.
Excludes self-transfers everywhere.
"""
import uuid
import logging
from typing import Dict, Any, List, Set, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.core.neo4j_client import run_query
from app.models.entity import Entity
from app.models.transaction import Transaction
from app.models.alert import Alert, AlertTransaction

logger = logging.getLogger(__name__)


def sync_alert_graph_to_neo4j(db: Session, batch_size: int = 1000) -> Dict[str, Any]:
    """
    Sync alert-related accounts, devices, phones, and transactions to Neo4j in batches using UNWIND.
    Excludes self-transfers.
    """
    try:
        # 1. Identify alert-related entities & transactions
        alert_txns = db.query(AlertTransaction.transaction_id).distinct().all()
        txn_ids = [t[0] for t in alert_txns]

        txns_query = db.query(Transaction).filter(
            Transaction.id.isin(txn_ids),
            Transaction.from_entity_id != Transaction.to_entity_id,  # Exclude self-transfers
        )
        txns = txns_query.all()

        account_ids: Set[uuid.UUID] = set()
        device_ids: Set[uuid.UUID] = set()

        # Add explicit alert primary entities
        alerts = db.query(Alert.entity_id).filter(Alert.entity_id.isnot(None)).all()
        for a in alerts:
            if a[0]:
                account_ids.add(a[0])

        for t in txns:
            account_ids.add(t.from_entity_id)
            account_ids.add(t.to_entity_id)
            if t.device_entity_id:
                device_ids.add(t.device_entity_id)

        # Query entity details
        all_entity_ids = list(account_ids.union(device_ids))
        if not all_entity_ids:
            return {"synced": True, "nodes": 0, "edges": 0}

        entities = db.query(Entity).filter(Entity.id.isin(all_entity_ids)).all()
        entities_by_id = {e.id: e for e in entities}

        account_nodes = []
        device_nodes = []
        for e_id in account_ids:
            ent = entities_by_id.get(e_id)
            if ent:
                account_nodes.append({
                    "id": str(ent.id),
                    "name": ent.display_name or ent.canonical_key,
                })

        for d_id in device_ids:
            ent = entities_by_id.get(d_id)
            if ent:
                device_nodes.append({
                    "id": str(ent.id),
                    "key": ent.canonical_key,
                })

        sent_edges = []
        uses_edges = []
        for t in txns:
            sent_edges.append({
                "txn_id": str(t.id),
                "from_id": str(t.from_entity_id),
                "to_id": str(t.to_entity_id),
                "amount": float(t.amount),
                "currency": t.currency,
                "ts": t.txn_ts.isoformat() if t.txn_ts else "",
            })
            if t.device_entity_id:
                uses_edges.append({
                    "account_id": str(t.from_entity_id),
                    "device_id": str(t.device_entity_id),
                })

        # 2. Batch write to Neo4j using UNWIND
        # Accounts
        for i in range(0, len(account_nodes), batch_size):
            chunk = account_nodes[i : i + batch_size]
            run_query(
                "UNWIND $batch AS row "
                "MERGE (a:Account {id: row.id}) "
                "ON CREATE SET a.name = row.name "
                "ON MATCH SET a.name = row.name",
                {"batch": chunk},
            )

        # Devices
        for i in range(0, len(device_nodes), batch_size):
            chunk = device_nodes[i : i + batch_size]
            run_query(
                "UNWIND $batch AS row "
                "MERGE (d:Device {id: row.id}) "
                "ON CREATE SET d.key = row.key",
                {"batch": chunk},
            )

        # SENT edges
        for i in range(0, len(sent_edges), batch_size):
            chunk = sent_edges[i : i + batch_size]
            run_query(
                "UNWIND $batch AS row "
                "MATCH (f:Account {id: row.from_id}), (t:Account {id: row.to_id}) "
                "MERGE (f)-[r:SENT {txn_id: row.txn_id}]->(t) "
                "ON CREATE SET r.amount = row.amount, r.currency = row.currency, r.ts = row.ts",
                {"batch": chunk},
            )

        # USES edges
        for i in range(0, len(uses_edges), batch_size):
            chunk = uses_edges[i : i + batch_size]
            run_query(
                "UNWIND $batch AS row "
                "MATCH (a:Account {id: row.account_id}), (d:Device {id: row.device_id}) "
                "MERGE (a)-[:USES]->(d)",
                {"batch": chunk},
            )

        return {
            "synced": True,
            "nodes": len(account_nodes) + len(device_nodes),
            "edges": len(sent_edges) + len(uses_edges),
        }
    except Exception as e:
        logger.warning(f"Neo4j sync bypassed or failed: {e}")
        return {"synced": False, "error": str(e)}


def get_2hop_subgraph(
    account_id: str,
    db: Session,
    max_nodes: int = 200,
) -> Dict[str, Any]:
    """
    Retrieve 2-hop neighborhood for an account as {nodes, edges}.
    Tries Neo4j first; falls back seamlessly to PostgreSQL.
    Excludes self-transfers everywhere. Capped at max_nodes (default 200).
    """
    # 1. Try Neo4j
    try:
        cypher = """
        MATCH (a:Account {id: $account_id})
        CALL {
            WITH a
            MATCH path = (a)-[r*1..2]-(m)
            WHERE NONE(rel IN relationships(path) WHERE startNode(rel) = endNode(rel))
            RETURN nodes(path) AS p_nodes, relationships(path) AS p_rels
            LIMIT 200
        }
        UNWIND p_nodes AS n
        UNWIND p_rels AS rel
        RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT rel) AS edges
        """
        res = run_query(cypher, {"account_id": str(account_id)})
        if res and res[0].get("nodes"):
            raw_nodes = res[0]["nodes"]
            raw_edges = res[0]["edges"]
            nodes = [
                {
                    "id": str(n.get("id", "")),
                    "type": list(n.labels)[0] if hasattr(n, "labels") else "Account",
                    "label": n.get("name") or n.get("key") or str(n.get("id", "")),
                    "risk": 0.0,
                }
                for n in raw_nodes[:max_nodes]
            ]
            edges = [
                {
                    "id": str(e.get("txn_id") or e.id if hasattr(e, "id") else f"e_{idx}"),
                    "source": str(e.start_node.get("id") if hasattr(e, "start_node") else ""),
                    "target": str(e.end_node.get("id") if hasattr(e, "end_node") else ""),
                    "type": e.type if hasattr(e, "type") else "SENT",
                    "amount": float(e.get("amount", 0.0)) if hasattr(e, "get") else None,
                    "ts": str(e.get("ts", "")) if hasattr(e, "get") else None,
                }
                for idx, e in enumerate(raw_edges)
            ]
            return {
                "nodes": nodes,
                "edges": edges,
                "truncated": len(nodes) >= max_nodes,
            }
    except Exception:
        # Fall back to PostgreSQL
        pass

    # 2. PostgreSQL fallback
    return _get_2hop_postgres(account_id, db, max_nodes)


def _get_2hop_postgres(account_id: str, db: Session, max_nodes: int = 200) -> Dict[str, Any]:
    """Fast PostgreSQL 2-hop graph extraction with self-transfer exclusion."""
    # Find account entity
    target_ent = None
    try:
        acc_uuid = uuid.UUID(account_id)
        target_ent = db.query(Entity).filter(Entity.id == acc_uuid).first()
    except ValueError:
        target_ent = db.query(Entity).filter(
            Entity.canonical_key == str(account_id),
            Entity.entity_type == "account",
        ).first()

    if not target_ent:
        return {"nodes": [], "edges": [], "truncated": False}

    root_id = target_ent.id
    nodes_map: Dict[str, Dict[str, Any]] = {
        str(root_id): {
            "id": str(root_id),
            "type": "Account",
            "label": target_ent.display_name or target_ent.canonical_key,
            "risk": 0.0,
        }
    }
    edges_list: List[Dict[str, Any]] = []
    seen_edge_ids: Set[str] = set()

    # Hop 1: Transactions connected to root (exclude self-transfers)
    hop1_txns = db.query(Transaction).filter(
        or_(Transaction.from_entity_id == root_id, Transaction.to_entity_id == root_id),
        Transaction.from_entity_id != Transaction.to_entity_id,
    ).limit(100).all()

    hop1_accounts: Set[uuid.UUID] = set()

    for t in hop1_txns:
        edge_id = str(t.id)
        if edge_id not in seen_edge_ids:
            seen_edge_ids.add(edge_id)
            edges_list.append({
                "id": edge_id,
                "source": str(t.from_entity_id),
                "target": str(t.to_entity_id),
                "type": "SENT",
                "amount": float(t.amount),
                "ts": t.txn_ts.isoformat() if t.txn_ts else None,
            })
        other_id = t.to_entity_id if t.from_entity_id == root_id else t.from_entity_id
        hop1_accounts.add(other_id)

        # Device connection
        if t.device_entity_id:
            d_id_str = str(t.device_entity_id)
            if d_id_str not in nodes_map:
                nodes_map[d_id_str] = {
                    "id": d_id_str,
                    "type": "Device",
                    "label": f"Device_{d_id_str[:8]}",
                    "risk": 0.0,
                }
            uses_edge_id = f"uses_{t.from_entity_id}_{d_id_str}"
            if uses_edge_id not in seen_edge_ids:
                seen_edge_ids.add(uses_edge_id)
                edges_list.append({
                    "id": uses_edge_id,
                    "source": str(t.from_entity_id),
                    "target": d_id_str,
                    "type": "USES",
                    "amount": None,
                    "ts": None,
                })

    # Hop 2: Transactions from hop 1 accounts
    if hop1_accounts:
        hop2_txns = db.query(Transaction).filter(
            or_(
                Transaction.from_entity_id.isin(list(hop1_accounts)),
                Transaction.to_entity_id.isin(list(hop1_accounts)),
            ),
            Transaction.from_entity_id != Transaction.to_entity_id,
        ).limit(100).all()

        for t in hop2_txns:
            if len(nodes_map) >= max_nodes:
                break
            edge_id = str(t.id)
            if edge_id not in seen_edge_ids:
                seen_edge_ids.add(edge_id)
                edges_list.append({
                    "id": edge_id,
                    "source": str(t.from_entity_id),
                    "target": str(t.to_entity_id),
                    "type": "SENT",
                    "amount": float(t.amount),
                    "ts": t.txn_ts.isoformat() if t.txn_ts else None,
                })

    # Hydrate node labels
    missing_node_ids = [
        uuid.UUID(nid) for nid in set(
            [e["source"] for e in edges_list] + [e["target"] for e in edges_list]
        ) if nid not in nodes_map
    ]
    if missing_node_ids:
        missing_ents = db.query(Entity).filter(Entity.id.isin(missing_node_ids)).all()
        for e in missing_ents:
            nodes_map[str(e.id)] = {
                "id": str(e.id),
                "type": e.entity_type.capitalize(),
                "label": e.display_name or e.canonical_key,
                "risk": 0.0,
            }

    final_nodes = list(nodes_map.values())[:max_nodes]
    valid_ids = {n["id"] for n in final_nodes}
    final_edges = [e for e in edges_list if e["source"] in valid_ids and e["target"] in valid_ids]

    return {
        "nodes": final_nodes,
        "edges": final_edges,
        "truncated": len(nodes_map) >= max_nodes,
    }

