# OpsPilot Technical Design & Architecture

## 1. System Architecture

```mermaid
flowchart TD
    subgraph Data Generation
        Sim[Telemetry Simulator] -->|Writes JSONL| Repo[(JSONL Events Repo)]
    end

    subgraph Backend Core (FastAPI)
        Repo --> API_Events[/events]
        Repo --> FeatureExt[Feature Extraction]
        FeatureExt --> Det[Anomaly Detectors]
        Det --> Corr[Incident Correlation Engine]
        Corr --> API_Incidents[/incidents]
    end

    subgraph AI & Knowledge
        Docs[Runbooks .md] --> RAG[RAG Vector Index]
        API_Incidents --> Agent[Orchestrator Agent]
        RAG --> Agent
        Agent -.->|REST API| Ollama[Local Ollama Model]
    end

    subgraph Persistence & State
        Corr --> Status[(incident_status.json)]
        RAG --> Cache[(vector_index.json)]
    end

    subgraph Presentation & Ops
        API_Events --> SPA[SPA Dashboard]
        API_Incidents --> SPA
        Agent --> SPA
        API_Events --> Metrics[/metrics]
        Metrics -.-> Prom[Prometheus]
    end
```

## 2. Component Responsibilities
- **Telemetry Repository (`backend/repository.py`)**: Provides a strict read-only window into historical JSONL events, maintaining absolute data immutability.
- **Correlation Engine (`detection/correlation.py`)**: Responsible for mapping contiguous `AnomalyWindows` into cohesive `Incident` objects, and scoring root-cause service likelihood utilizing a topological +50 upstream / -20 downstream algorithm.
- **RAG Engine (`rag/`)**: Chunks local markdown runbooks. Embeds via Ollama (if available) with an automatic degradation to localized TF-IDF cosine-similarity matrix operations.
- **AI Orchestrator (`agent/orchestrator.py`)**: Interacts with local LLMs by defining a hardcoded tool registry. Uses a finite 4-depth iterative loop to prevent unbounded API runaway.

## 3. Design Decisions & Trade-offs
1. **Modular Monolith**: OpsPilot utilizes FastAPI to seamlessly merge presentation (StaticFiles), detection logic, REST APIs, and metrics into a unified `127.0.0.1:8000` process. This completely bypasses CORS headaches and Docker Compose memory overhead.
2. **Local JSON vs PostgreSQL**: Chose local JSON/JSONL for state management to adhere to the rigid `< 16GB` RAM envelope. Files are updated using OS-level atomic writes to prevent truncation. PostgreSQL can easily be swapped by implementing standard Python Interfaces (Abstract Base Classes) on the current repositories.
3. **Deterministic AI Fallback**: Ensuring the application does not simply crash if Ollama crashes was paramount. The UI gracefully surfaces AI offline warnings without faking data, preserving user trust in the system's claims.
