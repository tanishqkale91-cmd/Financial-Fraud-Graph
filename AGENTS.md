# Frontend agent rules (Antigravity)

Project: Financial Fraud Graph & Transaction Anomaly Workbench (React frontend).

## Boundaries
- Work ONLY inside frontend/ and docs/frontend/. Never edit backend/, data/ or other docs/ files.
- The backend is built in parallel by another agent. Build against docs/03-api-contract.md exactly.
- Stack: React (Vite), react-router-dom, axios, cytoscape + react-cytoscapejs. No other UI libraries.

## Mock switch
- VITE_USE_MOCKS=true returns fixtures from src/api/mocks/ (shapes copied from the API contract).
- VITE_USE_MOCKS=false calls the real backend at VITE_API_URL (default http://localhost:8000).
- All API calls go through src/api/client.js so the switch is in one place.

## Rules
1. Every alert screen must show reason, evidence and score_breakdown (explainability is the point).
2. Graph views request at most 2 hops, 200 nodes, and show a warning when truncated is true.
3. Humans decide: always provide confirm / false-positive / escalate actions, never auto-close.
4. No secrets in code. Config via import.meta.env.
5. Small components, one per file, named as in frontend/src/components and pages.

## Workflow
- Work one spec file at a time from docs/frontend/F*.md.
- Run npm run build after each spec. Fix errors before moving on.
- Commit after each spec: git add -A && git commit -m "feat(frontend): <what>"
