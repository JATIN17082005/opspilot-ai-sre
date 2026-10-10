import json
import os
from typing import Dict, Literal
from pydantic import BaseModel

class IncidentStatusUpdate(BaseModel):
    status: Literal["open", "acknowledged", "resolved"]

class IncidentStatusRepository:
    def __init__(self, file_path: str = "data/incident_status.json"):
        self.file_path = file_path
        self._status_map = self._load()
        
    def _load(self) -> Dict[str, str]:
        if not os.path.exists(self.file_path):
            return {}
        try:
            with open(self.file_path, "r") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
            
    def _save(self):
        tmp_path = self.file_path + ".tmp"
        with open(tmp_path, "w") as f:
            json.dump(self._status_map, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, self.file_path)
            
    def get_status(self, incident_id: str) -> str:
        return self._status_map.get(incident_id, "open")
        
    def set_status(self, incident_id: str, status: str):
        if status not in ["open", "acknowledged", "resolved"]:
            raise ValueError(f"Invalid status: {status}")
        self._status_map[incident_id] = status
        self._save()
