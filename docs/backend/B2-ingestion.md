# B2 Ingestion

Goal: upload a file, map its schema, validate, resolve entities, load PostgreSQL, keep provenance.
Files touched only: backend/app/api/ingestion.py, services/ingestion/*, tasks/ingest_task.py,
schemas/ingestion.py, tests/test_ingestion.py

## Canonical fields
txn_id, timestamp, from_account, to_account, amount, currency, payment_format,
device_id, phone, ip, beneficiary_name
Required: timestamp, from_account, to_account, amount.

## Task 1: Upload and preview
- POST /api/ingestion/upload (multipart file). Save to data/processed/uploads/<batch_id>.csv,
  create an import_batches row (status=pending).
- Return {batch_id, filename, columns, sample_rows (first 5), suggested_mapping}.
- suggested_mapping: simple name matching (lowercase, strip spaces/underscores).
Verify: curl upload of the enriched CSV returns a batch_id and suggested_mapping.

## Task 2: Schema mapping
- services/ingestion/mapping.py: `apply_mapping(df, mapping) -> DataFrame` renames source
  columns to canonical names; error if a required field is unmapped.
- POST /api/ingestion/{batch_id}/mapping stores the mapping JSON on the batch.
- GET /api/ingestion/mappings/templates and POST to save reusable templates (store in a
  small table or JSON file).
Verify: unit test for apply_mapping with a renamed-column file.

## Task 3: Validation
- services/ingestion/validation.py: `validate(df) -> (valid_df, report)`.
- Rules: required fields present, timestamp parseable, amount numeric and > 0,
  from_account != to_account, duplicate txn_id, currency is 3 letters.
- Every row (valid or not) is saved to raw_records with is_valid and errors list.
- Report: {total, valid, invalid, by_rule: {rule: count}, examples: [first 5 per rule]}.
Verify: test with a file containing a negative amount and a bad date; both are flagged.

## Task 4: Entity resolution
- services/ingestion/entity_resolution.py:
  - normalise_phone: digits only, strip leading 91 or +91, keep last 10.
  - normalise_account: strip and uppercase.
  - resolve_beneficiary(name, existing): rapidfuzz token_sort_ratio >= 90 merges into an
    existing entity; store alias with match_score and a plain-English match_reason.
  - get_or_create_entity(type, canonical_key, display_name) respects the UNIQUE constraint.
- Create entities for accounts, devices, phones, beneficiaries.
Verify: test that "Rahul Sharma" and "R. Sharma" resolve to one entity with an alias row.

## Task 5: Provenance
- services/ingestion/provenance.py: `log(record_type, record_id, batch_id, step, detail)`.
- Log at each step: ingested, mapped, validated, normalised (before/after value),
  entity_merged (with score), loaded.
Verify: after an ingest, provenance has rows for one transaction covering every step.

## Task 6: Celery ingest job
- tasks/ingest_task.py: `run_ingest(batch_id)` = read file, map, validate, resolve entities,
  insert transactions in chunks of 5000, update batch counts and status.
- POST /api/ingestion/{batch_id}/run enqueues the task and returns {task_id}.
- GET /api/ingestion/{batch_id} returns status, counts, and the validation report.
Verify: run the full flow on the enriched CSV; status reaches done; transactions count equals
valid_count; entities and provenance are populated.

## Done when
End-to-end upload -> map -> run -> done works, and invalid rows are visible in the report.
Update docs/progress.md.
