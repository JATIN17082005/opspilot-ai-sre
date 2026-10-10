# OpsPilot Interview Preparation

### Why did you build OpsPilot?
I wanted to build a holistic SRE application that proves my ability to integrate Data Science (Anomaly Detection), AI (RAG & Tool Calling), and Backend Engineering (FastAPI, Single Page Applications) without relying on massive paid cloud infrastructure.

### Why does the anomaly detector use a baseline and Isolation Forest?
Synthetic thresholding (e.g., checking if latency > 150ms) is fragile in production. Isolation Forest is an unsupervised tree ensemble that isolates outliers naturally without requiring manually tuned thresholds, allowing the system to adapt to distinct microservice baselines automatically.

### How was data leakage prevented?
The `evaluate_correlation.py` offline script separates the actual generated operational feature matrix (`features_df`) from the `_fault_type` ground-truth labels. The labels are exclusively sliced during offline metric scoring (Precision, Recall), guaranteeing the live API never 'peeks' at the answers.

### Why is an anomaly not automatically a root cause?
Microservices cascade failures. A database outage instantly causes an upstream API gateway to spike in 500 errors. If we alert on every anomaly, we cause alert fatigue. Anomalies are symptoms; incidents are the holistic events containing the root cause.

### How does incident correlation work?
It scans chronologically through time-series anomaly windows. If two anomalies occur within a 5-minute threshold, they are bound into a single `Incident` object, drastically compressing the operational noise.

### How are root-cause candidates ranked?
I implemented a topological dependency graph. If the Database and Payment-Service are both anomalous, the algorithm checks dependencies. Since Payment depends on Database, the Database is awarded a +50 upstream penalty score, ranking it higher as the likely culprit.

### How does RAG retrieve relevant passages?
The Markdown runbooks are chunked. If Ollama is available, it calculates semantic vector embeddings. If not, it falls back to generating a TF-IDF matrix. When queried, it computes Cosine Similarity against the chunks and returns the Top-K closest passages.

### How are citations validated?
The RAG chunking algorithm attaches deterministic UUIDs (`chunk_id`) and file provenance (`source_path`) to the payloads. 

### Why is TF-IDF a fallback rather than semantic embedding?
On constrained hardware (16GB RAM laptop), running a 2GB embedding model concurrently with a 4GB language model creates intense memory pressure. TF-IDF requires < 5MB of RAM, executing instantly with 100% Recall@3 on exact keyword matches.

### How does the AI agent call read-only tools?
It utilizes a multi-turn ReAct orchestrator loop. The system prompt instructs it to emit JSON objects like `{"tool": "get_incident", "arguments": ...}`. The Python backend intercepts this, executes the explicit function mapping, and appends the result to the conversation context.

### How does the system resist prompt injection?
1. The orchestrator strictly limits the context loop to 4 turns, preventing runaway agent chains.
2. The System Prompt enforces a `CRITICAL SECURITY RULE` isolating retrieved RAG text as "UNTRUSTED EVIDENCE".
3. Function arguments are strictly typed and truncated via Pydantic/Python checks to block buffer/length exhaustion.

### Why use JSON files instead of PostgreSQL initially?
To conform strictly to the $0 hardware budget and memory constraints. Using OS-level atomic writes (`os.replace`) on JSON files allowed me to build the entire persistence logic without forcing users to run Dockerized PostgreSQL databases.

### Why choose a modular monolith?
Separating the dashboard, API, and detection workers into distinct microservices would require complex network orchestration, CORS middleware, and heavy RAM overhead. Serving the Vanilla JS frontend directly through FastAPI `StaticFiles` unifies the architecture perfectly.

### How are persistent state and atomic writes handled?
Files are written to a `.tmp` location, flushed via `os.fsync()`, and natively replaced into the active file directory. This ensures that if the system crashes during a `json.dump`, the file is not zeroed out.

### What happens when Ollama is unavailable?
The backend intercepts connection errors (HTTP 404/Timeouts). The investigation endpoint gracefully constructs a schema-compliant mock report marked `failed_model_unavailable`. The frontend visually flags this to the user, strictly maintaining data integrity without crashing the UI.

### What are the project's largest technical limitations?
The telemetry dataset is synthetic and the deterministic topological maps are hardcoded. A real distributed trace spans dynamic Jaeger clusters. The dataset size is relatively small (1098 events) which inherently biases Machine Learning scores toward perfect recall.

### How would the architecture change for production traffic?
1. Replace JSONL flat-files with a TimescaleDB (PostgreSQL) metrics repository.
2. Move ML inference into async Celery workers.
3. Replace local TF-IDF with a managed vector database (e.g. Pinecone).
4. Implement OAuth2 JWT routes for frontend authorization.

### Which measurements have actually been verified?
I measured native Uvicorn latency (Median 5-10ms for static routes), CPU memory thresholds (~90MB for the API server), and verified exactly 37 deterministic CI regression tests passing instantly. Precision/Recall scores are calculated via `evaluate_correlation.py`.
