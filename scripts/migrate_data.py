import json
import uuid
import shutil
import os

def migrate():
    input_file = "data/telemetry.jsonl"
    backup_file = "data/telemetry_backup.jsonl"
    
    if not os.path.exists(backup_file):
        shutil.copy2(input_file, backup_file)
        
    events = []
    with open(backup_file, "r") as f:
        for line in f:
            event = json.loads(line)
            if "id" not in event:
                event["id"] = str(uuid.uuid4())
            events.append(event)
            
    with open(input_file, "w") as f:
        for event in events:
            f.write(json.dumps(event) + "\n")
            
if __name__ == "__main__":
    migrate()
