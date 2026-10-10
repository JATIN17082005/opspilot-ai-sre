from typing import Dict, Any, List, Optional
from backend.repository import JSONLRepository
from detection.correlation import SERVICE_DEPENDENCIES, group_anomalies_into_incidents, AnomalyWindow
from detection.features import extract_features, get_feature_columns
from rag.vector_index import VectorIndex
from detection.isolation_forest import IsolationForestDetector
from backend.incident_repo import IncidentStatusRepository
import pandas as pd
from datetime import datetime

# Global instances for tool access
_repo = JSONLRepository("data/telemetry.jsonl")
_status_repo = IncidentStatusRepository("data/incident_status.json")
_rag_index = VectorIndex()
_rag_index.load()

# Reconstruct anomalies since we don't store them persistently yet
_if_detector = IsolationForestDetector(contamination=0.1)
_events = _repo.events
_anomalies_cache = []
_incidents_cache = []

def _ensure_initialized():
    global _anomalies_cache, _incidents_cache
    if not _anomalies_cache and _events:
        features_df = extract_features(_events)
        _if_detector.fit(features_df)
        preds = _if_detector.detect(features_df)
        
        for i in range(len(features_df)):
            if preds.iloc[i]:
                row = features_df.iloc[i]
                feature_dict = {col: row[col].item() if hasattr(row[col], 'item') else row[col] for col in get_feature_columns(features_df)}
                _anomalies_cache.append(AnomalyWindow(
                    window=row['window'],
                    is_anomalous=True,
                    score=0.0,
                    features=feature_dict
                ))
        
        incidents = group_anomalies_into_incidents(_anomalies_cache, _events)
        for inc in incidents:
            inc.status = _status_repo.get_status(inc.id)
        _incidents_cache = incidents

def get_incident(incident_id: str) -> Dict[str, Any]:
    """Retrieve the authoritative incident record."""
    _ensure_initialized()
    for inc in _incidents_cache:
        if inc.id == incident_id:
            return inc.model_dump()
    return {"error": f"Incident {incident_id} not found."}

def get_incident_anomalies(incident_id: str) -> Dict[str, Any]:
    """Retrieve associated anomaly windows for an incident."""
    _ensure_initialized()
    incident = None
    for inc in _incidents_cache:
        if inc.id == incident_id:
            incident = inc
            break
            
    if not incident:
        return {"error": f"Incident {incident_id} not found."}
        
    start_time = incident.first_observed
    end_time = incident.last_observed
    
    related_anomalies = []
    for a in _anomalies_cache:
        if start_time <= a.window <= end_time:
            # Format the output so it's readable for LLM
            a_dict = {
                "window": a.window.isoformat(),
                "features": a.features
            }
            related_anomalies.append(a_dict)
            
    return {
        "incident_id": incident_id,
        "detector": "IsolationForest",
        "anomalies": related_anomalies
    }

def get_metric_summary(service: str, start_time: str, end_time: str) -> Dict[str, Any]:
    """Retrieve metric summaries from telemetry for a time bound."""
    try:
        t_start = datetime.fromisoformat(start_time.replace('Z', '+00:00')).replace(tzinfo=None)
        t_end = datetime.fromisoformat(end_time.replace('Z', '+00:00')).replace(tzinfo=None)
    except Exception as e:
        return {"error": f"Invalid datetime format. Use ISO format. {e}"}
        
    events = _repo.events
    matched = []
    for e in events:
        if e.get("service") == service:
            e_time = datetime.fromisoformat(e["timestamp"].replace('Z', '+00:00')).replace(tzinfo=None)
            if t_start <= e_time <= t_end:
                matched.append(e)
                
    if not matched:
        return {"message": "No telemetry found for this service in the given time range."}
        
    df = pd.DataFrame(matched)
    logs = df[df["event_type"] == "log"]
    metrics = df[df["event_type"] == "metric"]
    
    summary = {
        "service": service,
        "time_range": [start_time, end_time],
        "total_events": len(matched),
        "log_levels": logs["level"].value_counts().to_dict() if not logs.empty else {},
    }
    
    if not metrics.empty:
        # Group by metric_name
        metric_stats = {}
        for m_name, group in metrics.groupby("metric_name"):
            metric_stats[m_name] = {
                "min": group["value"].min(),
                "max": group["value"].max(),
                "mean": group["value"].mean()
            }
        summary["metrics"] = metric_stats
        
    return summary

def search_knowledge(query: str, top_k: int = 3) -> Dict[str, Any]:
    """Search the existing RAG knowledge base."""
    top_k = min(max(1, top_k), 5) # bound top_k
    if not _rag_index.chunks:
        return {"error": "Knowledge base index is empty or not loaded."}
        
    # use semantic if available, else keyword
    use_keyword = not _rag_index.is_embedded
    results = _rag_index.search(query, top_k=top_k, use_tfidf=use_keyword)
    
    out = []
    for chunk, score in results:
        out.append({
            "chunk_id": chunk.chunk_id,
            "title": chunk.title,
            "heading": chunk.heading,
            "text": chunk.text,
            "score": round(score, 3)
        })
        
    return {
        "retrieval_mode": "keyword" if use_keyword else "semantic",
        "results": out
    }

def get_service_dependencies(service: Optional[str] = None) -> Dict[str, Any]:
    """Return explicitly configured service dependencies."""
    if service:
        deps = SERVICE_DEPENDENCIES.get(service, [])
        return {service: deps}
    return SERVICE_DEPENDENCIES

# Tool registry
TOOLS_REGISTRY = {
    "get_incident": get_incident,
    "get_incident_anomalies": get_incident_anomalies,
    "get_metric_summary": get_metric_summary,
    "search_knowledge": search_knowledge,
    "get_service_dependencies": get_service_dependencies
}
