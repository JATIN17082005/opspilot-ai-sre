import time
import requests
import os

BASE_URL = "http://127.0.0.1:8000"

def measure():
    try:
        # Check /health
        t0 = time.time()
        requests.get(f"{BASE_URL}/health")
        t1 = time.time()
        print(f"/health latency: {(t1-t0)*1000:.2f} ms")

        # Check /events
        t0 = time.time()
        requests.get(f"{BASE_URL}/events?size=100")
        t1 = time.time()
        print(f"/events latency: {(t1-t0)*1000:.2f} ms")

        # Check /incidents
        t0 = time.time()
        requests.get(f"{BASE_URL}/incidents?size=10")
        t1 = time.time()
        print(f"/incidents latency: {(t1-t0)*1000:.2f} ms")

    except Exception as e:
        print("Server not running?", e)

if __name__ == "__main__":
    measure()
