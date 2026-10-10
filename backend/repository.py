import json
from datetime import datetime
from typing import Optional, List, Dict
from pathlib import Path

class JSONLRepository:
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        self.events = self._load_events()

    def _load_events(self) -> List[Dict]:
        events = []
        if not self.file_path.exists():
            return events
        with open(self.file_path, 'r') as f:
            for line in f:
                if line.strip():
                    try:
                        event = json.loads(line)
                        # Ensure timestamp is parsed and re-formatted for consistent sorting if needed
                        # Or just leave it as ISO string
                        events.append(event)
                    except json.JSONDecodeError:
                        pass
        # Sort by timestamp descending
        events.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return events

    def get_events(self, 
                   service: Optional[str] = None, 
                   scenario: Optional[str] = None, 
                   start_time: Optional[datetime] = None, 
                   end_time: Optional[datetime] = None,
                   page: int = 1,
                   size: int = 50) -> Dict:
        filtered = self.events
        
        if service:
            filtered = [e for e in filtered if e.get('service') == service]
        if scenario:
            filtered = [e for e in filtered if e.get('label') == scenario]
        if start_time:
            filtered = [e for e in filtered if datetime.fromisoformat(e.get('timestamp')) >= start_time]
        if end_time:
            filtered = [e for e in filtered if datetime.fromisoformat(e.get('timestamp')) <= end_time]
            
        total = len(filtered)
        start_idx = (page - 1) * size
        end_idx = start_idx + size
        
        return {
            "items": filtered[start_idx:end_idx],
            "total": total,
            "page": page,
            "size": size
        }

    def get_event_by_id(self, event_id: str) -> Optional[Dict]:
        for event in self.events:
            if event.get('id') == event_id:
                return event
        return None

    def get_stats(self) -> Dict:
        service_counts = {}
        scenario_counts = {}
        
        for e in self.events:
            svc = e.get('service', 'unknown')
            service_counts[svc] = service_counts.get(svc, 0) + 1
            
            lbl = e.get('label', 'unknown')
            scenario_counts[lbl] = scenario_counts.get(lbl, 0) + 1
            
        return {
            "total_events": len(self.events),
            "service_counts": service_counts,
            "scenario_counts": scenario_counts
        }
