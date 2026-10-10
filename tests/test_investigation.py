import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_create_investigation_mock():
    # Since Ollama is offline, the orchestrator should gracefully fallback to mock
    # because of the Exception catch in `investigate_incident`.
    # Let's hit the endpoint.
    req = {
        "incident_id": "dummy-incident",
        "question": "What is the root cause?"
    }
    
    resp = client.post("/investigations", json=req)
    assert resp.status_code == 200
    data = resp.json()
    
    # Check if mock fallback kicked in
    assert data["investigation_id"] is not None
    assert data["incident_id"] == "dummy-incident"
    assert "LLM unavailable" in data["remaining_uncertainty"] or "Automated fallback" in data["summary"]
    
    # Test invalid schema
    resp2 = client.post("/investigations", json={"incident_id": ""})
    assert resp2.status_code == 422 # Pydantic validation error for missing field
