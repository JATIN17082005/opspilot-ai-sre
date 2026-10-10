from fastapi import FastAPI, HTTPException, Query, Depends, BackgroundTasks
from typing import Optional, List
from datetime import datetime
from backend.schemas import PaginatedResponse, StatsResponse, Incident, AnomalyResponse, AnomalyWindow
from backend.repository import JSONLRepository

import pandas as pd
from detection.features import extract_features, get_feature_columns
from detection.isolation_forest import IsolationForestDetector

app = FastAPI(
    title="OpsPilot API",
    description="Backend API for OpsPilot telemetry and incident data",
    version="0.1.0"
)

# Global detector instance
if_detector = IsolationForestDetector(contamination=0.1)

# Dependency to get repository (can be swapped for DB later)
def get_repository() -> JSONLRepository:
    return JSONLRepository("data/telemetry.jsonl")

@app.post("/detect/fit")
def fit_detector(repo: JSONLRepository = Depends(get_repository)):
    """Fits the Isolation Forest detector on all current historical telemetry."""
    events = repo.events
    if not events:
        raise HTTPException(status_code=400, detail="No telemetry data to fit")
    features_df = extract_features(events)
    if_detector.fit(features_df)
    return {"message": "Detector fitted successfully", "windows_analyzed": len(features_df)}

@app.get("/anomalies", response_model=AnomalyResponse)
def get_anomalies(repo: JSONLRepository = Depends(get_repository)):
    """Runs the fitted Isolation Forest detector on telemetry and returns detected anomalies."""
    if not if_detector.is_fitted:
        raise HTTPException(status_code=400, detail="Detector is not fitted. Call /detect/fit first.")
        
    events = repo.events
    features_df = extract_features(events)
    if features_df.empty:
        return AnomalyResponse(detector="IsolationForest", anomalies=[], total_analyzed_windows=0)
        
    preds = if_detector.detect(features_df)
    scores = if_detector.score(features_df)
    
    anomalies_list = []
    for i in range(len(features_df)):
        if preds.iloc[i]:
            row = features_df.iloc[i]
            # Convert numpy types to native python types
            feature_dict = {col: row[col].item() if hasattr(row[col], 'item') else row[col] for col in get_feature_columns(features_df)}
            anomalies_list.append(AnomalyWindow(
                window=row['window'],
                is_anomalous=bool(preds.iloc[i]),
                score=float(scores.iloc[i]),
                features=feature_dict
            ))
            
    return AnomalyResponse(
        detector="IsolationForest",
        anomalies=anomalies_list,
        total_analyzed_windows=len(features_df)
    )

from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

app.mount("/dashboard", StaticFiles(directory="frontend", html=True), name="frontend")

@app.get("/")
def read_root():
    return RedirectResponse(url="/dashboard/index.html")

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/events", response_model=PaginatedResponse)
def get_events(
    service: Optional[str] = None,
    scenario: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=1000),
    repo: JSONLRepository = Depends(get_repository)
):
    return repo.get_events(service, scenario, start_time, end_time, page, size)

@app.get("/events/{event_id}")
def get_event(event_id: str, repo: JSONLRepository = Depends(get_repository)):
    event = repo.get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@app.get("/stats", response_model=StatsResponse)
def get_stats(repo: JSONLRepository = Depends(get_repository)):
    return repo.get_stats()

from backend.schemas import PaginatedResponse, StatsResponse, Incident, AnomalyResponse, AnomalyWindow, PaginatedIncidentResponse
from detection.correlation import group_anomalies_into_incidents

from backend.incident_repo import IncidentStatusRepository, IncidentStatusUpdate

def get_incident_status_repo() -> IncidentStatusRepository:
    return IncidentStatusRepository("data/incident_status.json")

@app.patch("/incidents/{incident_id}/status")
def update_incident_status(
    incident_id: str, 
    update: IncidentStatusUpdate,
    status_repo: IncidentStatusRepository = Depends(get_incident_status_repo),
    repo: JSONLRepository = Depends(get_repository)
):
    # Verify incident exists
    get_incident(incident_id, repo, status_repo) # will raise 404 if missing
    
    try:
        status_repo.set_status(incident_id, update.status)
        return {"id": incident_id, "status": update.status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/incidents", response_model=PaginatedIncidentResponse)
def get_incidents(
    status: Optional[str] = None,
    service: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=1000),
    repo: JSONLRepository = Depends(get_repository),
    status_repo: IncidentStatusRepository = Depends(get_incident_status_repo)
):
    if not if_detector.is_fitted:
        # Auto-fit if not fitted (or return empty) to keep it simple
        events = repo.events
        if events:
            features_df = extract_features(events)
            if_detector.fit(features_df)
            
    events = repo.events
    if not events:
        return PaginatedIncidentResponse(items=[], total=0, page=page, size=size)
        
    features_df = extract_features(events)
    preds = if_detector.detect(features_df)
    
    anomalies = []
    for i in range(len(features_df)):
        if preds.iloc[i]:
            row = features_df.iloc[i]
            feature_dict = {col: row[col].item() if hasattr(row[col], 'item') else row[col] for col in get_feature_columns(features_df)}
            anomalies.append(AnomalyWindow(
                window=row['window'],
                is_anomalous=True,
                score=0.0,
                features=feature_dict
            ))
            
    incidents = group_anomalies_into_incidents(anomalies, events)
    
    # Hydrate status
    for inc in incidents:
        inc.status = status_repo.get_status(inc.id)
    
    if status:
        incidents = [i for i in incidents if i.status == status]
    if service:
        incidents = [i for i in incidents if service in i.affected_services]
        
    # Sort by recent
    incidents.sort(key=lambda x: x.first_observed, reverse=True)
    
    start_idx = (page - 1) * size
    end_idx = start_idx + size
    
    return PaginatedIncidentResponse(
        items=incidents[start_idx:end_idx],
        total=len(incidents),
        page=page,
        size=size
    )

@app.get("/incidents/{incident_id}", response_model=Incident)
def get_incident(
    incident_id: str, 
    repo: JSONLRepository = Depends(get_repository),
    status_repo: IncidentStatusRepository = Depends(get_incident_status_repo)
):
    # To get a single incident, we recalculate (stateless for now, or could cache)
    events = repo.events
    if not events or not if_detector.is_fitted:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    features_df = extract_features(events)
    preds = if_detector.detect(features_df)
    anomalies = []
    for i in range(len(features_df)):
        if preds.iloc[i]:
            row = features_df.iloc[i]
            feature_dict = {col: row[col].item() if hasattr(row[col], 'item') else row[col] for col in get_feature_columns(features_df)}
            anomalies.append(AnomalyWindow(
                window=row['window'],
                is_anomalous=True,
                score=0.0,
                features=feature_dict
            ))
            
    incidents = group_anomalies_into_incidents(anomalies, events)
    for inc in incidents:
        if inc.id == incident_id:
            inc.status = status_repo.get_status(inc.id)
            return inc
            
    raise HTTPException(status_code=404, detail="Incident not found")

from backend.schemas import SearchRequest, SearchResponse, SearchResult
from rag.document_processor import DocumentProcessor
from rag.vector_index import VectorIndex

rag_index = VectorIndex()
rag_index.load()

@app.post("/knowledge/index")
def index_knowledge_base():
    processor = DocumentProcessor()
    chunks = processor.process_all()
    if not chunks:
        raise HTTPException(status_code=400, detail="No documents found in knowledge_base/")
        
    rag_index.build_index(chunks)
    return {
        "message": "Indexing complete",
        "chunks_indexed": len(rag_index.chunks),
        "embedded_with_ollama": rag_index.is_embedded
    }

@app.get("/knowledge/status")
def get_knowledge_status():
    return {
        "chunks_indexed": len(rag_index.chunks),
        "is_embedded": rag_index.is_embedded,
        "ollama_model": rag_index.ollama_model,
        "is_tfidf_fitted": rag_index.is_tfidf_fitted
    }

@app.post("/knowledge/search", response_model=SearchResponse)
def search_knowledge_base(req: SearchRequest):
    if len(req.query.strip()) == 0:
        return SearchResponse(results=[])
        
    if not rag_index.chunks:
        raise HTTPException(status_code=400, detail="Index is empty. Call /knowledge/index first.")
        
    method_used = "keyword" if req.use_keyword_baseline or not rag_index.is_embedded else "semantic"
    results = rag_index.search(req.query, top_k=req.top_k, use_tfidf=(method_used=="keyword"))
    
    out = []
    for chunk, score in results:
        out.append(SearchResult(
            doc_id=chunk.doc_id,
            chunk_id=chunk.chunk_id,
            title=chunk.title,
            heading=chunk.heading,
            text=chunk.text,
            score=score,
            source_path=chunk.source_path,
            method=method_used
        ))
        
    return SearchResponse(results=out)

from backend.schemas import InvestigationRequest, InvestigationReport
from agent.orchestrator import investigate_incident

@app.post("/investigations", response_model=InvestigationReport)
def create_investigation(req: InvestigationRequest):
    if not req.incident_id or not req.question:
        raise HTTPException(status_code=400, detail="Missing incident_id or question.")
        
    try:
        report = investigate_incident(req.incident_id, req.question, mock_mode=False)
        return report
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Investigation failed: {str(e)}")
import time
from fastapi import Request
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

REQUEST_COUNT = Counter("api_requests_total", "Total API Requests", ["method", "endpoint", "status"])
REQUEST_DURATION = Histogram("api_request_duration_seconds", "API Request Duration", ["method", "endpoint"])

@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    start_time = time.time()
    method = request.method
    path = request.url.path
    if path.startswith("/incidents/") and not path.endswith("/status"):
        endpoint = "/incidents/{id}"
    elif path.startswith("/incidents/") and path.endswith("/status"):
        endpoint = "/incidents/{id}/status"
    elif path.startswith("/events/"):
        endpoint = "/events/{id}"
    else:
        endpoint = path

    response = await call_next(request)
    
    duration = time.time() - start_time
    status = str(response.status_code)
    
    REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status).inc()
    REQUEST_DURATION.labels(method=method, endpoint=endpoint).observe(duration)
    
    return response

@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
