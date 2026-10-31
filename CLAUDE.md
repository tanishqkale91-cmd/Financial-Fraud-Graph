# Financial Fraud Graph & Transaction Anomaly Workbench

## Goal
An investigation tool that finds suspicious relationships across accounts, devices,
beneficiaries, and transactions. Every alert must be explainable, and humans make
the final case decisions.

## Mandatory stack (never replace or remove)
React, FastAPI, PostgreSQL, Neo4j, Pandas, NetworkX, scikit-learn, Celery.
Allowed additions: Redis (Celery broker), rapidfuzz, SQLAlchemy, Alembic.

## Repo layout
- backend/app/api        FastAPI routers
- backend/app/core       config, DB sessions, Neo4j client, Celery app
- backend/app/models     SQLAlchemy models
- backend/app/schemas    Pydantic models
- backend/app/services   ingestion, graph, detection, ml, summary
- backend/app/tasks      Celery tasks
- backend/tests          pytest
- data/scripts           dataset enrichment
- docs/                  specs (read before coding)
- docs/backend/B*.md     phase specs

## Commands (run from repo root)
- API:    cd backend && uvicorn app.main:app --reload --port 8000
- Worker: cd backend && celery -A app.core.celery_app worker --loglevel=info
          (Windows: add --pool=solo)
- Tests:  cd backend && pytest -q

## Hard rules
1. Read the relevant docs/ file before writing code. Do not invent schema or endpoints;
   follow docs/02-data-schema.md and docs/03-api-contract.md exactly.
2. Every alert stores: rule_id, rule_version, score, reason (plain English), evidence (JSON).
3. Every imported record writes a provenance row (source file, row number, batch, transformations).
4. No secrets in code. Read all config from .env via app/core/config.py.
5. Type hints and a short docstring on every function. Keep functions small.
6. Only edit files listed in the current task. Ask before touching anything else.
7. Long work (ingestion, graph build, detection) runs as Celery tasks, not in request handlers.

## Workflow
- Do ONE task at a time from the active phase file in docs/backend/.
- Run the task's verify command. If it fails, fix it before moving on.
- When it passes, tick it in docs/progress.md and stop.
- Do not start the next task unless asked.
