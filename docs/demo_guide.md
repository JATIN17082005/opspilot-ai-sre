# OpsPilot 5-Minute Demonstration Guide

This guide is designed for recruiters and engineering managers to evaluate OpsPilot’s end-to-end capabilities swiftly.

## Prerequisites
Open a PowerShell terminal and start the server:
```powershell
$env:PYTHONPATH="C:\OpsPilot"
.\scripts\start.ps1
```

## Step-by-Step Demo

### 1. Dashboard Landing (0:00 - 1:00)
- Navigate to `http://127.0.0.1:8000`.
- **Explain**: "This is the Single Page Application hosted natively by FastAPI. Notice how fast it loads—it relies entirely on vanilla JavaScript and CSS, bypassing React to remain incredibly lightweight."
- **Point out**: The real-time System Overview. Emphasize that the Semantic Embedding status intelligently reflects whether the heavy AI models are currently loaded in RAM.

### 2. Anomaly Explorer & Incident Correlation (1:00 - 2:30)
- Click **Anomalies**.
- **Explain**: "OpsPilot runs an unsupervised machine learning Isolation Forest. It scans 1-minute rolling windows of application telemetry to detect unexpected latency spikes or error rates."
- Click **Incidents**.
- **Explain**: "It automatically clusters overlapping anomalies into cohesive incidents. Look at the deterministic root-cause ranking—it leverages topological maps to penalty-score downstream microservices."

### 3. Investigation & RAG Search (2:30 - 4:00)
- Click **View Detail** on the top Incident.
- Scroll down and click **Launch Investigation**.
- **Explain (If Ollama is OFFLINE)**: "Notice how the system gracefully detects the LLM is down. It surfaces a `failed_model_unavailable` deterministic fallback report rather than crashing or faking data. It ensures operational reliability under failure."
- Click **Knowledge Base** in the navigation bar.
- Type `database` and click Search. 
- **Explain**: "OpsPilot dynamically searches technical runbooks. Because the LLM is down, it seamlessly shifted into TF-IDF vector math to find the exact chunk of Markdown we need."

### 4. Metrics & Reproducibility (4:00 - 5:00)
- In a new browser tab, open `http://127.0.0.1:8000/metrics`.
- **Explain**: "I instrumented Python natively with Prometheus. Every action we took is recorded in these histograms. You can drop this into a Grafana dashboard with zero additional code."
- Open the terminal and press `Ctrl+C`.
- **Conclusion**: "The entire system runs on < 100MB of RAM, deployed via PowerShell, and validated by 37 CI automated tests."
