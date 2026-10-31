# Execution Prompts (run in order, one per Claude Code message)

After EACH prompt: run its verify command yourself, then
  git add -A && git commit -m "<phase> done" && git push

## Global rules (already in CLAUDE.md, repeat if the model drifts)
Follow docs/02-data-schema.md, docs/03-api-contract.md, docs/detectors.md exactly.
No new stack items. Every alert stores rule_id, rule_version, score, reason, evidence.
Stop at the first failing verify and fix it before continuing.

---
## P1: Foundation (B1)
Read CLAUDE.md and docs/backend/B1-foundation.md. Implement ALL six tasks in order.
After each task run its verify command. If one fails, fix it before the next.
Create backend/requirements.txt if empty. Tick each task in docs/progress.md.
Stop when /health returns postgres:true and neo4j:true, Celery ping returns "pong",
and data/processed/transactions_enriched.csv exists. Show me the outputs.

VERIFY: curl http://localhost:8000/health

---
## P2: Ingestion (B2)
Read docs/backend/B2-ingestion.md. Implement ALL six tasks in order, running each verify.
Then run the full flow on data/processed/transactions_enriched.csv:
upload -> mapping -> run -> poll until status=done.
Stop when transactions, entities and provenance tables are populated.
Show row counts per table.

VERIFY: curl http://localhost:8000/api/ingestion/\<batch_id\>

---
## P3: Graph and detection (B3)
Read docs/detectors.md and docs/03-api-contract.md. Implement:
1. services/graph/neo4j_sync.py: sync entities and transactions from PostgreSQL to Neo4j
   (Account, Device, Phone nodes; SENT, USES, HAS_PHONE relationships) using batched UNWIND.
   Task tasks/graph_task.py and POST /api/graph/build.
2. Seed rule_config with the 4 rules, default weights and params from docs/detectors.md.
3. The four detectors in services/detection/: shared_infra.py, rapid_movement.py, cycles.py,
   fan_in_out.py. Use Pandas for windows, NetworkX for cycles. Each returns findings with
   rule_id, rule_version, score, reason (exact template), evidence, transaction_ids.
4. Add a nullable JSONB column score_breakdown to alerts. Create alert_transactions rows.
5. tasks/detect_task.py runs the chosen rules, deduplicates alerts, writes alerts.
   POST /api/detect/run and GET /api/tasks/{task_id}.
6. API: GET /api/alerts, GET /api/alerts/{id}, GET /api/graph/neighborhood (max 2 hops, 200 nodes,
   set truncated), GET /api/entities/{id}, GET /api/entities/{id}/timeline.
Run detection on the ingested data. Stop when alerts exist for all 4 rules.
Show alert counts per rule and one full alert JSON.

VERIFY: curl "http://localhost:8000/api/alerts?limit=3"

---
## P4: ML scoring (B4)
1. services/ml/features.py: per-account features: in_count, out_count, in_sum, out_sum,
   in_out_ratio, unique_counterparties, avg_amount, max_txns_per_hour, device_share_count.
2. services/ml/anomaly.py: fit IsolationForest (contamination=0.02, random_state=42) on the
   features; ml_score = min-max normalised anomaly score (0..1). Explainability: for each account
   return the top 3 features by |z-score| vs the population, as {name, value, contribution}.
3. services/detection/scoring.py: final = 0.7 * weighted_rule_score + 0.3 * ml_score, per docs/detectors.md.
   Store the breakdown in alerts.score_breakdown exactly as in the API contract.
4. Integrate into detect_task so every alert gets score_breakdown. Re-run detection.
Stop when GET /api/alerts/{id} returns a populated score_breakdown with ml top_features.

VERIFY: curl http://localhost:8000/api/alerts/\<id\>

---
## P5: Cases and feedback (B5)
1. Add tables: cases(id, title, status, priority, created_at), case_alerts(case_id, alert_id),
   case_items(id, case_id, type, ref, content JSONB, created_at),
   tasks(id, case_id, title, assignee, due_date, status),
   decisions(id, case_id, decision, rationale, decided_at),
   audit_log(id, actor, action, entity_type, entity_id, detail JSONB, created_at),
   feedback(id, alert_id, verdict, note, created_at).
2. Implement every Cases, Rules and feedback endpoint in docs/03-api-contract.md.
3. Write an audit_log row for each create, update, decision and feedback action.
4. services/summary.py: build a plain-English case summary from the alerts' reasons and evidence
   (template based, no LLM): headline, the key findings with numbers, linked entities, status.
5. Feedback loop: POST /api/alerts/{id}/feedback sets alert status. Recompute per-rule fp_rate from
   feedback; when a rule has >= 5 reviewed alerts and fp_rate > 0.5, multiply its weight by 0.9
   (minimum 0.3), bump nothing else, and log it in audit_log. GET /api/feedback/stats.
6. A closing decision of confirmed_fraud or false_positive updates the linked alerts' status.
Stop when a full case can be created, given evidence and a task, decided, and summarised via curl.
Show the sequence of calls and the summary text.

VERIFY: curl http://localhost:8000/api/cases/\<id\>/summary

---
## P6: Tests, seed and metrics (B6)
1. backend/tests: one test per detector with a tiny planted DataFrame (pattern found, reason text
   has the key numbers, a normal account NOT flagged), plus entity-resolution and validation tests.
2. data/scripts/seed_demo.py: runs ingest, graph build and detection on the enriched CSV, then
   creates one demo case from the top 3 alerts with evidence, a task and the summary.
3. data/scripts/metrics.py: compare flagged accounts with is_laundering labels; print precision,
   recall and the count of alerts per rule. State clearly that labels are synthetic benchmark data.
Stop when `cd backend && pytest -q` is green and the seed script prints the demo case id.

VERIFY: cd backend && pytest -q

---
## P7 (optional, frontend, if time): React workspace
In frontend/ (Vite React, axios, react-router-dom, react-cytoscapejs) build against
docs/03-api-contract.md only. Pages: Upload (mapping wizard + validation report), Alerts (queue with
Explain panel showing reason, evidence, score_breakdown), Graph (neighborhood, filters), Cases
(create, evidence, tasks, decision, summary, false-positive button). API base URL from VITE_API_URL.
Stop when the demo flow in docs/00-overview.md works end to end.

---
## Emergency prompts
Multiple tasks done at once:
  "Stop. List what you completed, run each verify, then continue only with the next unchecked task."
Verify failed:
  "Verify failed with: <paste>. Find the root cause, fix only that, re-run verify."
Invented a field or endpoint:
  "That doesn't match docs/02-data-schema.md or docs/03-api-contract.md. Fix the code to match; do not edit the docs."
Weak output: switch the OmniRoute model with /model and re-run the same prompt.

## If time runs out, cut in this order
1. P7 frontend polish  2. ML blend (set ml weight to 0)  3. Fan-in/out detector
Never cut: explainable reasons, provenance, case workflow.
