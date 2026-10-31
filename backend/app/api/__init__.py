"""api package initialization."""
from app.api.ingestion import router as ingestion_router
from app.api.alerts import router as alerts_router
from app.api.graph import router as graph_router
from app.api.detection import router as detection_router

__all__ = [
    "ingestion_router",
    "alerts_router",
    "graph_router",
    "detection_router",
]

