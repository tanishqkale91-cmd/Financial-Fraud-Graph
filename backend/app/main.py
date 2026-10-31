"""
main.py — FastAPI application entry point.

FastAPI concept: `app` is the application object.
You attach routers (groups of related endpoints) to it.
The `lifespan` function runs once at startup to create DB tables.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import engine, Base
import app.models  # noqa: F401 — importing models registers them with Base
from app.api import ingestion as ingestion_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all tables on startup if they don't exist yet."""
    Base.metadata.create_all(bind=engine)
    yield  # app runs here
    # (nothing to clean up on shutdown for now)


app = FastAPI(
    title="Financial Fraud Graph API",
    version="0.1.0",
    lifespan=lifespan,
)

# Allow the React frontend (running on localhost:3000) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Quick check — returns 200 if the API is up."""
    return {"status": "ok"}

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(ingestion_router.router)
