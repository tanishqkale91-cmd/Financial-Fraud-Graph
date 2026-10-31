# F1 Scaffold and Upload

Goal: app boots, routes work, mock switch works, Upload flow is complete.
Touch only: frontend/*

## Tasks
1. Scaffold Vite + React inside frontend/ (npm create vite@latest . -- --template react).
   Keep the folder layout already created under src/. Install axios react-router-dom cytoscape react-cytoscapejs.
2. src/api/client.js: axios instance, baseURL from VITE_API_URL. Wrapper functions for every endpoint in
   docs/03-api-contract.md; each returns the matching mock when VITE_USE_MOCKS=true.
3. Fill the mock JSON files with realistic data using the exact response shapes in the contract.
4. Layout: sidebar (Upload, Alerts, Graph, Cases), top bar with HealthBadge (GET /health, green or red).
5. UploadPage: file picker -> sample rows preview -> MappingWizard (dropdown per canonical field, prefilled
   from suggested_mapping) -> Run ingestion -> poll GET /api/ingestion/{id} -> ValidationReport
   (total, valid, invalid, by_rule counts, examples).
6. Alerts, Graph, Cases pages: routed placeholders showing raw fetched data in a table.

## Verify
npm run build passes; npm run dev shows all four routes; Upload flow completes in mock mode.

## Done when
Upload works end to end with mocks and the health badge turns green when the backend is up.
