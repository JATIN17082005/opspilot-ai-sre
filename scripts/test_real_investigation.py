import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.orchestrator import investigate_incident

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def main():
    print('Testing REAL Investigation (Ollama)...')
    try:
        with open('data/incident_status.json', 'r') as f:
            status_data = json.load(f)
            incident_id = list(status_data.keys())[0] if status_data else "test-incident"
    except Exception:
        incident_id = "test-incident"
        
    print(f'Using incident ID: {incident_id}')
    report = investigate_incident(incident_id, 'What is the root cause of this incident?', mock_mode=False)
    
    print('=========================')
    print('Status:', report.status)
    print('Summary:', report.summary)
    print('Observed Facts:', report.observed_facts)
    print('Affected Services:', report.affected_services)
    print('Ranked Root Causes:', report.ranked_root_causes)
    print('Evidence Citations:', [dict(c) for c in report.evidence_for])
    print('Runbook References:', report.runbook_references)
    print('Recommended Steps:', report.recommended_steps)
    print('Remaining Uncertainty:', report.remaining_uncertainty)
    print('Audit Log:', json.dumps(report.tool_call_audit, indent=2))
    print('=========================')

    if report.status != 'success':
        print(f'Investigation failed with status: {report.status}')
        sys.exit(1)
        
    if not report.tool_call_audit:
        print('Audit log is completely empty!')
        sys.exit(1)
        
    has_incident_evidence = any(log.get('tool') in ['get_incident', 'get_incident_anomalies'] and log.get('status') == 'success' for log in report.tool_call_audit)
    if not has_incident_evidence:
        print('Audit log lacks core incident evidence.')
        sys.exit(1)
        
    sys.exit(0)

if __name__ == '__main__':
    main()
