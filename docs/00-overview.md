# Overview

## Problem (Problem Statement 07)
Build an investigation workbench to discover suspicious relationships across accounts,
devices, beneficiaries, and transactions. Explain every alert and support human-led
case decisions.

## Modules
1. Data ingestion: import files, map schema, validate, resolve entities, keep provenance.
2. Graph and detection: model entities as a graph, detect rapid fund movement,
   circular transfers, and shared infrastructure, score anomalies with traceable evidence.
3. Investigation workspace: graph exploration, filters, timelines, cases, evidence,
   tasks, decisions, summaries, and false-positive feedback.

## Dataset
Kaggle "IBM Transactions for Anti Money Laundering" (small variant, sampled to
50k-100k rows). Enriched by data/scripts/enrich_dataset.py with synthetic device_id,
phone, ip, and noisy beneficiary names. Enrichment is synthetic and must be stated
as such in the README.

## In scope
- CSV upload with schema mapping and validation
- Entity resolution (normalised IDs/phones plus fuzzy names)
- Provenance for every record and transformation
- Four detectors: shared infrastructure, rapid pass-through, circular transfers, fan-in/fan-out
- IsolationForest anomaly score combined with rule scores
- Cases, evidence, tasks, decisions, audit log
- Explainable summaries and false-positive feedback

## Cut list (only if time runs out, in this order)
1. Supervised model
2. Community detection
3. Retraining from feedback (keep simple threshold adjustment)

## Never cut
Explainability, provenance, and the case workflow.

## Success criteria
- Upload a file, see validation results, and see data in PostgreSQL with provenance
- Planted fraud rings appear as alerts, each with a reason and evidence
- An analyst can open a case, attach evidence, assign a task, and record a decision
- Marking a false positive is stored and affects later scoring
