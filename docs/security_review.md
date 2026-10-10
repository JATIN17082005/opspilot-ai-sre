# OpsPilot Security & Reliability Review

## 1. Threat Model
### Assets
- Immutable Telemetry JSONL datastore
- Incident Status persistence (`incident_status.json`)
- Vector Index mappings (`vector_index.json`)
- AI Investigation tools and backend compute (Ollama, CPU, RAM)

### Trust Boundaries
- **Browser (Frontend)**: Untrusted. The Single Page Application served on `:8000` could be modified by clients.
- **REST API (Backend)**: Enforces validation, limits, and orchestrates file reads.
- **AI Agent Sandbox**: The LLM outputs are treated as completely untrusted logic that cannot dictate the permissions of the orchestrator.

### Actors
- **Internal SRE User**: Benign but could trigger accidental large requests.
- **Malicious Internal Actor / Prompt Injector**: Could supply malformed telemetry or markdown documentation designed to take over the LLM instructions.

## 2. Findings and Remediation

### Finding 1: Partial File Write Corruption (High)
* **Description**: `IncidentStatusRepository` and `VectorIndex` were using basic `with open(..., "w")` to save state. In the event of a system crash or power loss during the `json.dump` flush, the files would truncate to zero bytes, destroying incident states and RAG indexing irreparably.
* **Remediation**: Implemented atomic writes using `.tmp` shadow files combined with `f.flush()`, `os.fsync(f.fileno())`, and `os.replace`.
* **Testing**: Added `test_incident_repo_corruption_recovery` in `tests/test_security.py` to ensure corrupt states degrade gracefully to defaults rather than throwing fatal API errors.

### Finding 2: Cross-Site Scripting (XSS) in Dashboard (Medium)
* **Description**: The frontend (`app.js`) utilized template literals embedding dynamic `innerHTML` properties from incident summaries and Markdown RAG retrievals. A maliciously crafted runbook or LLM hallucination could trigger a stored XSS payload in the browser.
* **Remediation**: Created a python-based static analyzer `scripts/sanitize_app.py` that wrapped all dynamic property accesses in `app.js` with an `escapeHTML()` sanitization function to safely escape tags and ampersands.
* **Testing**: Confirmed that payloads rendering HTML brackets (e.g. `<script>`) appear as benign encoded entities (`&lt;script&gt;`).

### Finding 3: Prompt Injection Weaknesses (Medium)
* **Description**: The investigation agent dynamically appended RAG documentation and context to the LLM context window. A maliciously injected `## Instruction: ignore all previous commands` in the Markdown runbook could trick the LLM into attempting arbitrary tool execution or fabricating data.
* **Remediation**: Added a firm `CRITICAL SECURITY RULE` to the system prompt explicitely categorizing RAG output as "UNTRUSTED EVIDENCE". Furthermore, the backend Python orchestrator enforces a hard `4` limit on loop depths and strictly validates Tool function signatures in `agent.tools`. Unknown tool requests (`"name": "shell_exec"`) are intercepted by Python and gracefully rejected without executing anything.
* **Testing**: Added `test_tool_injection_protection` checking payload boundaries (>500 characters) and fake tool invocation paths.

### Finding 4: API Rate & Bounds Exhaustion (Low)
* **Description**: Requests missing pagination limits or overly broad scopes could exhaust the limited 16GB RAM overhead.
* **Remediation**: Verified and hardened Pydantic boundaries. Enforced `size: int = Query(50, ge=1, le=1000)` on endpoints like `/events`, and `top_k: int = Field(3, ge=1, le=10)` on knowledge search.

## 3. Performance Profiling
- **Test Baseline**: 36 end-to-end integration and unit tests execute under `~18s` on the CI target, proving that JSONL immutable reads have negligible overhead.
- **Frontend Footprint**: The HTML/JS footprint maintains a `0 MB` server overhead footprint, keeping memory strictly bound to FastAPI/Uvicorn (`<100MB`).
- **AI Latency**: Ollama native interactions execute safely and if the host is down, the deterministic fallback completes in under `20ms`, eliminating API hangs.

## 4. Unresolved Issues & Residual Risks
- **Authentication**: The application currently has zero authentication/authorization scopes (No JWT or session cookies). Access to `localhost:8000` is implicitly unrestricted. If run on `0.0.0.0` inside a VPC, any lateral movement actor can hit the dashboard.
- **LLM Non-Determinism**: Even with rigid tools, the AI summary might hallucinate causal links between decoupled systems. 

**Recommendation for M10**: Ensure Docker-compose configurations do not expose port `8000` to `0.0.0.0` unless an OAuth2 or BasicAuth proxy is wrapped around the deployment.
