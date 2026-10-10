from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime

class BaseEvent(BaseModel):
    id: str
    timestamp: datetime
    service: str
    event_type: Literal["log", "metric"]
    label: str

class LogEvent(BaseEvent):
    level: str
    message: str

class MetricEvent(BaseEvent):
    metric_name: str
    value: float

class PaginatedResponse(BaseModel):
    items: List[dict]
    total: int
    page: int
    size: int

class StatsResponse(BaseModel):
    total_events: int
    service_counts: dict[str, int]
    scenario_counts: dict[str, int]

class RootCauseCandidate(BaseModel):
    service: str
    rank: int
    score: float
    evidence: List[str]
    uncertainty_reasons: List[str]

class Incident(BaseModel):
    id: str
    status: Literal["open", "acknowledged", "resolved"] = "open"
    severity: Literal["low", "medium", "high", "critical"]
    first_observed: datetime
    last_observed: datetime
    duration_seconds: float
    affected_services: List[str]
    anomaly_window_count: int
    detectors: List[str]
    symptoms: List[str]
    root_cause_candidates: List[RootCauseCandidate]
    created_at: datetime
    updated_at: datetime


class AnomalyWindow(BaseModel):
    window: datetime
    is_anomalous: bool
    score: Optional[float] = None
    features: Dict[str, Any]

class AnomalyResponse(BaseModel):
    detector: str
    anomalies: List[AnomalyWindow]
    total_analyzed_windows: int

class PaginatedIncidentResponse(BaseModel):
    items: List[Incident]
    total: int
    page: int
    size: int


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(3, ge=1, le=10)
    use_keyword_baseline: bool = False

class SearchResult(BaseModel):
    doc_id: str
    chunk_id: str
    title: str
    heading: str
    text: str
    score: float
    source_path: str
    method: str

class SearchResponse(BaseModel):
    results: List[SearchResult]


class EvidenceCitation(BaseModel):
    source_type: str  # e.g., 'telemetry', 'incident_record', 'runbook'
    source_id: str    # e.g., chunk_id or incident_id
    description: str

class InvestigationReport(BaseModel):
    investigation_id: str
    incident_id: str
    status: str = Field(default="success", description="Status of the investigation (e.g. success, failed_model_unavailable, running)")
    summary: str
    observed_facts: List[str]
    affected_services: List[str]
    ranked_root_causes: List[str]
    evidence_for: List[EvidenceCitation]
    evidence_against: List[EvidenceCitation]
    runbook_references: List[str]
    recommended_steps: List[str]
    remaining_uncertainty: str
    confidence: str
    retrieval_mode: str
    model_identifier: str
    tool_call_audit: List[dict]
    timestamp: datetime


class InvestigationRequest(BaseModel):
    incident_id: str
    question: str

