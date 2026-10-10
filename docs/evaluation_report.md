# OpsPilot Evaluation Report

This document reports the reproducible benchmarks and evaluation metrics for OpsPilot's core subsystems: Anomaly Detection, Incident Correlation, RAG Retrieval, and API Latency. 

All evaluations were executed locally on an **Intel Core i7-1255U (16GB RAM) Windows** environment.

## 1. Anomaly Detection Performance
**Dataset**: 1,098 synthetic telemetry events spanning 4 fault scenarios (`db_slowdown`, `http_error_spike`, `db_outage`, `slow_responses`). Total normal evaluation windows: 180.

| Detector | Precision | Recall | F1 Score | False Positives (per 1000) |
| --- | --- | --- | --- | --- |
| **Fixed Threshold** | 1.000 | 1.000 | 1.000 | 0.00 |
| **Rolling Z-Score** | 0.792 | 0.475 | 0.594 | 27.78 |
| **Isolation Forest** | 0.975 | 0.975 | 0.975 | 5.56 |

*Note: Fixed Threshold achieves a perfect score strictly due to the simplistic boundaries of synthetic data. Isolation Forest (with contamination=0.1) proves more robust for varying feature boundaries without hardcoded latency thresholds.*

## 2. Incident Correlation & Root-Cause Analysis
Evaluates the graph-based clustering engine's ability to bundle anomaly windows (gap < 5 mins) and correctly traverse topological dependencies (`+50` upstream, `-20` downstream penalties).

- **Precision**: 1.00 (4/4 incidents mapped correctly)
- **Recall**: 1.00 (No orphaned fault windows)
- **Top-1 Root Cause Accuracy**: 4/4 (100%)
- **Top-3 Root Cause Accuracy**: 4/4 (100%)

## 3. Knowledge Base Retrieval (RAG)
Evaluates `rag/document_processor.py` over local runbook markdown. Due to the local absence of the `nomic-embed-text` Ollama model, the system successfully executed its robust **TF-IDF Keyword Fallback**.

- **Semantic Embedding Mode**: Unavailable (Ollama HTTP 404 handled gracefully).
- **Keyword Fallback Mode (TF-IDF)**:
  - **Recall@1**: 75.0% (3/4 matched exactly)
  - **Recall@3**: 100.0% (4/4 matched within top 3)
  - **Out-of-Domain Rejection**: Correctly dismissed unsupported queries (e.g. "Kafka queue backing up").

## 4. Performance & API Benchmarks (Steady-State)
Measurements exclude cold-starts and are captured using `scripts/benchmark.py` over 5 continuous request cycles natively served by Uvicorn.

| Endpoint | Action | Median Latency (ms) | P95 Latency (ms) |
| --- | --- | --- | --- |
| `/health` | Liveness check | 3.32 | 3.32 |
| `/events` | Paginated Retrieval | 8.87 | 10.63 |
| `/incidents`| IF Detect + Correlation | 553.81 | 588.85 |
| `/knowledge/search` | TF-IDF Retrieval | 5.17 | 6.44 |

- **Estimated API Server RAM Overhead**: ~90 MB. 
- **AI Investigation Latency**: Not measured. The deterministic mocked-LLM fallback successfully triggered, maintaining strict UX stability.

## 5. Known Limitations & Caveats
1. **Synthetic Validation**: Accuracy metrics (100% Top-1 RCA) reflect synthetic faults. Real-world microservice telemetry features cascading overlapping failures requiring richer probabilistic graphs (e.g., Bayesian Networks).
2. **Missing LLM Context**: Because Ollama was down, end-to-end integration of LLM reasoning was replaced with schema-compliant deterministic fallbacks. Future evaluations must re-profile VRAM and Latency when `qwen3.5:2b` is explicitly loaded.
