# Architecture

## Data flow
React UI --REST--> FastAPI
FastAPI --> PostgreSQL   (records, provenance, alerts, cases, audit)
FastAPI --> Neo4j        (graph exploration queries)
FastAPI --> Celery       (background jobs)

Celery jobs:
1. ingest: Pandas validate -> entity resolution -> load PostgreSQL (+ provenance)
2. graph:  PostgreSQL -> Neo4j (nodes and edges)
3. detect: Neo4j/NetworkX/scikit-learn -> alerts + evidence -> PostgreSQL

## Role of each technology
| Tech | Role |
|---|---|
| React | Analyst UI |
| FastAPI | REST API |
| PostgreSQL | System of record: transactions, provenance, alerts, cases, decisions, audit |
| Neo4j | Graph store: multi-hop paths, shared devices, ring neighbourhoods |
| Pandas | Parsing, cleaning, validation, feature engineering |
| NetworkX | Cycle detection, connected components, centrality on extracted subgraphs |
| scikit-learn | IsolationForest anomaly scoring, feature importances |
| Celery | Background ingestion, graph build, detection |

## Design decisions
- PostgreSQL is the source of truth; Neo4j is rebuilt from it and can be dropped safely.
- Alerts are immutable records with rule_id, rule_version, reason, and evidence JSON.
- Graph API responses are limited to 2 hops and 200 nodes.
- Scores are reproducible: store rule version and parameters with every alert.
- Final risk score = weighted rule scores + ML score, with each contribution stored.
