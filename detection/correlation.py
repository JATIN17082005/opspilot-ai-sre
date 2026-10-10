import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any
import pandas as pd
from backend.schemas import Incident, RootCauseCandidate, AnomalyWindow

# Documented dependencies based on system architecture
# Key depends on values. If key and value are both anomalous, value is a stronger root cause candidate.
SERVICE_DEPENDENCIES = {
    "api-gateway": ["database", "payment-service", "auth-service"],
    "payment-service": ["database"],
    "auth-service": ["database"]
}

def group_anomalies_into_incidents(
    anomaly_windows: List[AnomalyWindow], 
    all_events: List[Dict[str, Any]], 
    max_gap_minutes: int = 5
) -> List[Incident]:
    
    if not anomaly_windows:
        return []
        
    # Sort windows chronologically
    anomalies = sorted([w for w in anomaly_windows if w.is_anomalous], key=lambda w: w.window)
    if not anomalies:
        return []
        
    incidents = []
    current_incident_windows = [anomalies[0]]
    
    for i in range(1, len(anomalies)):
        curr_window = anomalies[i].window
        prev_window = current_incident_windows[-1].window
        
        # Calculate gap in minutes
        gap = (curr_window - prev_window).total_seconds() / 60.0
        
        if gap <= max_gap_minutes:
            current_incident_windows.append(anomalies[i])
        else:
            incidents.append(_build_incident(current_incident_windows, all_events))
            current_incident_windows = [anomalies[i]]
            
    if current_incident_windows:
        incidents.append(_build_incident(current_incident_windows, all_events))
        
    return incidents

def _build_incident(windows: List[AnomalyWindow], all_events: List[Dict[str, Any]]) -> Incident:
    first_obs = windows[0].window
    # A window covers 1 minute, so add 1 minute to the last window for the end time
    last_obs = windows[-1].window + timedelta(minutes=1)
    duration = (last_obs - first_obs).total_seconds()
    
    # Extract raw events that occurred during this incident span
    incident_events = []
    for event in all_events:
        event_time = datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))
        event_time = event_time.replace(tzinfo=None)
            
        w_start = first_obs.replace(tzinfo=None)
        w_end = last_obs.replace(tzinfo=None)
        
        if w_start <= event_time < w_end:
            incident_events.append(event)
            
    # Determine affected services and symptoms
    affected_services = set()
    symptoms = set()
    service_anomaly_scores = {}
    
    for event in incident_events:
        svc = event.get('service')
        affected_services.add(svc)
        
        if svc not in service_anomaly_scores:
            service_anomaly_scores[svc] = {"errors": 0, "latency_spikes": 0}
            
        if event.get('event_type') == 'log' and event.get('level') in ['ERROR', 'FATAL']:
            symptoms.add(f"Errors in {svc}")
            service_anomaly_scores[svc]["errors"] += 1
            
        if event.get('event_type') == 'metric' and event.get('metric_name') == 'response_time_ms':
            val = event.get('value', 0)
            if val > 200: # Threshold for symptom
                symptoms.add(f"High latency in {svc}")
                service_anomaly_scores[svc]["latency_spikes"] += 1
                
        if event.get('event_type') == 'metric' and event.get('metric_name') == 'error_rate' and event.get('value', 0) > 0:
            symptoms.add(f"Error rate spike in {svc}")
            service_anomaly_scores[svc]["errors"] += 1
            
        if event.get('event_type') == 'log' and event.get('level') == 'WARN':
            symptoms.add(f"Warnings in {svc}")
            
    affected_services = list(affected_services)
    symptoms = list(symptoms)
    
    # Calculate Severity
    severity = "low"
    if any("FATAL" in s or "Error rate" in s for s in symptoms):
        severity = "critical"
    elif any("Error" in s for s in symptoms) or len(affected_services) > 1:
        severity = "high"
    elif any("latency" in s for s in symptoms):
        severity = "medium"
        
    candidates = _rank_root_causes(service_anomaly_scores, list(affected_services))
    
    return Incident(
        id=str(uuid.uuid5(uuid.NAMESPACE_OID, str(first_obs) + str(last_obs))), # Stable ID based on timeframe
        status="open",
        severity=severity,
        first_observed=first_obs,
        last_observed=last_obs,
        duration_seconds=duration,
        affected_services=affected_services,
        anomaly_window_count=len(windows),
        detectors=["IsolationForest"], # Default detector used in grouping
        symptoms=symptoms,
        root_cause_candidates=candidates,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

def _rank_root_causes(service_anomaly_scores: Dict[str, Dict], affected_services: List[str]) -> List[RootCauseCandidate]:
    if not affected_services:
        return []
        
    candidates = []
    for svc in affected_services:
        score = 0.0
        evidence = []
        uncertainty = []
        
        stats = service_anomaly_scores.get(svc, {})
        errors = stats.get("errors", 0)
        latency = stats.get("latency_spikes", 0)
        
        if errors > 0:
            score += errors * 2.0
            evidence.append(f"{errors} error(s) observed.")
            
        if latency > 0:
            score += latency * 1.0
            evidence.append(f"{latency} latency spike(s) observed.")
            
        # Topological scoring: Boost score if this service is a dependency of other affected services
        downstream_affected = []
        for other_svc in affected_services:
            if other_svc != svc and svc in SERVICE_DEPENDENCIES.get(other_svc, []):
                downstream_affected.append(other_svc)
                
        if downstream_affected:
            score += 50.0 # Heavy boost for being the root dependency
            evidence.append(f"Is dependency of affected service(s): {', '.join(downstream_affected)}.")
            
        # Penalize if it's purely dependent on another affected service
        upstream_affected = []
        for other_svc in affected_services:
            if other_svc != svc and other_svc in SERVICE_DEPENDENCIES.get(svc, []):
                upstream_affected.append(other_svc)
                
        if upstream_affected:
            score -= 20.0
            uncertainty.append(f"Likely cascading failure from {', '.join(upstream_affected)}.")
            
        if score > 0:
            candidates.append({
                "service": svc,
                "score": score,
                "evidence": evidence,
                "uncertainty_reasons": uncertainty
            })
            
    # Sort by score descending
    candidates.sort(key=lambda x: x["score"], reverse=True)
    
    # Assign ranks and convert to objects
    ranked_candidates = []
    for idx, c in enumerate(candidates):
        ranked_candidates.append(RootCauseCandidate(
            service=c["service"],
            rank=idx + 1,
            score=c["score"],
            evidence=c["evidence"],
            uncertainty_reasons=c["uncertainty_reasons"]
        ))
        
    if not ranked_candidates:
        ranked_candidates.append(RootCauseCandidate(
            service="insufficient_evidence",
            rank=1,
            score=0.0,
            evidence=["Not enough distinct error or latency signals isolated to a specific service."],
            uncertainty_reasons=["Metrics deviated globally without a clear upstream origin."]
        ))
        
    return ranked_candidates
