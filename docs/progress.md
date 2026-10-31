# Progress

## B1 Foundation
- [x] Task 1: Config
- [x] Task 2: PostgreSQL models and init_db
- [x] Task 3: Neo4j client and constraints
- [x] Task 4: Celery app and ping task
- [x] Task 5: FastAPI app with /health
- [x] Task 6: Dataset enrichment (transactions_enriched.csv 50,023 rows verified)

## B2 Ingestion
- [x] Upload endpoint (POST /api/ingestion/upload)
- [x] Schema mapping (apply_mapping, suggest_mapping, templates)
- [x] Validation report (validate with self-transfer preservation)
- [x] Entity resolution (normalize phone/account, fuzzy beneficiary)
- [x] Provenance logging (log, bulk_log, get_provenance)
- [x] Celery ingest task (run_ingest batch execution)

## B3 Graph and detection
- [ ] Neo4j sync
- [ ] Shared infrastructure detector
- [ ] Rapid pass-through detector
- [ ] Circular transfer detector
- [ ] Fan-in/fan-out detector
- [ ] Alerts with evidence

## B4 ML scoring
- [ ] Features
- [ ] IsolationForest
- [ ] Combined explainable score

## B5 Cases and feedback
- [ ] Case, task, decision endpoints
- [ ] Audit log
- [ ] False-positive feedback
- [ ] Summary generator

## B6 Testing and seed
- [ ] pytest with planted rings
- [ ] Demo seed script
- [ ] Metrics against dataset labels
