# B1 Foundation

Goal: the app boots, connects to PostgreSQL, Neo4j and Celery, and the dataset is enriched.
Files touched only: backend/app/core/*, backend/app/models/*, backend/app/main.py,
data/scripts/enrich_dataset.py, backend/requirements.txt

## Task 1: Config
- backend/app/core/config.py: pydantic-settings class `Settings` reading .env
  (DATABASE_URL, NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, CELERY_BROKER_URL, CELERY_RESULT_BACKEND).
- Export `settings = Settings()`.
Verify: `cd backend && python -c "from app.core.config import settings; print(settings.DATABASE_URL)"`

## Task 2: PostgreSQL
- core/db.py: SQLAlchemy engine, SessionLocal, Base, and `get_db()` dependency.
- models/: one file per table in docs/02-data-schema.md (batch, raw_record, entity,
  alias, transaction, provenance, rule_config, alert). Case-related tables are NOT created yet.
- core/db.py: `init_db()` calls Base.metadata.create_all.
Verify: run `init_db()`, then `psql -U postgres -d fraud -c "\dt"` lists all tables.

## Task 3: Neo4j client
- core/neo4j_client.py: `get_driver()` and `run_query(cypher, params)`.
- `ensure_constraints()` creates UNIQUE id constraints for each label.
Verify: `python -c "from app.core.neo4j_client import run_query; print(run_query('RETURN 1 AS ok'))"`

## Task 4: Celery
- core/celery_app.py: Celery app named "fraud", broker/backend from settings,
  autodiscover app.tasks.
- tasks/ingest_task.py: a `ping` task returning "pong".
Verify: start the worker, then `python -c "from app.tasks.ingest_task import ping; print(ping.delay().get(timeout=10))"` prints pong.

## Task 5: FastAPI app
- main.py: create app, call init_db and ensure_constraints on startup, add CORS for http://localhost:5173.
- GET /health returns {"status":"ok","postgres":bool,"neo4j":bool}.
Verify: `curl http://localhost:8000/health` shows both true.

## Task 6: Dataset enrichment
- data/scripts/enrich_dataset.py, run as:
  `python data/scripts/enrich_dataset.py --input data/raw/<file>.csv --rows 80000 --seed 42`
- IBM columns: Timestamp, From Bank, Account (sender), To Bank, Account (receiver; pandas names it
  "Account.1"), Amount Received, Receiving Currency, Amount Paid, Payment Currency,
  Payment Format, Is Laundering. Check the real header and adapt.
- Sampling: keep ALL Is Laundering=1 rows in the sample, then fill with random normal rows.
- Output data/processed/transactions_enriched.csv with columns:
  txn_id, timestamp, from_account, to_account, amount, currency, payment_format,
  device_id, phone, ip, beneficiary_name, is_laundering
- Enrichment (synthetic, fixed seed):
  - device_id, phone, ip per sending account; most accounts unique.
  - Accounts appearing in laundering rows are grouped in sets of 3-6 and given ONE shared device_id
    and some shared phones (the "shared infrastructure" pattern).
  - beneficiary_name: realistic Indian names; ~20% get noisy variants ("Rahul Sharma",
    "R. Sharma", "RAHUL SHARMA", "Rahul Sharmaa").
  - Messy formats: some phones with +91 or spaces, some account ids lower/upper case.
- Print a summary: rows, laundering rows, number of shared-device groups.
Verify: output file exists; summary shows shared-device groups > 0.

## Done when
/health is green, the Celery ping works, all tables exist, enriched CSV is generated.
Update docs/progress.md.
