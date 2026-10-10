import time
import requests
import statistics
import subprocess

BASE_URL = "http://127.0.0.1:8000"
NUM_REQUESTS = 5

def measure_latency(endpoint, method="GET", json=None):
    latencies = []
    for _ in range(NUM_REQUESTS):
        t0 = time.time()
        if method == "GET":
            resp = requests.get(f"{BASE_URL}{endpoint}")
        else:
            resp = requests.post(f"{BASE_URL}{endpoint}", json=json)
        latencies.append((time.time() - t0) * 1000)
    
    return {
        "median": statistics.median(latencies),
        "p95": sorted(latencies)[int(0.95 * len(latencies))]
    }

def run_benchmarks():
    print("=== System Benchmarks ===")
    
    print("Checking if server is up...")
    try:
        requests.get(f"{BASE_URL}/health")
    except Exception:
        print("Server is not running. Please run start.ps1 first.")
        return

    # Warmup
    requests.get(f"{BASE_URL}/events?size=10")
    
    h = measure_latency("/health")
    print(f"/health       -> Median: {h['median']:.2f} ms | P95: {h['p95']:.2f} ms")
    
    e = measure_latency("/events?size=50")
    print(f"/events       -> Median: {e['median']:.2f} ms | P95: {e['p95']:.2f} ms")
    
    i = measure_latency("/incidents?size=10")
    print(f"/incidents    -> Median: {i['median']:.2f} ms | P95: {i['p95']:.2f} ms")
    
    ks = measure_latency("/knowledge/search", method="POST", json={"query": "database", "top_k": 3})
    print(f"RAG search    -> Median: {ks['median']:.2f} ms | P95: {ks['p95']:.2f} ms")

if __name__ == "__main__":
    run_benchmarks()
