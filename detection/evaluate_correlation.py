import json
import pandas as pd
from datetime import datetime, timedelta
from detection.features import extract_features
from detection.isolation_forest import IsolationForestDetector
from detection.correlation import group_anomalies_into_incidents, AnomalyWindow

FAULT_ROOT_MAPPING = {
    "db_slowdown": "database",
    "db_outage": "database",
    "http_error_spike": "api-gateway",
    "slow_responses": "payment-service"
}

def evaluate_incidents():
    # Load events
    events = []
    with open("data/telemetry.jsonl", "r") as f:
        for line in f:
            if line.strip():
                events.append(json.loads(line))
                
    features_df = extract_features(events)
    
    # Ground truth intervals
    faults = []
    current_fault = None
    start = None
    
    for _, row in features_df.iterrows():
        label = row['_fault_type']
        if label != 'normal':
            if current_fault != label:
                if current_fault is not None:
                    faults.append({"fault": current_fault, "start": start, "end": prev})
                current_fault = label
                start = row['window']
            prev = row['window']
        else:
            if current_fault is not None:
                faults.append({"fault": current_fault, "start": start, "end": prev})
                current_fault = None
                start = None
                
    if current_fault is not None:
        faults.append({"fault": current_fault, "start": start, "end": prev})

    # Run detection & correlation
    detector = IsolationForestDetector(contamination=0.1)
    detector.fit(features_df)
    preds = detector.detect(features_df)
    
    anomalies = []
    for i in range(len(features_df)):
        if preds.iloc[i]:
            anomalies.append(AnomalyWindow(
                window=features_df.iloc[i]['window'],
                is_anomalous=True,
                score=0.0,
                features={}
            ))
            
    incidents = group_anomalies_into_incidents(anomalies, events, max_gap_minutes=5)
    
    # Evaluation Logic
    total_injected = len(faults)
    total_detected = len(incidents)
    
    correct_detections = 0
    top1_correct = 0
    top3_correct = 0
    
    print("=== Offline Evaluation ===")
    print(f"Total injected faults: {total_injected}")
    print(f"Total incidents generated: {total_detected}\n")
    
    for f in faults:
        f_start = f['start'].replace(tzinfo=None)
        f_end = f['end'].replace(tzinfo=None)
        expected_root = FAULT_ROOT_MAPPING.get(f['fault'])
        
        # Find overlapping incidents
        overlaps = []
        for inc in incidents:
            i_start = inc.first_observed.replace(tzinfo=None)
            i_end = inc.last_observed.replace(tzinfo=None)
            
            # check overlap
            if not (i_end < f_start or i_start > f_end):
                overlaps.append(inc)
                
        if overlaps:
            correct_detections += 1
            inc = overlaps[0] # Take first overlapping
            print(f"[DETECTED] {f['fault']} ({f_start} to {f_end}) -> Incident {inc.id[:8]}")
            
            if inc.root_cause_candidates:
                top_1 = inc.root_cause_candidates[0].service
                top_3 = [c.service for c in inc.root_cause_candidates[:3]]
                
                if top_1 == expected_root:
                    top1_correct += 1
                if expected_root in top_3:
                    top3_correct += 1
                    
                print(f"  Expected root: {expected_root} | Top predicted: {top_1} (Rank 1 score: {inc.root_cause_candidates[0].score})")
            else:
                print(f"  Expected root: {expected_root} | Insufficient evidence")
        else:
            print(f"[MISSED] {f['fault']} ({f_start} to {f_end})")
            
    precision = correct_detections / total_detected if total_detected > 0 else 0
    recall = correct_detections / total_injected if total_injected > 0 else 0
    
    print(f"\nPrecision: {precision:.2f}")
    print(f"Recall: {recall:.2f}")
    print(f"Top-1 Accuracy: {top1_correct}/{total_injected}")
    print(f"Top-3 Accuracy: {top3_correct}/{total_injected}")

if __name__ == "__main__":
    evaluate_incidents()
