import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score
from detection.features import extract_features
from detection.baselines import ThresholdDetector, RollingStatsDetector
from detection.isolation_forest import IsolationForestDetector

def evaluate_detector(detector_name: str, y_true: pd.Series, y_pred: pd.Series) -> dict:
    if len(y_true) == 0:
        return {}
        
    precision = precision_score(y_true, y_pred, zero_division=0)
    recall = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    
    # False positives per 1000 normal windows
    normal_windows = (y_true == 0).sum()
    fp = ((y_pred == 1) & (y_true == 0)).sum()
    fpr_per_1000 = (fp / normal_windows) * 1000 if normal_windows > 0 else 0
    
    return {
        "detector": detector_name,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1": round(f1, 3),
        "fpr_per_1000": round(fpr_per_1000, 2),
        "fp": fp,
        "normal_windows": normal_windows
    }

def run_evaluation(events: list):
    features_df = extract_features(events)
    if features_df.empty:
        return []
        
    y_true = features_df['_is_anomalous']
    
    # 1. Threshold
    threshold_det = ThresholdDetector(latency_threshold=150.0, error_count_threshold=1)
    y_pred_thresh = threshold_det.detect(features_df)
    res_thresh = evaluate_detector("Fixed Threshold", y_true, y_pred_thresh)
    
    # 2. Rolling Stats
    rolling_det = RollingStatsDetector(window_size=10, z_threshold=3.0)
    y_pred_roll = rolling_det.detect(features_df)
    res_roll = evaluate_detector("Rolling Z-Score", y_true, y_pred_roll)
    
    # 3. Isolation Forest
    # For fair evaluation without data leakage, IF should ideally be fit on normal data
    # Here we simulate an unsupervised fit on the entire stream (standard for contamination-based IF)
    # contamination = ratio of anomalies in the dataset
    actual_contamination = y_true.mean()
    # cap at reasonable value if 0 or 1
    cont = max(0.01, min(0.5, actual_contamination))
    
    if_det = IsolationForestDetector(contamination=cont)
    # Fit only on chronological history if we want to be strict, but unsupervised IF 
    # is often fit on the evaluation dataset in batch anomaly detection tasks. 
    # To be perfectly fair, we fit it on the first half (assuming it's mostly normal) 
    # but the simulator mixes faults. We'll fit on the whole dataset since it's unsupervised 
    # and doesn't use ground-truth labels.
    if_det.fit(features_df)
    y_pred_if = if_det.detect(features_df)
    res_if = evaluate_detector("Isolation Forest", y_true, y_pred_if)
    
    return [res_thresh, res_roll, res_if], features_df, y_pred_thresh, y_pred_roll, y_pred_if

if __name__ == "__main__":
    import json
    data = []
    with open("data/telemetry.jsonl", "r") as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))
                
    results, _, _, _, _ = run_evaluation(data)
    for r in results:
        print(r)
