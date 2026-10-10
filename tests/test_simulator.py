import json
import os

def test_telemetry_file_exists():
    assert os.path.exists("data/telemetry.jsonl"), "Telemetry file should exist"

def test_telemetry_format():
    with open("data/telemetry.jsonl", "r") as f:
        lines = f.readlines()
        assert len(lines) > 0, "Telemetry file should not be empty"
        
        # Check first event
        event = json.loads(lines[0])
        assert "timestamp" in event
        assert "service" in event
        assert "event_type" in event
        assert "label" in event

def test_fault_labels_present():
    labels = set()
    with open("data/telemetry.jsonl", "r") as f:
        for line in f:
            event = json.loads(line)
            labels.add(event["label"])
            
    expected_labels = {"normal", "http_error_spike", "slow_responses", "db_slowdown", "db_outage"}
    for exp in expected_labels:
        assert exp in labels, f"Expected fault label {exp} not found in telemetry"
