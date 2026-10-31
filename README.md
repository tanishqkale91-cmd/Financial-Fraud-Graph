# Financial Fraud Graph & Transaction Anomaly Workbench

> Hacknova 2026 — Problem Statement 07

An investigation tool for fraud analysts. Ingests transaction data, finds suspicious patterns
in a graph, explains every alert, and lets analysts open cases and record decisions.
**No auto-blocking** — humans decide.

---

## Stack

| Tool | Purpose |
|------|---------|
| **React** | Frontend — graph view, timeline, case management |
| **FastAPI** | REST API |
| **PostgreSQL** | Source of truth — all records |
| **Neo4j** | Graph store — account/transaction graph |
| **Pandas** | CSV ingestion, validation, time-window rules |
| **NetworkX** | Cycle detection, connected components |
| **scikit-learn** | Isolation Forest anomaly scoring |
| **Celery + Redis** | Background tasks — import, detection, graph load |

---

## Quick Start

```bash
# 1. Copy the example env file and set passwords
cp .env.example .env
# Edit .env if desired (defaults work for local dev)

# 2. Start all services
docker compose up --build

# 3. API is live at http://localhost:8000
# 4. Neo4j browser at http://localhost:7474
# 5. React frontend (Step 4 onwards) at http://localhost:3000
```

### Generate dev data (first time)

```bash
pip install pandas          # only needed to run the generator locally
python data/generate_data.py
# Writes data/transactions.csv and data/account_attributes.csv
```

---

## Disclosure

### AI Tools Used
- Google Antigravity (Gemini) — code generation, architecture planning, debugging

### Synthetic Data
- `data/transactions.csv` and `data/account_attributes.csv` are 100% synthetically generated
  by `data/generate_data.py` using a fixed random seed (42).
- When using the IBM AML dataset (`HI-Small_Trans.csv`):
  - `device_id` and `phone` fields are **synthesized** (not present in the original dataset).
  - Node identity uses `{bank}_{account}` (not account number alone).
  - Only laundering transactions + their neighbors + a random normal sample are loaded into Neo4j.

### Third-Party Datasets
- IBM AML "HI-Small" dataset (not included in repo; download separately if needed).

### My Own Contribution
- Problem definition, fraud pattern design, architecture decisions, testing, and demo.

---

## Fraud Detection Rules

| Pattern | Method | Evidence stored |
|---------|--------|----------------|
| Rapid fund movement | Pandas 60-second window | Txn IDs in chain |
| Circular transfers | NetworkX `simple_cycles` | All cycle txn IDs |
| Shared infrastructure | Connected components / degree | Account group IDs |
| General anomaly | Isolation Forest score | Feature vector |

Every alert stores: `rule`, `reason` (plain English), `evidence_txn_ids` (list).

---

## Project Layout

```
Financial-Fraud-Graph/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── core/         # config, db, celery
│   │   ├── models.py     # SQLAlchemy ORM tables
│   │   ├── services/     # business logic (detection, ingestion, graph, ml)
│   │   └── tasks/        # Celery tasks
│   ├── tests/
│   └── requirements.txt
├── data/
│   ├── generate_data.py
│   ├── transactions.csv      (gitignored after generation)
│   └── account_attributes.csv
├── frontend/             (Step 4)
├── docker-compose.yml
└── .env.example
```
