from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_get_events():
    response = client.get("/events")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] > 0
    assert data["page"] == 1
    assert data["size"] == 50
    assert len(data["items"]) <= 50
    
    # Store an ID for the next test
    global test_event_id
    test_event_id = data["items"][0]["id"]

def test_get_event_by_id():
    response = client.get(f"/events/{test_event_id}")
    assert response.status_code == 200
    assert response.json()["id"] == test_event_id

def test_get_event_not_found():
    response = client.get("/events/invalid-id")
    assert response.status_code == 404

def test_get_events_pagination():
    response = client.get("/events?page=2&size=10")
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 2
    assert data["size"] == 10
    assert len(data["items"]) <= 10

def test_get_events_filtering():
    response = client.get("/events?service=api-gateway&scenario=http_error_spike")
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["service"] == "api-gateway"
        assert item["label"] == "http_error_spike"

def test_get_stats():
    response = client.get("/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_events"] > 0
    assert "service_counts" in data
    assert "scenario_counts" in data
    
    # Verify we have the 4 injected scenarios + normal
    assert "normal" in data["scenario_counts"]

def test_get_incidents_placeholder():
    response = client.get("/incidents")
    assert response.status_code == 200
    assert "items" in response.json()

def test_invalid_query_parameters():
    response = client.get('/events?page=-1')
    assert response.status_code == 422


def test_fit_and_detect_anomalies():
    response = client.post('/detect/fit')
    assert response.status_code == 200
    response = client.get('/anomalies')
    assert response.status_code == 200
    data = response.json()
    assert 'anomalies' in data
    assert data['total_analyzed_windows'] > 0


def test_get_incidents():
    response = client.get('/incidents')
    assert response.status_code == 200
    data = response.json()
    assert 'items' in data
    if data['total'] > 0:
        inc_id = data['items'][0]['id']
        resp2 = client.get(f'/incidents/{inc_id}')
        assert resp2.status_code == 200
        assert resp2.json()['id'] == inc_id


def test_incident_status_update():
    response = client.get('/incidents')
    data = response.json()
    if data['total'] > 0:
        inc_id = data['items'][0]['id']
        resp_patch = client.patch(f'/incidents/{inc_id}/status', json={'status': 'acknowledged'})
        assert resp_patch.status_code == 200
        assert resp_patch.json()['status'] == 'acknowledged'
        # Verify hydration
        resp_get = client.get(f'/incidents/{inc_id}')
        assert resp_get.json()['status'] == 'acknowledged'


def test_frontend_routes():
    resp = client.get('/dashboard/index.html')
    assert resp.status_code == 200
    assert b'OpsPilot' in resp.content


def test_metrics_endpoint():
    resp = client.get('/metrics')
    assert resp.status_code == 200
    assert b'api_requests_total' in resp.content

