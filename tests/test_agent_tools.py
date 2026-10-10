import pytest
from agent.tools import get_incident, get_incident_anomalies, get_metric_summary, search_knowledge, get_service_dependencies

def test_tool_get_incident():
    # Because incident_id is dynamic based on time, we might just test an invalid one
    res = get_incident("invalid")
    assert "error" in res
    
def test_tool_get_dependencies():
    res = get_service_dependencies("api-gateway")
    assert "database" in res["api-gateway"]
    assert "payment-service" in res["api-gateway"]
    
def test_tool_search_knowledge():
    res = search_knowledge("payment service")
    assert "results" in res
    assert len(res["results"]) > 0
    
def test_tool_get_metric_summary():
    # Just basic valid schema
    res = get_metric_summary("api-gateway", "2026-10-10T10:00:00", "2026-10-10T11:00:00")
    assert "message" in res or "total_events" in res
