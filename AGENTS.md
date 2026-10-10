# OpsPilot Architecture and Development Rules

## 1. Project Constraints & Budget
- **Budget**: ₹0 in software and service fees.
- **Hardware**: Windows, Intel Core i7-1255U, 16 GB RAM, Intel Iris Xe, NVMe SSD. Available memory for inference is roughly 9-10 GB.
- **Model**: Local inference using Ollama with `qwen3.5:2b`.
- **Infrastructure**: Local execution only. No paid APIs, cloud GPUs, or paid infrastructure. Run minimum necessary services to save memory and CPU.

## 2. Technology Stack
- **Languages/Frameworks**: Python, FastAPI, Pydantic.
- **Data/ML**: pandas, NumPy, scikit-learn.
- **Data Storage**: JSONL for initial simulation; PostgreSQL for relational storage.
- **Vector Database**: Local vector index (e.g., FAISS or similar) with a lightweight embedding model.
- **LLM/AI**: Ollama (`qwen3.5:2b`) with local tools.
- **Testing**: Pytest.
- **Frontend**: React (or lightweight alternative if justified).
- **Deployment/Monitoring**: Docker Compose, GitHub Actions, Prometheus, Grafana (later phases).

## 3. Engineering Guidelines
- **AI Constraints**: The anomaly detector must function completely independent of the LLM. AI root-cause suggestions are treated as hypotheses, not facts.
- **Agent Tools**: The AI investigation agent initially operates with read-only tools and must base its reports on retrieved evidence. No unrestricted shell or DB access.
- **Quality Metrics**: Maintain reproducible datasets, labeled fault scenarios, and documented experiments. Measure precision, recall, false-positive rate, detection delay, and API latency.
- **Simplicity**: Do not introduce complex architecture components (like Docker, Redis, Postgres) until explicitly needed by a milestone.
- **Code Practices**: Provide small, testable, maintainable implementations. Ensure automated tests accompany features.
- **Security**: Prevent prompt injection, include auth/validation, and never commit secrets.

## 4. Milestones
- **M1**: Environment and project setup.
- **M2**: Synthetic telemetry (Logs/Metrics Simulator).
- **M3**: Backend and database (FastAPI, Postgres).
- **M4**: Anomaly detection (Isolation Forest, statistical baselines).
- **M5**: Incident correlation (Grouping alerts and ranking causes).
- **M6**: RAG (Ingest runbooks, local vector DB).
- **M7**: AI investigation agent (Ollama integration, read-only tools).
- **M8**: Dashboard (Display health, anomalies, and AI reports).
- **M9**: Security and testing.
- **M10**: Monitoring and deployment (Docker Compose, Prometheus, Grafana).
- **M11**: Evaluation and portfolio (Experiments, docs, demo).
