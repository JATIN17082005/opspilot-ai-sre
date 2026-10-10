import pytest
from fastapi.testclient import TestClient
from backend.main import app
import agent.orchestrator as orch
from unittest.mock import patch

client = TestClient(app)

def test_create_investigation_mock():
    # Test completely dead model
    original_url = orch.OLLAMA_URL
    orch.OLLAMA_URL = 'http://localhost:9999/api/chat'
    try:
        req = {'incident_id': 'dummy-incident', 'question': 'Root cause?'}
        resp = client.post('/investigations', json=req)
        assert resp.status_code == 200
        data = resp.json()
        assert 'Automated fallback report' in data['summary']
        assert 'failed_model_unavailable' in data['status']
    finally:
        orch.OLLAMA_URL = original_url

def test_create_investigation_model_skips_tools():
    # Test model alive but skips tools (outputs done immediately)
    class MockResponse:
        def __init__(self, json_data, status_code=200):
            self._json = json_data
            self.status_code = status_code
        def json(self): return self._json
        
    def mock_post(url, json=None, **kwargs):
        # We simulate the model returning '{"action": "done"}' for phase 1
        # Then for phase 2, returning the final report schema
        if "done" not in str(json):
            # Phase 1
            return MockResponse({"message": {"content": '{"action": "done"}'}})
        else:
            # Phase 2
            return MockResponse({"message": {"content": '{"summary": "Test Summary", "observed_facts": ["fact"], "affected_services": [], "ranked_root_causes": [], "evidence_for": [], "evidence_against": [], "runbook_references": [], "recommended_steps": [], "remaining_uncertainty": "none", "confidence": "high"}'}})
            
    import json
    try:
        with open('data/incident_status.json', 'r') as f:
            status_data = json.load(f)
            valid_incident_id = list(status_data.keys())[0] if status_data else "test-incident"
    except Exception:
        valid_incident_id = "test-incident"

    with patch('requests.post', side_effect=mock_post):
        req = {'incident_id': valid_incident_id, 'question': 'Root cause?'}
        resp = client.post('/investigations', json=req)
        assert resp.status_code == 200
        data = resp.json()
        
        # Should have successfully gathered evidence via code-controlled fallback
        assert data['status'] == 'success'
        assert data['summary'] == 'Test Summary'
        
        # Verify the audit log contains the system-level pre-fetches
        audit_sources = [log['source'] for log in data['tool_call_audit']]
        assert 'system' in audit_sources
        
        tool_names = [log['tool'] for log in data['tool_call_audit']]
        assert 'get_incident' in tool_names
        assert 'get_incident_anomalies' in tool_names

def test_missing_evidence_fallback():
    class MockResponse:
        def __init__(self, json_data, status_code=200):
            self._json = json_data
            self.status_code = status_code
        def json(self): return self._json
        
    def mock_post(url, json=None, **kwargs):
        if "done" not in str(json):
            return MockResponse({"message": {"content": '{"action": "done"}'}})
        return MockResponse({"message": {"content": '{"summary": "Test"}'}})
        
    with patch('requests.post', side_effect=mock_post):
        req = {'incident_id': 'invalid-id-12345', 'question': 'Root cause?'}
        resp = client.post('/investigations', json=req)
        assert resp.status_code == 200
        data = resp.json()
        assert data['status'] == 'failed_missing_evidence'

def test_citation_validation_strips_hallucinated_citations():
    class MockResponse:
        def __init__(self, json_data, status_code=200):
            self._json = json_data
            self.status_code = status_code
        def json(self): return self._json
        
    def mock_post(url, json=None, **kwargs):
        if "done" not in str(json):
            return MockResponse({"message": {"content": '{"action": "done"}'}})
        else:
            return MockResponse({"message": {"content": '{"summary": "Test Summary", "evidence_for": [{"source_type": "telemetry", "source_id": "hallucinated_id", "description": "Fake"}]}'}})
            
    import json
    try:
        with open('data/incident_status.json', 'r') as f:
            status_data = json.load(f)
            valid_incident_id = list(status_data.keys())[0] if status_data else "test-incident"
    except Exception:
        valid_incident_id = "test-incident"

    with patch('requests.post', side_effect=mock_post):
        req = {'incident_id': valid_incident_id, 'question': 'Root cause?'}
        resp = client.post('/investigations', json=req)
        assert resp.status_code == 200
        data = resp.json()
        assert data['status'] == 'success'
        assert len(data['evidence_for']) == 0

def test_citation_validation_mismatched_type():
    class MockResponse:
        def __init__(self, json_data, status_code=200):
            self._json = json_data
            self.status_code = status_code
        def json(self): return self._json
        
    def mock_post(url, json=None, **kwargs):
        if "done" not in str(json):
            return MockResponse({"message": {"content": '{"action": "done"}'}})
        else:
            return MockResponse({"message": {"content": '{"summary": "Test Summary", "evidence_for": [{"source_type": "runbook", "source_id": "test-incident", "description": "Fake"}]}'}})
            
    import json
    try:
        with open('data/incident_status.json', 'r') as f:
            status_data = json.load(f)
            valid_incident_id = list(status_data.keys())[0] if status_data else "test-incident"
    except Exception:
        valid_incident_id = "test-incident"

    with patch('requests.post', side_effect=mock_post):
        req = {'incident_id': valid_incident_id, 'question': 'Root cause?'}
        resp = client.post('/investigations', json=req)
        assert resp.status_code == 200
        data = resp.json()
        assert data['status'] == 'success'
        assert len(data['evidence_for']) == 0

def test_citation_validation_strips_none():
    class MockResponse:
        def __init__(self, json_data, status_code=200):
            self._json = json_data
            self.status_code = status_code
        def json(self): return self._json
        
    def mock_post(url, json=None, **kwargs):
        if "done" not in str(json):
            return MockResponse({"message": {"content": '{"action": "done"}'}})
        else:
            return MockResponse({"message": {"content": '{"summary": "Test Summary", "evidence_for": [{"source_type": "runbook", "source_id": "None", "description": "Fake"}]}'}})
            
    import json
    try:
        with open('data/incident_status.json', 'r') as f:
            status_data = json.load(f)
            valid_incident_id = list(status_data.keys())[0] if status_data else "test-incident"
    except Exception:
        valid_incident_id = "test-incident"

    with patch('requests.post', side_effect=mock_post):
        req = {'incident_id': valid_incident_id, 'question': 'Root cause?'}
        resp = client.post('/investigations', json=req)
        assert resp.status_code == 200
        data = resp.json()
        assert data['status'] == 'success'
        assert len(data['evidence_for']) == 0
