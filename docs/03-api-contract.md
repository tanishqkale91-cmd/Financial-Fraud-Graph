# API Contract

Base URL: http://localhost:8000. All bodies are JSON unless noted. IDs are strings (UUID) unless noted.
Errors: {"detail": "message"} with the proper HTTP status.

## Health
GET /health -> {"status":"ok","postgres":true,"neo4j":true}

## Ingestion
POST /api/ingestion/upload (multipart: file)
 -> {"batch_id","filename","columns":[...],"sample_rows":[{...}],"suggested_mapping":{"timestamp":"Timestamp",...}}
POST /api/ingestion/{batch_id}/mapping  body {"mapping":{canonical_field: source_column}}
 -> {"batch_id","status":"pending","mapping":{...}}
GET  /api/ingestion/mappings/templates -> [{"id","name","mapping":{...}}]
POST /api/ingestion/mappings/templates body {"name","mapping"} -> {"id","name","mapping"}
POST /api/ingestion/{batch_id}/run -> {"task_id","batch_id"}
GET  /api/ingestion/{batch_id}
 -> {"batch_id","status","row_count","valid_count","invalid_count",
     "report":{"total","valid","invalid","by_rule":{},"examples":{}}}
GET  /api/ingestion/{batch_id}/provenance?record_type=transaction&record_id=123
 -> [{"step","detail","created_at"}]

## Graph build and detection
POST /api/graph/build -> {"task_id"}            (PostgreSQL -> Neo4j)
POST /api/detect/run  body {"rules":["shared_infra","rapid_movement","cycles","fan_in_out"]} -> {"task_id"}
GET  /api/tasks/{task_id} -> {"state":"PENDING|STARTED|SUCCESS|FAILURE","result":{}}

## Alerts
GET /api/alerts?status=open&rule_id=&min_score=&limit=50&offset=0
 -> {"total","items":[{"id","rule_id","rule_version","score","reason","status","entity_id","created_at"}]}
GET /api/alerts/{id}
 -> {"id","rule_id","rule_version","score","reason","status",
     "evidence":{...},
     "score_breakdown":{"rules":[{"rule_id","weight","score"}],"ml":{"score","top_features":[{"name","value","contribution"}]}},
     "transactions":[{"id","txn_ts","from_entity_id","to_entity_id","amount","currency"}]}
POST /api/alerts/{id}/feedback body {"verdict":"false_positive|confirmed","note":""}
 -> {"alert_id","status"}

## Graph exploration (limited to 2 hops and 200 nodes)
GET /api/graph/neighborhood?entity_id=&hops=1&start=&end=&min_amount=&node_types=account,device
 -> {"nodes":[{"id","type","label","risk":0.0}],
     "edges":[{"id","source","target","type":"SENT|USES|HAS_PHONE","amount","ts"}],
     "truncated":false}
GET /api/entities/{id} -> {"id","entity_type","display_name","attributes","aliases":[{"alias_value","match_score","match_reason"}]}
GET /api/entities/{id}/timeline?start=&end=
 -> [{"txn_id","ts","direction":"in|out","counterparty_id","amount","currency"}]

## Cases
POST /api/cases body {"title","alert_ids":[...],"priority":"low|medium|high"} -> case object
GET  /api/cases?status=&assignee= -> {"total","items":[case]}
GET  /api/cases/{id} -> case + {"evidence":[...],"tasks":[...],"decisions":[...],"summary":"..."}
POST /api/cases/{id}/evidence body {"type":"alert|transaction|subgraph|note","ref":"","content":{}} -> evidence item
POST /api/cases/{id}/tasks body {"title","assignee","due_date"} -> task
PATCH /api/tasks/{id} body {"status":"open|done"} -> task
POST /api/cases/{id}/decision body {"decision":"confirmed_fraud|false_positive|escalate","rationale":""} -> decision
GET  /api/cases/{id}/summary -> {"summary":"plain-English explanation built from evidence"}

Case object: {"id","title","status":"open|in_review|closed","priority","created_at","alert_ids":[]}

## Rules and feedback
GET /api/rules -> [{"rule_id","version","weight","enabled","params"}]
PATCH /api/rules/{rule_id} body {"weight","enabled","params"} -> rule
GET /api/feedback/stats -> {"by_rule":[{"rule_id","alerts","false_positives","fp_rate"}]}
