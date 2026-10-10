import pytest
from agent.orchestrator import execute_tool

def test_unapproved_tool():
    res = execute_tool({'name': 'delete_database', 'arguments': {}})
    assert 'error' in res
    assert 'not in the approved registry' in res['error']

def test_malformed_arguments():
    huge_str = 'A' * 600
    res = execute_tool({'name': 'get_incident', 'arguments': {'incident_id': huge_str}})
    assert 'error' in res
    assert 'exceeds length limit' in res['error']
