"""
test_api.py — Integration tests for API endpoints.
"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    """Verify GET /health returns status ok."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "postgres" in data
    assert "neo4j" in data


def test_templates_endpoints():
    """Verify templates list and create endpoints."""
    # List
    resp = client.get("/api/ingestion/mappings/templates")
    assert resp.status_code == 200
    templates = resp.json()
    assert isinstance(templates, list)
    assert len(templates) >= 1

    # Create
    new_tpl = {
        "name": "Custom AML Template",
        "mapping": {
            "timestamp": "TxnDate",
            "from_account": "Src",
            "to_account": "Dst",
            "amount": "Value",
        },
    }
    create_resp = client.post("/api/ingestion/mappings/templates", json=new_tpl)
    assert create_resp.status_code == 200
    created = create_resp.json()
    assert created["name"] == "Custom AML Template"
    assert "id" in created
