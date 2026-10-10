import pytest
import os
from rag.document_processor import DocumentProcessor
from rag.vector_index import VectorIndex
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_document_processor():
    # Make sure we read the synthetic runbooks
    processor = DocumentProcessor("knowledge_base")
    chunks = processor.process_all()
    assert len(chunks) > 0
    # verify metadata
    assert chunks[0].chunk_id is not None
    assert chunks[0].doc_id is not None
    assert chunks[0].title is not None
    assert chunks[0].heading is not None
    assert chunks[0].text is not None
    assert "knowledge_base" in chunks[0].source_path

def test_vector_index_fallback():
    # Ollama may be online or offline. We just check if it built correctly.
    processor = DocumentProcessor("knowledge_base")
    chunks = processor.process_all()
    
    idx = VectorIndex(index_path="data/test_index.json")
    idx.build_index(chunks)
    
    # It must have successfully built (either semantic or TF-IDF)
    assert len(idx.chunks) > 0
    
    res = idx.search("database connection dropped", top_k=1)
    assert len(res) == 1
    assert "database" in res[0][0].text.lower()
    
    # Reload test
    idx2 = VectorIndex(index_path="data/test_index.json")
    loaded = idx2.load()
    assert loaded == True
    assert len(idx2.chunks) > 0
    
    if os.path.exists("data/test_index.json"):
        os.remove("data/test_index.json")

def test_api_rag_endpoints():
    # POST /knowledge/index
    resp = client.post("/knowledge/index")
    assert resp.status_code == 200
    assert resp.json()["chunks_indexed"] > 0
    
    # GET /knowledge/status
    resp = client.get("/knowledge/status")
    assert resp.status_code == 200
    assert resp.json()["chunks_indexed"] > 0
    
    # POST /knowledge/search
    resp = client.post("/knowledge/search", json={"query": "payment-service timeout", "top_k": 2})
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert len(data["results"]) <= 2
    if len(data["results"]) > 0:
        assert data["results"][0]["method"] in ["keyword", "semantic"]
        
def test_invalid_query():
    resp = client.post("/knowledge/search", json={"query": ""})
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 0
