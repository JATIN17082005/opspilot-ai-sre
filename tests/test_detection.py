import pytest
import pandas as pd
from detection.features import extract_features, get_feature_columns
from detection.baselines import ThresholdDetector, RollingStatsDetector
from detection.isolation_forest import IsolationForestDetector

@pytest.fixture
def sample_events():
    return [
        {"timestamp": "2026-10-10T10:00:00", "service": "api", "event_type": "metric", "metric_name": "response_time_ms", "value": 50, "label": "normal"},
        {"timestamp": "2026-10-10T10:00:30", "service": "api", "event_type": "log", "level": "INFO", "message": "ok", "label": "normal"},
        {"timestamp": "2026-10-10T10:01:00", "service": "api", "event_type": "metric", "metric_name": "response_time_ms", "value": 800, "label": "slow"},
        {"timestamp": "2026-10-10T10:01:30", "service": "api", "event_type": "log", "level": "ERROR", "message": "fail", "label": "http_error_spike"},
    ]

def test_feature_extraction(sample_events):
    df = extract_features(sample_events)
    assert len(df) == 2 # two 1-minute windows
    
    window_0 = df.iloc[0]
    assert window_0['avg_latency'] == 50.0
    assert window_0['error_count'] == 0
    assert window_0['_is_anomalous'] == 0
    
    window_1 = df.iloc[1]
    assert window_1['avg_latency'] == 800.0
    assert window_1['error_count'] == 1
    assert window_1['_is_anomalous'] == 1

def test_no_leakage(sample_events):
    df = extract_features(sample_events)
    feature_cols = get_feature_columns(df)
    assert '_is_anomalous' not in feature_cols
    assert '_fault_type' not in feature_cols
    assert 'label' not in feature_cols
    assert 'scenario' not in feature_cols

def test_threshold_detector(sample_events):
    df = extract_features(sample_events)
    detector = ThresholdDetector(latency_threshold=200, error_count_threshold=1)
    preds = detector.detect(df)
    assert not preds.iloc[0]
    assert preds.iloc[1]

def test_isolation_forest(sample_events):
    df = extract_features(sample_events)
    # Add some dummy normal rows so IF can fit
    dummy = df.iloc[[0]*10].copy()
    dummy['window'] = pd.date_range(start='2026-10-10T09:50:00', periods=10, freq='1min')
    df = pd.concat([dummy, df]).reset_index(drop=True)
    
    detector = IsolationForestDetector(contamination=0.1, random_state=42)
    detector.fit(df)
    preds = detector.detect(df)
    # The last row is the highly anomalous one (800ms, 1 error)
    assert preds.iloc[-1]
