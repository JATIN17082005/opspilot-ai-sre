import re

with open("backend/main.py", "r", encoding="utf-8") as f:
    code = f.read()

middleware_code = """
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
    # Normalize paths a bit for metrics to avoid cardinality explosion (very basic)
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
"""

# Insert right after app = FastAPI(...)
if "from prometheus_client import" not in code:
    code = code.replace('app = FastAPI(title="OpsPilot API")', 'app = FastAPI(title="OpsPilot API")\n' + middleware_code)
    
    with open("backend/main.py", "w", encoding="utf-8") as f:
        f.write(code)
    print("Metrics added")
else:
    print("Metrics already exist")
