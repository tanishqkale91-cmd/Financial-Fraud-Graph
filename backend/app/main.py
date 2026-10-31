"""
main.py — FastAPI application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.db import engine, init_db
from app.core.neo4j_client import ensure_constraints, run_query, close_driver
from app.api.ingestion import router as ingestion_router
from app.api.alerts import router as alerts_router
from app.api.graph import router as graph_router
from app.api.detection import router as detection_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run init_db and ensure_constraints on startup."""
    try:
        init_db()
    except Exception:
        pass
    try:
        ensure_constraints()
    except Exception:
        pass
    yield
    close_driver()


app = FastAPI(
    title="Financial Fraud Graph API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Health endpoint reporting postgres and neo4j connection status."""
    postgres_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            postgres_ok = True
    except Exception:
        postgres_ok = False

    neo4j_ok = False
    try:
        run_query("RETURN 1 AS ok")
        neo4j_ok = True
    except Exception:
        neo4j_ok = False

    return {
        "status": "ok",
        "postgres": postgres_ok,
        "neo4j": neo4j_ok,
    }


# Include Routers
app.include_router(ingestion_router)
app.include_router(alerts_router)
app.include_router(graph_router)
app.include_router(detection_router)
