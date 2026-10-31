# Data Schema

## PostgreSQL (source of truth)

### import_batches
id UUID PK | filename TEXT | status TEXT (pending|running|done|failed) | uploaded_at TIMESTAMPTZ
| mapping JSONB | row_count INT | valid_count INT | invalid_count INT

### raw_records
id BIGSERIAL PK | batch_id UUID FK | row_number INT | raw JSONB | is_valid BOOL | errors JSONB

### entities
id UUID PK | entity_type TEXT (account|device|phone|merchant|beneficiary)
| canonical_key TEXT | display_name TEXT | attributes JSONB
UNIQUE (entity_type, canonical_key)

### entity_aliases
id BIGSERIAL PK | entity_id UUID FK | alias_value TEXT | alias_type TEXT
| match_score FLOAT | match_reason TEXT | batch_id UUID FK

### transactions
id BIGSERIAL PK | batch_id UUID FK | raw_record_id BIGINT FK | txn_ts TIMESTAMPTZ
| from_entity_id UUID FK | to_entity_id UUID FK | amount NUMERIC(18,2) | currency TEXT
| payment_format TEXT | device_entity_id UUID FK NULL | ip TEXT NULL | label_laundering BOOL NULL

### provenance
id BIGSERIAL PK | record_type TEXT (raw_record|entity|transaction) | record_id TEXT
| batch_id UUID FK | source_file TEXT | source_row INT | step TEXT | detail JSONB | created_at TIMESTAMPTZ

### rule_config
rule_id TEXT PK | version INT | weight FLOAT | params JSONB | enabled BOOL

### alerts
id UUID PK | rule_id TEXT | rule_version INT | score FLOAT | reason TEXT | evidence JSONB
| entity_id UUID FK NULL | status TEXT (open|in_case|false_positive|confirmed) | created_at TIMESTAMPTZ

### alert_transactions
alert_id UUID FK | transaction_id BIGINT FK  (composite PK)

### cases / case_items / tasks / decisions / audit_log / feedback
(defined in phase B5; do not create before then)

## Neo4j (rebuilt from PostgreSQL, safe to wipe)
Nodes: (:Account {id, name}) (:Device {id}) (:Phone {id}) (:Merchant {id}) (:Beneficiary {id})
Relationships:
- (:Account)-[:SENT {txn_id, amount, ts, currency}]->(:Account)
- (:Account)-[:USES]->(:Device)
- (:Account)-[:HAS_PHONE]->(:Phone)
Constraints: UNIQUE id on every label.
