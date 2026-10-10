import pytest
import os
import json
from fastapi.testclient import TestClient
from backend.main import app
from agent.orchestrator import execute_tool

client = TestClient(app)

def test_tool_injection_protection():
    # Attempt to inject large arguments or unknown tools
    res1 = execute_tool({"name": "unknown_tool", "arguments": {}})
    assert "error" in res1
    
    res2 = execute_tool({
        "name": "get_incident", 
        "arguments": {"incident_id": "A" * 1000} # Exceeds 500 limit set in M7
    })
    assert "error" in res2
    assert "exceeds length limit" in res2["error"]

def test_api_invalid_payloads():
    # Invalid pagination
    resp = client.get("/events?page=-1")
    assert resp.status_code == 422
    
    # Missing fields
    resp = client.patch("/incidents/123/status", json={})
    assert resp.status_code == 422
    
    # Invalid status transition / enum violation
    resp = client.patch("/incidents/123/status", json={"status": "hacked"})
    assert resp.status_code == 422

def test_incident_repo_corruption_recovery():
    # If the JSON file is corrupt, it should fallback to {} instead of crashing
    test_path = "data/test_status.json"
    with open(test_path, "w") as f:
        f.write("{ invalid json")
        
    from backend.incident_repo import IncidentStatusRepository
    repo = IncidentStatusRepository(test_path)
    assert repo.get_status("unknown") == "open"
    
    # Cleanup
    if os.path.exists(test_path):
        os.remove(test_path)

def test_telemetry_immutable_corruption_handling():
    # If a line is corrupt, JSONLRepo ignores it
    test_path = "data/test_telemetry.jsonl"
    with open(test_path, "w") as f:
        f.write('{"id": "1", "service": "api-gateway"}\n')
        f.write('corrupt line\n')
        f.write('{"id": "2", "service": "database"}\n')
        
    from backend.repository import JSONLRepository
    repo = JSONLRepository(test_path)
    assert len(repo.events) == 2
    
    # Cleanup
    if os.path.exists(test_path):
        os.remove(test_path)
