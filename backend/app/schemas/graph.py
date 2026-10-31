"""schemas/graph.py — Pydantic schemas for graph endpoints."""
from typing import List, Optional, Any
from pydantic import BaseModel


class GraphNode(BaseModel):
    id: str
    type: str  # Account, Device, Phone, Merchant, Beneficiary
    label: str
    risk: Optional[float] = 0.0


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str  # SENT, USES, HAS_PHONE
    amount: Optional[float] = None
    ts: Optional[str] = None


class GraphNeighborhoodResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    truncated: bool = False

