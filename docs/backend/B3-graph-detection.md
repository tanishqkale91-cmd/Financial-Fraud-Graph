# B3 Graph and Detection

Goal: Sync entities and transactions from PostgreSQL to Neo4j, implement graph and pattern detectors, generate alerts with explainable reasons and evidence.

## Neo4j Sync Specification
- **File**: `backend/app/services/graph/neo4j_sync.py`
- **Function**: `sync_postgres_to_neo4j()`
- **Nodes**:
  - `(:Account {id, name})`
  - `(:Device {id})`
  - `(:Phone {id})`
  - `(:Merchant {id})`
  - `(:Beneficiary {id})`
- **Relationships**:
  - `(:Account)-[:SENT {txn_id, amount, ts, currency}]->(:Account)`
  - `(:Account)-[:USES]->(:Device)`
  - `(:Account)-[:HAS_PHONE]->(:Phone)`
- **Bulk Loading**: Uses batched `UNWIND` Cypher queries for high-performance bulk synchronization.
- **Self-Transfers Rule**: Self-transfers (`Account == Account.1` / `from_entity_id == to_entity_id`) must be excluded from graph construction, cycle detection, degree features, and Neo4j sync, but kept in PostgreSQL.
- **Celery Task**: `app/tasks/graph_task.py`
- **API Endpoint**: `POST /api/graph/build` -> `{"task_id": "..."}`

## Detectors
1. `services/detection/shared_infra.py` (rule_id: `shared_infra`, version: 1)
2. `services/detection/rapid_movement.py` (rule_id: `rapid_movement`, version: 1)
3. `services/detection/cycles.py` (rule_id: `cycles`, version: 1; NetworkX simple cycles on directed graph; self-transfers excluded)
4. `services/detection/fan_in_out.py` (rule_id: `fan_in_out`, version: 1; self-transfers excluded)

## Combined Scoring & Alerts
- Each detector returns findings with `rule_id`, `rule_version`, `score`, `reason`, `evidence`, and `transaction_ids`.
- Store findings in `alerts` (with `score_breakdown` JSONB) and `alert_transactions`.
