import json
import uuid
import requests
from datetime import datetime
from typing import Dict, Any, List
from backend.schemas import InvestigationReport, EvidenceCitation
from agent.tools import TOOLS_REGISTRY

OLLAMA_URL = "http://localhost:11434/api/chat"

def execute_tool(tool_call: Dict[str, Any]) -> Dict[str, Any]:
    tool_name = tool_call.get("name")
    kwargs = tool_call.get("arguments", {})
    
    if tool_name not in TOOLS_REGISTRY:
        return {"error": f"Tool '{tool_name}' is not in the approved registry."}
        
    try:
        # Prevent prompt injection in arguments or excessively large args
        for k, v in kwargs.items():
            if isinstance(v, str) and len(v) > 500:
                return {"error": f"Argument '{k}' exceeds length limit."}
                
        func = TOOLS_REGISTRY[tool_name]
        result = func(**kwargs)
        return result
    except Exception as e:
        return {"error": f"Tool execution failed: {str(e)}"}

def investigate_incident(incident_id: str, question: str, mock_mode: bool = False) -> InvestigationReport:
    """Run the investigation loop in two phases: Evidence Gathering and Synthesis."""
    investigation_id = str(uuid.uuid4())
    audit_log = []
    
    if mock_mode:
        # Do not record a fake successful get_incident invocation.
        return _generate_mock_report(investigation_id, incident_id)
        
    tool_prompt = f"""You are the OpsPilot AI Investigation Agent.
Your task is to gather evidence for an incident based on the provided question.
You have read-only access to tools. Do NOT invent data. Do NOT provide arbitrary code.

Available tools:
- get_incident(incident_id: str)
- get_incident_anomalies(incident_id: str)
- get_metric_summary(service: str, start_time: str, end_time: str)
- search_knowledge(query: str, top_k: int)
- get_service_dependencies(service: str)

Reply ONLY with a JSON object.
To use a tool, reply: {{"action": "tool", "tool": "tool_name", "arguments": {{"arg1": "val1"}}}}
When you have gathered enough evidence, reply: {{"action": "done"}}
Do NOT include <think> tags.
"""
    
    messages = [
        {"role": "system", "content": tool_prompt},
        {"role": "user", "content": f"Investigate Incident ID: {incident_id}. Question: {question}"}
    ]
    
    def custom_encoder(obj):
        if hasattr(obj, "isoformat"): return obj.isoformat()
        if hasattr(obj, "item"): return obj.item()
        return str(obj)

    model = "qwen3.5:2b"
    retrieval_mode = "unknown"
    max_tool_steps = 4
    
    fetched_tool_data = {}
    valid_registry = set()
    
    # Helper to check if tool returned meaningful data
    def _is_meaningful(t_name, t_res):
        if "error" in t_res: return False
        if not t_res: return False
        if t_name == "get_incident" and "id" not in t_res: return False
        if t_name == "get_incident_anomalies" and "anomalies" not in t_res: return False
        return True

    def _register_evidence(t_name, t_res, t_args):
        if t_name == "get_incident":
            valid_registry.add(("incident_data", str(t_args.get("incident_id"))))
        elif t_name == "get_incident_anomalies":
            valid_registry.add(("anomaly_data", str(t_args.get("incident_id"))))
        elif t_name == "get_service_dependencies":
            valid_registry.add(("dependency_analysis", str(t_args.get("service"))))
        elif t_name == "search_knowledge":
            for res in t_res.get("results", []):
                chunk_id = res.get("chunk_id")
                doc_id = res.get("doc_id")
                if chunk_id is not None and str(chunk_id).strip() and str(chunk_id).strip().lower() != "none":
                    valid_registry.add(("runbook", str(chunk_id)))
                if doc_id is not None and str(doc_id).strip() and str(doc_id).strip().lower() != "none":
                    valid_registry.add(("runbook", str(doc_id)))

    def _get_citation_hint(t_name, t_args):
        if t_name == "get_incident": return f"[Citation hint: source_type='incident_data', source_id='{t_args.get('incident_id', '')}']"
        elif t_name == "get_incident_anomalies": return f"[Citation hint: source_type='anomaly_data', source_id='{t_args.get('incident_id', '')}']"
        elif t_name == "get_service_dependencies": return f"[Citation hint: source_type='dependency_analysis', source_id='{t_args.get('service', '')}']"
        elif t_name == "search_knowledge": return "[Citation hint: source_type='runbook', source_id=use 'chunk_id' from results]"
        return ""

    # Phase 1: Tool Gathering
    for step in range(max_tool_steps):
        try:
            resp = requests.post(OLLAMA_URL, json={
                "model": model, "messages": messages, "stream": False, "format": "json",
                "options": {"temperature": 0.0}
            }, timeout=180)
            if resp.status_code != 200:
                raise Exception(f"Ollama API failed: {resp.text}")
                
            response_text = resp.json().get("message", {}).get("content", "")
            if "<think>" in response_text:
                import re
                response_text = re.sub(r'<think>.*?</think>', '', response_text, flags=re.DOTALL).strip()
            
            response_data = json.loads(response_text)
            
            if response_data.get("action") == "done":
                break
            elif response_data.get("action") == "tool" or "tool" in response_data:
                tool_name = response_data.get("tool")
                args = response_data.get("arguments", {})
                
                t_start = datetime.now()
                tool_result = execute_tool({"name": tool_name, "arguments": args})
                t_duration = (datetime.now() - t_start).total_seconds()
                
                is_success = _is_meaningful(tool_name, tool_result)
                audit_log.append({
                    "tool": tool_name, "arguments": args, "duration": t_duration,
                    "status": "success" if is_success else "error",
                    "source": "llm"
                })
                
                if is_success:
                    fetched_tool_data[tool_name] = tool_result
                    _register_evidence(tool_name, tool_result, args)
                    if tool_name == "search_knowledge" and "retrieval_mode" in tool_result:
                        retrieval_mode = tool_result["retrieval_mode"]
                
                hint = _get_citation_hint(tool_name, args)
                messages.append({"role": "assistant", "content": json.dumps(response_data)})
                messages.append({"role": "user", "content": f"Tool Result {hint}:\n{json.dumps(tool_result, default=custom_encoder)[:2000]}"})
            else:
                messages.append({"role": "assistant", "content": json.dumps(response_data)})
                messages.append({"role": "user", "content": "Unrecognized JSON action. Use 'tool' or 'done'."})
        except Exception as e:
            print(f"Ollama tool phase failure: {e}.")
            return _generate_mock_report(investigation_id, incident_id, error=str(e))
            
    # Phase 1.5: Code-controlled fallback ensuring required evidence
    if "get_incident" not in fetched_tool_data:
        t_name = "get_incident"
        t_args = {"incident_id": incident_id}
        t_start = datetime.now()
        t_res = execute_tool({"name": t_name, "arguments": t_args})
        t_dur = (datetime.now() - t_start).total_seconds()
        is_succ = _is_meaningful(t_name, t_res)
        audit_log.append({
            "tool": t_name, "arguments": t_args,
            "duration": t_dur, "status": "success" if is_succ else "error", "source": "system"
        })
        if is_succ:
            fetched_tool_data[t_name] = t_res
            _register_evidence(t_name, t_res, t_args)
        hint = _get_citation_hint(t_name, t_args)
        messages.append({"role": "system", "content": f"AUTOMATED SYSTEM FETCH ({t_name}) {hint}:\n{json.dumps(t_res, default=custom_encoder)[:2000]}"})

    if "get_incident_anomalies" not in fetched_tool_data:
        t_name = "get_incident_anomalies"
        t_args = {"incident_id": incident_id}
        t_start = datetime.now()
        t_res = execute_tool({"name": t_name, "arguments": t_args})
        t_dur = (datetime.now() - t_start).total_seconds()
        is_succ = _is_meaningful(t_name, t_res)
        audit_log.append({
            "tool": t_name, "arguments": t_args,
            "duration": t_dur, "status": "success" if is_succ else "error", "source": "system"
        })
        if is_succ:
            fetched_tool_data[t_name] = t_res
            _register_evidence(t_name, t_res, t_args)
        hint = _get_citation_hint(t_name, t_args)
        messages.append({"role": "system", "content": f"AUTOMATED SYSTEM FETCH ({t_name}) {hint}:\n{json.dumps(t_res, default=custom_encoder)[:2000]}"})
        
    if "get_incident" not in fetched_tool_data or "get_incident_anomalies" not in fetched_tool_data:
        return _generate_mock_report(investigation_id, incident_id, status="failed_missing_evidence", error="Required evidence (incident or anomalies) could not be obtained.")
        
    # Secondary deterministic fetches based on incident data
    if "get_service_dependencies" not in fetched_tool_data or "search_knowledge" not in fetched_tool_data:
        try:
            inc_data = fetched_tool_data["get_incident"]
            if "affected_services" in inc_data and inc_data["affected_services"]:
                srv = inc_data["affected_services"][0]
            elif "services" in inc_data and inc_data["services"]:
                srv = inc_data["services"][0]
            else:
                srv = None
                
            if srv:
                if "get_service_dependencies" not in fetched_tool_data:
                    t_name = "get_service_dependencies"
                    t_args = {"service": srv}
                    t_start = datetime.now()
                    dep_res = execute_tool({"name": t_name, "arguments": t_args})
                    t_dur = (datetime.now() - t_start).total_seconds()
                    is_succ = _is_meaningful(t_name, dep_res)
                    audit_log.append({"tool": t_name, "arguments": t_args, "duration": t_dur, "status": "success" if is_succ else "error", "source": "system"})
                    if is_succ:
                        fetched_tool_data[t_name] = dep_res
                        _register_evidence(t_name, dep_res, t_args)
                    hint = _get_citation_hint(t_name, t_args)
                    messages.append({"role": "system", "content": f"AUTOMATED SYSTEM FETCH ({t_name}) {hint}:\n{json.dumps(dep_res, default=custom_encoder)[:1000]}"})
                    
                if "search_knowledge" not in fetched_tool_data:
                    t_name = "search_knowledge"
                    t_args = {"query": f"{srv} database timeout", "top_k": 2}
                    t_start = datetime.now()
                    rag_res = execute_tool({"name": t_name, "arguments": t_args})
                    t_dur = (datetime.now() - t_start).total_seconds()
                    is_succ = _is_meaningful(t_name, rag_res)
                    audit_log.append({"tool": t_name, "arguments": t_args, "duration": t_dur, "status": "success" if is_succ else "error", "source": "system"})
                    if is_succ:
                        fetched_tool_data[t_name] = rag_res
                        _register_evidence(t_name, rag_res, t_args)
                        if "retrieval_mode" in rag_res:
                            retrieval_mode = rag_res["retrieval_mode"]
                    hint = _get_citation_hint(t_name, t_args)
                    messages.append({"role": "system", "content": f"AUTOMATED SYSTEM FETCH ({t_name}) {hint}:\n{json.dumps(rag_res, default=custom_encoder)[:2000]}"})
        except Exception as e:
            print(f"Non-critical fallback optional enrichment error: {e}")
            pass

    # Phase 2: Synthesis
    synthesis_prompt = f"""You have completed evidence gathering.
Review the previous tool results. 
Reply ONLY with a JSON object matching this exact schema:
{{
  "summary": "string",
  "observed_facts": ["string"],
  "affected_services": ["string"],
  "ranked_root_causes": ["string"],
  "evidence_for": [{{"source_type": "string", "source_id": "string", "description": "string"}}],
  "evidence_against": [],
  "runbook_references": ["string"],
  "recommended_steps": ["string"],
  "remaining_uncertainty": "string",
  "confidence": "high"
}}
Do NOT include <think> tags.
"""
    messages.append({"role": "system", "content": synthesis_prompt})
    messages.append({"role": "user", "content": "Evidence gathering complete. Generate the final InvestigationReport JSON now based on the retrieved evidence."})
    
    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": model, "messages": messages, "stream": False, "format": "json",
            "options": {"temperature": 0.0}
        }, timeout=300)
        
        if resp.status_code != 200:
            raise Exception("Ollama synthesis failed.")
            
        response_text = resp.json().get("message", {}).get("content", "")
        if "<think>" in response_text:
            import re
            response_text = re.sub(r'<think>.*?</think>', '', response_text, flags=re.DOTALL).strip()
            
        final_report_json = json.loads(response_text)
    except Exception as e:
        print(f"Ollama synthesis failure: {e}")
        return _generate_mock_report(investigation_id, incident_id, error=str(e))
        
    # Coerce simple string arrays explicitly and safely
    for field in ["observed_facts", "affected_services", "ranked_root_causes", "runbook_references", "recommended_steps"]:
        if field in final_report_json and isinstance(final_report_json[field], list):
            clean_list = []
            for item in final_report_json[field]:
                if isinstance(item, str):
                    clean_list.append(item)
                elif isinstance(item, dict):
                    if "service" in item:
                        clean_list.append(str(item["service"]))
                    elif "cause" in item:
                        clean_list.append(str(item["cause"]))
                    elif "message" in item:
                        clean_list.append(str(item["message"]))
            final_report_json[field] = clean_list

    def _validate_citations(citation_list):
        validated = []
        for ev in citation_list:
            if isinstance(ev, dict):
                src_type = str(ev.get("source_type", ""))
                src_id = str(ev.get("source_id", ""))
                if (src_type, src_id) in valid_registry:
                    validated.append(ev)
        return validated

    final_report_json["evidence_for"] = _validate_citations(final_report_json.get("evidence_for", []))
    final_report_json["evidence_against"] = _validate_citations(final_report_json.get("evidence_against", []))
            
    # Validate against Pydantic
            
    # Validate against Pydantic
    try:
        report = InvestigationReport(
            investigation_id=investigation_id,
            incident_id=incident_id,
            status="success",
            summary=final_report_json.get("summary", "No summary"),
            observed_facts=final_report_json.get("observed_facts", []),
            affected_services=final_report_json.get("affected_services", []),
            ranked_root_causes=final_report_json.get("ranked_root_causes", []),
            evidence_for=[EvidenceCitation(**e) for e in final_report_json.get("evidence_for", [])],
            evidence_against=[EvidenceCitation(**e) for e in final_report_json.get("evidence_against", [])],
            runbook_references=final_report_json.get("runbook_references", []),
            recommended_steps=final_report_json.get("recommended_steps", []),
            remaining_uncertainty=final_report_json.get("remaining_uncertainty", "None"),
            confidence=final_report_json.get("confidence", "low"),
            retrieval_mode=retrieval_mode,
            model_identifier=model,
            tool_call_audit=audit_log,
            timestamp=datetime.now()
        )
        return report
    except Exception as e:
        return _generate_mock_report(investigation_id, incident_id, status="failed_validation", error=f"Schema validation failed: {str(e)}")

def _generate_mock_report(investigation_id: str, incident_id: str, status: str = "failed_model_unavailable", error: str = "") -> InvestigationReport:
    """Fallback report for when LLM is unavailable or testing deterministic fallback."""
    return InvestigationReport(
        investigation_id=investigation_id,
        incident_id=incident_id,
        status=status,
        summary=f"Automated fallback report for {incident_id}. {error}",
        observed_facts=["Mocked observed facts"],
        affected_services=[],
        ranked_root_causes=["unknown"],
        evidence_for=[],
        evidence_against=[],
        runbook_references=[],
        recommended_steps=["Verify manually"],
        remaining_uncertainty="LLM unavailable. Deterministic fallback used.",
        confidence="low",
        retrieval_mode="fallback",
        model_identifier="mock-llm",
        tool_call_audit=[],
        timestamp=datetime.now()
    )
