# Frontend API Gaps and Proposed Workarounds

This document tracks endpoints needed by the Fraud Workbench UI that are not explicitly specified in `docs/03-api-contract.md`.

## 1. Batch Entity Resolution Review
- **Need**: The Ingestion view requires reviewing resolved entities for a batch with match scores, match reasons, and aliases.
- **Contract Spec**: Only individual lookup exists: `GET /api/entities/{id}`.
- **Gap Endpoint**: `GET /api/ingestion/{batch_id}/entities`
- **Shape**:
  ```json
  [
    {
      "id": "ACC_8000EBD30",
      "entity_type": "account",
      "display_name": "Rajesh Kumar",
      "match_score": 0.94,
      "match_reason": "Exact phone and normalized beneficiary match",
      "aliases": [
        {"alias_value": "rajesh.k@okaxis", "match_score": 0.98, "match_reason": "VPA match"},
        {"alias_value": "+91-98765-43210", "match_score": 1.0, "match_reason": "Device SIM binding"}
      ]
    }
  ]
  ```
- **Mock status**: Implemented in mock client `api/mocks/ingestion.json`.

## 2. Batch Transaction Selector for Provenance
- **Need**: Analysts need to select or view transactions within an ingested batch to inspect their 5-stage transformation provenance.
- **Contract Spec**: `GET /api/ingestion/{batch_id}/provenance?record_type=transaction&record_id=123` requires a `record_id`.
- **Gap Endpoint**: `GET /api/ingestion/{batch_id}/transactions?limit=20`
- **Shape**:
  ```json
  {
    "total": 50,
    "items": [
      {
        "id": "TXN_7701",
        "timestamp": "01-09-2022 00:20",
        "from_account": "8000EBD30",
        "to_account": "PLANTCYC1",
        "amount": 450000.0,
        "currency": "INR",
        "payment_format": "UPI"
      }
    ]
  }
  ```
- **Mock status**: Implemented in mock client `api/mocks/ingestion.json`.
