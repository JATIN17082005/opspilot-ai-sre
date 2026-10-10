import json
import random
import time
from datetime import datetime, timedelta

SERVICES = ["api-gateway", "auth-service", "database", "payment-service"]

class TelemetrySimulator:
    def __init__(self, output_file: str):
        self.output_file = output_file
        self.current_time = datetime.now() - timedelta(days=1)
        self.events = []
    
    def advance_time(self, seconds: int):
        self.current_time += timedelta(seconds=seconds)
        
    def write_events(self):
        with open(self.output_file, 'w') as f:
            for event in self.events:
                f.write(json.dumps(event) + '\n')
                
    def _add_log(self, service: str, level: str, message: str, label: str = "normal"):
        self.events.append({
            "timestamp": self.current_time.isoformat(),
            "service": service,
            "event_type": "log",
            "level": level,
            "message": message,
            "label": label
        })
        
    def _add_metric(self, service: str, metric_name: str, value: float, label: str = "normal"):
        self.events.append({
            "timestamp": self.current_time.isoformat(),
            "service": service,
            "event_type": "metric",
            "metric_name": metric_name,
            "value": round(value, 2),
            "label": label
        })
        
    def generate_normal_traffic(self, duration_mins: int):
        for _ in range(duration_mins):
            self.advance_time(60)
            for svc in SERVICES:
                # Normal latency metric
                base_latency = 50.0 if svc != "database" else 10.0
                latency = random.gauss(base_latency, 10.0)
                self._add_metric(svc, "response_time_ms", max(1.0, latency), "normal")
                
                # Normal log
                if random.random() < 0.3:
                    self._add_log(svc, "INFO", f"Processed request successfully", "normal")
                    
    def inject_http_error_spike(self, duration_mins: int):
        for _ in range(duration_mins):
            self.advance_time(60)
            self._add_metric("api-gateway", "response_time_ms", random.gauss(60.0, 15.0), "http_error_spike")
            for _ in range(random.randint(5, 15)):
                self._add_log("api-gateway", "ERROR", "HTTP 500 Internal Server Error", "http_error_spike")
                
    def inject_slow_responses(self, duration_mins: int):
        for _ in range(duration_mins):
            self.advance_time(60)
            for svc in ["api-gateway", "payment-service"]:
                slow_latency = random.gauss(800.0, 200.0)
                self._add_metric(svc, "response_time_ms", slow_latency, "slow_responses")
                if random.random() < 0.5:
                    self._add_log(svc, "WARN", "High latency detected", "slow_responses")
                    
    def inject_db_slowdown(self, duration_mins: int):
        for _ in range(duration_mins):
            self.advance_time(60)
            db_latency = random.gauss(500.0, 50.0)
            self._add_metric("database", "response_time_ms", db_latency, "db_slowdown")
            self._add_log("database", "WARN", "Slow query execution", "db_slowdown")
            # Cascading to API
            api_latency = db_latency + random.gauss(50.0, 10.0)
            self._add_metric("api-gateway", "response_time_ms", api_latency, "db_slowdown")
            
    def inject_db_outage(self, duration_mins: int):
        for _ in range(duration_mins):
            self.advance_time(60)
            self._add_log("database", "FATAL", "Database connection dropped. Outage.", "db_outage")
            self._add_log("api-gateway", "ERROR", "Connection refused to database", "db_outage")
            self._add_metric("api-gateway", "error_rate", 1.0, "db_outage")
            self._add_metric("database", "active_connections", 0.0, "db_outage")

def main():
    sim = TelemetrySimulator("data/telemetry.jsonl")
    
    # 1. Normal traffic (60 mins)
    sim.generate_normal_traffic(60)
    
    # 2. DB Slowdown (10 mins)
    sim.inject_db_slowdown(10)
    
    # 3. Normal traffic (30 mins)
    sim.generate_normal_traffic(30)
    
    # 4. HTTP Error Spike (5 mins)
    sim.inject_http_error_spike(5)
    
    # 5. Normal traffic (30 mins)
    sim.generate_normal_traffic(30)
    
    # 6. DB Outage (10 mins)
    sim.inject_db_outage(10)
    
    # 7. Normal traffic (60 mins)
    sim.generate_normal_traffic(60)
    
    # 8. Slow responses (15 mins)
    sim.inject_slow_responses(15)
    
    # Write to file
    sim.write_events()
    print(f"Generated {len(sim.events)} events in {sim.output_file}")

if __name__ == "__main__":
    main()
