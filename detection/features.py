import pandas as pd
from typing import List, Dict

def extract_features(events: List[Dict]) -> pd.DataFrame:
    """
    Groups events into 1-minute windows and extracts numerical features.
    Excludes all ground-truth fields like 'label' or 'scenario' from the features.
    """
    if not events:
        return pd.DataFrame()
        
    df = pd.DataFrame(events)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Floor to 1-minute windows for grouping
    df['window'] = df['timestamp'].dt.floor('1min')
    
    windows = []
    
    for window_time, group in df.groupby('window'):
        # Ground-truth label for evaluation (1 if any fault, 0 if normal)
        # Note: We keep this separate from features
        labels = group['label'].unique()
        is_anomalous = any(l != 'normal' for l in labels)
        fault_type = next((l for l in labels if l != 'normal'), 'normal')
        
        # Features
        metrics = group[group['event_type'] == 'metric']
        logs = group[group['event_type'] == 'log']
        
        # Avg Latency
        latency_metrics = metrics[metrics['metric_name'] == 'response_time_ms']
        avg_latency = latency_metrics['value'].mean() if not latency_metrics.empty else 0.0
        max_latency = latency_metrics['value'].max() if not latency_metrics.empty else 0.0
        
        # Log counts
        error_count = len(logs[logs['level'].isin(['ERROR', 'FATAL'])])
        warn_count = len(logs[logs['level'] == 'WARN'])
        
        # Other metrics like error_rate or active_connections (filled with defaults if absent)
        error_rate_metrics = metrics[metrics['metric_name'] == 'error_rate']
        error_rate = error_rate_metrics['value'].max() if not error_rate_metrics.empty else 0.0
        
        windows.append({
            'window': window_time,
            'avg_latency': avg_latency,
            'max_latency': max_latency,
            'error_count': error_count,
            'warn_count': warn_count,
            'error_rate': error_rate,
            # Ground truth fields (only for evaluation, stripped before detection)
            '_is_anomalous': int(is_anomalous),
            '_fault_type': fault_type
        })
        
    features_df = pd.DataFrame(windows).sort_values('window').reset_index(drop=True)
    return features_df

def get_feature_columns(df: pd.DataFrame) -> List[str]:
    """Returns only the numerical feature columns used for detection."""
    cols = list(df.columns)
    cols.remove('window')
    if '_is_anomalous' in cols:
        cols.remove('_is_anomalous')
    if '_fault_type' in cols:
        cols.remove('_fault_type')
    return cols
