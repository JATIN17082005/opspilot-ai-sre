# OpsPilot: AI Site Reliability and Incident Intelligence Platform

OpsPilot is a portfolio-quality project combining data science, machine learning, backend development, Generative AI, databases, security, system design, and DevOps.

## Objective
The application generates synthetic telemetry (logs and metrics), detects abnormal behavior using statistical and ML methods (Isolation Forest), correlates alerts into incidents, retrieves supporting evidence via RAG, and uses a local AI agent to investigate incidents via read-only tools. It displays incidents and investigation reports in a dashboard.

## Current Progress (Milestones)

- [x] **M1 — Environment and project setup**: Establish venv, create project structure, and test basic setup.
- [x] **M2 — Synthetic telemetry**: Build a fault simulator producing logs/metrics (JSONL).
- [ ] **M3 — Backend and database**: 
  - [x] Create FastAPI endpoints and validation.
  - [x] Telemetry queries (JSONL-backed).
  - [ ] PostgreSQL persistence (Pending local DB installation).
- [x] **M4 — Anomaly detection**: 
  - [x] Implemented Fixed Threshold, Rolling Z-Score, and Isolation Forest detectors.
  - [x] Built evaluation methodology matching injected faults to detections.

## M4: Anomaly Detection Details

**Features Extracted (per 1-minute window)**:
- `avg_latency`: Mean response time across services.
- `max_latency`: Maximum response time across services.
- `error_count`: Count of ERROR/FATAL logs.
- `warn_count`: Count of WARN logs.
- `error_rate`: Max error rate metric.
*(Ground truth labels are explicitly excluded from detection features).*

**Methodology**:
Events are grouped into 1-minute windows. A window is anomalous if it contains any fault-labeled event. Detectors evaluate each window blindly. Isolation Forest is fitted globally on the stream (unsupervised).

**Evaluation Results**:
| Detector | Precision | Recall | F1 Score | FPR (per 1000 normal windows) |
| --- | --- | --- | --- | --- |
| Fixed Threshold | 1.000 | 1.000 | 1.000 | 0.00 |
| Rolling Z-Score | 0.792 | 0.475 | 0.594 | 27.78 |
| Isolation Forest | 0.975 | 0.975 | 0.975 | 5.56 |

**To Reproduce**:
```powershell
$env:PYTHONPATH="C:\OpsPilot"
.\venv\Scripts\python.exe detection/evaluation.py
```

**Known Limitations**: 
- The Fixed Threshold performs perfectly only because it is heavily overfit to the synthetic simulator's hardcoded fault values. 
- Rolling Z-Score struggles to maintain detection during sustained outages as the moving average "adjusts" to the anomaly. 
- Isolation Forest is the most robust generalizable approach here.

**RAM Considerations**:
Isolation Forest fitting takes ~10-20MB overhead. Evaluation and feature extraction use minimal Pandas memory (~5MB for 1098 events). Extremely lightweight.

**Test Results**:
Run `.\venv\Scripts\python.exe -m pytest`. All 19 tests pass successfully.
- [x] **M5 — Incident correlation**: Group alerts, associate affected services, and rank root causes.

## M5: Incident Correlation Details

**Data Models**:
- `Incident`: Groups adjacent `AnomalyWindow`s (default max gap 5 mins). Tracks severity, status, symptoms, detectors, and duration.
- `RootCauseCandidate`: Scores and ranks potentially faulty services. Identifies insufficient evidence ties.

**Dependency Assumptions**:
Modeled from the simulator: `api-gateway` -> `payment-service`, `auth-service`, `database`. `payment-service` and `auth-service` -> `database`.

**Root-Cause Scoring Rules (Topological)**:
1. Symptoms count (+2 per error class, +1 per latency spike).
2. Dependency boost (+50 if service is upstream dependency of other affected services).
3. Dependency penalty (-20 if service only sits downstream of another affected service).

**Evaluation Methodology**:
- Compared predicted `Incident` time boundaries against ground-truth injected fault time boundaries.
- **Top-1 Accuracy**: 4/4 (100%). Perfectly identified root cause for all 4 fault runs (`db_outage`, `db_slowdown`, `http_error_spike`, `slow_responses`).

**API Usage**:
- `GET /incidents` (Filter by `status`, `service`, paginated)
- `GET /incidents/{incident_id}`
- `PATCH /incidents/{incident_id}/status` -> `{"status": "acknowledged"}`

**Lifecycle State**:
- Incidents start `open` and can transition to `acknowledged` or `resolved`.
- State overrides are persisted safely outside raw telemetry into `data/incident_status.json`.

**Limitations & Constraints**:
- Status modifications are saved in a simple JSON layer to remain within the ₹0 budget and memory constraints until Postgres is initialized.
- No LLM evaluation applied yet.

**RAM Considerations**:
- Purely deterministic processing taking under <10MB of runtime memory.

**To Reproduce**:
```powershell
$env:PYTHONPATH="C:\OpsPilot"
.\venv\Scripts\python.exe detection/evaluate_correlation.py
```
- [x] **M6 — RAG**: Ingest runbooks, create embeddings, retrieve evidence.

## M6: Local RAG and Evidence Retrieval Details

**Knowledge Base**:
Constructed synthetic `knowledge_base` with runbooks covering:
- API Gateway HTTP 500 errors.
- Slow Application Responses.
- Database Latency and Outage.
- Service Dependency Documentation.

**Document Processing**:
- Extracted sections by parsing Markdown `##` headings.
- Indexed 15 fine-grained chunks while preserving exact file paths, document UUIDs, and section metadata for provenance tracing.
- Created `rag/document_processor.py`.

**Vector Index and Fallback**:
- Created `VectorIndex` (`rag/vector_index.py`) which seamlessly calls `Ollama` (`nomic-embed-text`) to generate dense embeddings natively if available.
- **Graceful Fallback**: Because Ollama may not be actively running during CI/CD or initialization, a TF-IDF baseline is fitted alongside the vector embeddings. If the Ollama service drops or is missing, retrieval gracefully falls back to the keyword search without crashing the system or failing the request.

**FastAPI Integration**:
- `POST /knowledge/index` — Triggers an index rebuild and stores the resulting vectors.
- `GET /knowledge/status` — Returns index availability (e.g., whether `is_embedded` semantic search is active).
- `POST /knowledge/search` — Performs cosine similarity against query vectors.

**Evaluation Results**:
(TF-IDF Fallback Mode)
- **Recall@1**: 75.0%
- **Recall@3**: 100.0%
- Out-of-Domain queries are securely rejected by thresholding similarity scores.

**Security Implemented**:
- RAG restricts directory access strictly to the curated `knowledge_base/` folder.
- Does not expose arbitrary files to users/LLMs. No system credentials stored.
- Truncates query responses to bounded chunks, controlling context limits.

**To Reproduce**:
```powershell
$env:PYTHONPATH="C:\OpsPilot"
.\venv\Scripts\python.exe rag/evaluate_retrieval.py
```
- [x] **M7 — AI investigation agent**: Integrate Ollama with read-only tools and structured output.

## M7: Local AI Investigation Agent Details

**Workflow Overview**:
Built a strict, structured investigation orchestrator in `agent/orchestrator.py`. The agent accepts an `incident_id` and a `question`, and iteratively plans and executes tools to gather telemetry, anomalies, and knowledge base documentation.

**Tool Registry & Security**:
Created a hardened, read-only registry in `agent/tools.py`.
The allowed tools are:
- `get_incident(incident_id)`
- `get_incident_anomalies(incident_id)`
- `get_metric_summary(service, start_time, end_time)`
- `search_knowledge(query, top_k)`
- `get_service_dependencies(service)`

*Security Enforcements*:
- The LLM has zero capacity to execute arbitrary Python, SQL, shell commands, or external network requests.
- Tool arguments are structurally validated and bounded (e.g., maximum string lengths).
- Maximum tool loop depth is capped at 4 turns to prevent runaway resource consumption.

**Prompt Injection Defense**:
- Tool arguments containing excessively long payloads are safely bounded and rejected by the registry wrapper before execution.
- Retrieved documents are injected purely as read-only "Tool Result" context, and the overarching System Prompt dictates that retrieved text is passive evidence, preventing escalation of privilege.

**Ollama Integration & Fallback**:
- Uses standard local Ollama HTTP bindings (`http://localhost:11434/api/generate`) with `qwen3.5:2b`.
- **Mock/Fallback logic**: Since Ollama natively is often offline during CI/CD checks, the orchestrator graciously falls back to a deterministic, schema-compliant `InvestigationReport` detailing exactly why the model failed to connect, preventing the API from crashing in headless environments. 

**API Endpoint**:
- `POST /investigations`: Returns a strict Pydantic `InvestigationReport` outlining the summary, observed facts, affected services, ranked causes, and the full audit log of which tools the agent used. 

**Testing**:
- Added `test_agent_tools.py` and `test_investigation.py`. 
- 31 total tests passing, ensuring no regression to prior milestone endpoints.
- Total memory envelope remains <10-20MB overhead pending native model activation.

**To Reproduce**:
```powershell
# Send an investigation request (Fallback mode natively applies if Ollama daemon is not running)
$env:PYTHONPATH="C:\OpsPilot"
.\venv\Scripts\python.exe -m pytest tests/test_investigation.py
```
- [x] **M8 — Dashboard**: Display health, anomalies, and reports.

## M8: Interactive Incident Intelligence Dashboard Details

**Architecture**:
- Built an exceptionally lightweight, Zero-Cost Single Page Application (SPA).
- **Backend-Served**: Hosted natively via FastAPI `StaticFiles` on the exact same port (`8000`), removing the need for a separate Node.js server, Docker containers, or CORS configuration.
- **Frontend Stack**: Vanilla JavaScript, semantic HTML5, and Tailwind CSS (via CDN). This completely avoids heavy JavaScript framework payloads while still retaining an incredibly fast, dynamic DOM-rendering router. The entire UI consumes < 1 MB of memory overhead.

**Dashboard Capabilities (Views)**:
1. **System Overview**: Displays real-time aggregated metrics (Total Events, Active Incidents, RAG status) with inline CSS-based metric distribution charts. Distinguishes Semantic Embedding (Ollama) from TF-IDF fallback explicitly.
2. **Service Telemetry**: Analyzes and filters backend events, highlighting specific infrastructure volumes per service. 
3. **Anomaly Explorer**: Direct view into the `IsolationForest` detector outputs across all historical rolling windows.
4. **Incident Management**: Table of deterministic correlated incidents with their respective states. You can acknowledge or resolve incidents synchronously with the persistent `data/incident_status.json` backend.
5. **AI Investigation Interface**: Seamlessly bridged to `POST /investigations`. Directly streams AI insights if Ollama is running. 
   - **Crucial Fallback Handling**: If Ollama is offline or crashes, the UI captures the explicit `failed_model_unavailable` schema output and accurately reports *why* it failed, completely removing the risk of passing off mocked test data as real AI analysis.
6. **Knowledge Base Search**: Input bar interacting with `POST /knowledge/search` to retrieve chunks and similarity scores.

**To Reproduce / Run Dashboard**:
```powershell
# 1. Start the server
$env:PYTHONPATH="C:\OpsPilot"
.\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

# 2. Access the Dashboard
# Open a browser and navigate to: http://127.0.0.1:8000
```
- [x] **M9 — Security and testing**: Auth, input validation, integration tests.

## M9: Security, Reliability, and Validation Details

**Security Enhancements**:
- **Atomic File Persistence**: Handled Edge-Case filesystem corruption during crashes. Hardened `incident_status.json` and `vector_index.json` to perform writes via `.tmp` staging coupled with `os.fsync` and atomic `os.replace` preventing data loss.
- **XSS Mitigations**: Executed a sanitization pass over the frontend SPA router (`app.js`), safely neutralizing untrusted JSON payloads containing Markdown or hallucinated AI outputs.
- **Prompt Injection Defense**: Tool-call arguments are tightly validated in Python (e.g. limiting lengths to <= 500 chars). RAG evidence is structurally injected under a `CRITICAL SECURITY RULE` isolating it from execution instructions.
- **Input Boundaries**: Pydantic models explicitly bounded (e.g., `le=1000` pagination limits, bounded search `top_k`) preventing application OOM (Out-of-Memory) Denial of Service.

**Test Suite Coverage**:
- Added specialized security testing in `tests/test_security.py` verifying immutable constraints, API validation rejections (HTTP 422), fallback tolerance on corrupt files, and prompt injection bounds.
- 36 Automated Tests passing perfectly across the integrated architecture spanning the anomaly detector, event repository, RAG vector index, and UI API.
- See `docs/security_review.md` for the comprehensive threat model and hardware constraints analysis.
- [x] **M10 — Monitoring and deployment**: Prometheus configurations, CI pipelines, local deployment strategies.

## M10: Reproducible Deployment, Observability & CI
**Deployment & Environments**:
- Replaced manual steps with robust `scripts/start.ps1`. Automatically configures the `PYTHONPATH`, checks for the virtual environment, and boots Uvicorn natively on `127.0.0.1:8000`. Stop the server seamlessly with `Ctrl+C`.
- Hardened `.gitignore` and provided `.env.example` to ensure local credentials and large environment blocks are never committed.

**CI/CD Pipeline**:
- Bootstrapped `.github/workflows/ci.yml` using GitHub Actions. It natively spins up an Ubuntu environment, pulls Python 3.10, handles pip dependencies, and perfectly verifies the full suite of 37 OpsPilot deterministic integration tests (which mock Ollama gracefully to allow CI environments to run at 0 cost).

**Application Observability (Prometheus)**:
- Integrated `prometheus-client` into FastAPI middleware.
- Endpoint `/metrics` natively exposes:
  - `api_requests_total` (Labeled by `method`, `endpoint`, `status`).
  - `api_request_duration_seconds` (Histogram mapped to routes).
- Avoided high-cardinality label explosion by sanitizing routes (e.g. `/incidents/123` -> `/incidents/{id}`).
- Wrote `prometheus.yml` for optional drop-in monitoring. You can run the Prometheus binary using this config to begin scraping OpsPilot metrics at 15s intervals without relying on heavy Docker environments.

**Performance Measurements (Intel Core i7, 16GB Windows Host)**:
- App Boot Time: `< 2 seconds`
- `/health` endpoint: `~5 ms`
- `/events` endpoint: `~10 ms`
- `/incidents` endpoint (includes ML Correlation Engine): `~600 - 1200 ms`
- Estimated API Server RAM Baseline: `~90 MB` (Without loading the 2GB LLM into VRAM).

**Dashboard Resilience**:
- Cached a local offline fallback of the Tailwind CSS framework `frontend/tailwind.js`, guaranteeing 100% functionality and styling even if the internet goes down.
- [ ] **M11 — Evaluation and portfolio**: Experiments, architecture diagrams, video demo.

## Setup Instructions

1. Ensure you have Python 3.10+ installed.
2. Initialize virtual environment: `python -m venv venv`
3. Activate virtual environment: `.\venv\Scripts\activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Copy `.env.example` to `.env` if environment customization is needed.
6. Start the server using the local deployment script:
```powershell
.\scripts\start.ps1
```
7. Open a browser and visit: **http://127.0.0.1:8000**

## Development Constraints
- Runs entirely locally to accommodate memory limits (16 GB total RAM) and $0 budget.
- Powered by `Ollama` running `qwen3.5:2b`.
- Relies on PostgreSQL (later stages), FastAPI, and Scikit-Learn.
