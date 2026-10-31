# Frontend: Financial Fraud Graph & Transaction Anomaly Workbench

Investigation workbench and decision-support terminal for financial crime analysts and AML investigators.

## Architecture & Technology Stack
- **Framework**: React 18 with Vite
- **Routing**: `react-router-dom` v6
- **Network**: `axios` client configured with centralized mock/live environment switch
- **Graph Engine**: `cytoscape` & `react-cytoscapejs` with force-directed and circular layouts
- **Design System**: Impeccable Design System (`DESIGN.md`, `src/styles/tokens.css`, `src/styles/app.css`) with evidential, AA-contrast, zero-slop analyst ergonomics

## Running Locally

### 1. Installation
```bash
cd frontend
npm install
```

### 2. Run in Mock Mode (Default)
In mock mode, all API calls are served by realistic fixtures from `src/api/mocks/` with real Indian names, planted mule rings (`PLANTCYC1`, `DEV_SHARED_01`, `PLANTFAN00`, `8000EBD30`), and interactive state updates:
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser. The top-right badge will show **MOCK MODE ACTIVE**.

### 3. Switch to Live Backend
To point the frontend to the FastAPI + PostgreSQL + Neo4j backend:
1. Update `frontend/.env`:
   ```env
   VITE_USE_MOCKS=false
   VITE_API_URL=http://localhost:8000
   ```
2. Restart the dev server: `npm run dev`.
3. The top-right `HealthBadge` will query `GET /health` and display **BACKEND CONNECTED** (green) with PostgreSQL and Neo4j status.

### 4. Production Build
```bash
npm run build
```
Verify zero bundle compilation errors.

## Application Routes & Features
- `/upload`: Schema mapping wizard with required-field enforcement, 50K row ingestion runner, data validation report with explicit self-transfer quarantine, transformation provenance timeline, and resolved entity alias clusters.
- `/alerts`: Triage queue sorted by risk score descending, with multi-rule filtering. Clicking any row opens the side `ExplainPanel` with plain-English detection reasoning, rule-specific evidence structures, IsolationForest ML feature contributions, linked transactions, and investigator feedback actions (`Confirm Fraud` / `Mark False Positive`).
- `/graph`: Cytoscape topological explorer with 1-2 hop neighborhood expansion, type-encoded nodes (account, device, phone, merchant), directional arrow flows, ring highlights, and "Add view to case" evidence snapshot capture.
- `/cases` & `/cases/:id`: Case dossier management, evidence exhibits attachment, investigative task assignments, immutable compliance audit trail, and auto-generated plain-language summary with one-click SAR filing copy.
- `/rules`: Runtime detector weight configuration and closed-loop false-positive feedback analytics (`GET /api/feedback/stats`).
