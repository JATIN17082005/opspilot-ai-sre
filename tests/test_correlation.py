import pytest
from datetime import datetime
from backend.schemas import AnomalyWindow
from detection.correlation import group_anomalies_into_incidents

def test_grouping():
    w1 = AnomalyWindow(window=datetime(2026, 10, 10, 10, 0), is_anomalous=True, score=0.5, features={})
    w2 = AnomalyWindow(window=datetime(2026, 10, 10, 10, 2), is_anomalous=True, score=0.5, features={})
    w3 = AnomalyWindow(window=datetime(2026, 10, 10, 10, 10), is_anomalous=True, score=0.5, features={})
    events = [{'timestamp': '2026-10-10T10:00:30Z', 'service': 'database', 'event_type': 'log', 'level': 'ERROR', 'message': 'err', 'label': 'fault'}]
    incidents = group_anomalies_into_incidents([w1, w2, w3], events, max_gap_minutes=5)
    assert len(incidents) == 2
    assert incidents[0].duration_seconds == 180.0
    assert 'database' in incidents[0].affected_services
    assert incidents[0].root_cause_candidates[0].service == 'database'

