import os
import json
from rag.document_processor import DocumentProcessor
from rag.vector_index import VectorIndex

EVAL_QUERIES = [
    {
        "query": "HTTP 500 error in api gateway due to database connection refused",
        "expected_doc": "api_gateway_errors"
    },
    {
        "query": "Payment service is timing out and taking too long to respond",
        "expected_doc": "slow_responses"
    },
    {
        "query": "Database active connections dropped to zero",
        "expected_doc": "database_troubleshooting"
    },
    {
        "query": "What depends on the auth service?",
        "expected_doc": "dependencies"
    },
    {
        "query": "Kafka queue is backing up", # Out of domain
        "expected_doc": None
    }
]

def run_evaluation():
    processor = DocumentProcessor("knowledge_base")
    chunks = processor.process_all()
    
    # We will just evaluate TF-IDF (keyword) vs Embeddings (if Ollama works)
    idx = VectorIndex(index_path="data/eval_index.json")
    idx.build_index(chunks)
    
    print(f"=== Retrieval Evaluation ===")
    print(f"Chunks indexed: {len(idx.chunks)}")
    print(f"Semantic Search Available: {idx.is_embedded}")
    
    for method in ["keyword", "semantic"]:
        if method == "semantic" and not idx.is_embedded:
            continue
            
        print(f"\n--- {method.upper()} METHOD ---")
        correct_top1 = 0
        correct_top3 = 0
        total_valid = 0
        
        for q in EVAL_QUERIES:
            query = q["query"]
            expected = q["expected_doc"]
            
            results = idx.search(query, top_k=3, use_tfidf=(method == "keyword"))
            doc_ids = [os.path.basename(res[0].source_path).replace(".md", "") for res in results] if results else []
            
            if expected is None:
                # Expecting low scores or no match
                if not results or results[0][1] < 0.2:
                    print(f"[PASS] Correctly rejected OOD query: '{query}'")
                else:
                    print(f"[FAIL] Found match for OOD query: '{query}' -> {doc_ids}")
            else:
                total_valid += 1
                if doc_ids and doc_ids[0] == expected:
                    correct_top1 += 1
                    correct_top3 += 1
                    print(f"[PASS] Top-1 match for: '{query}'")
                elif expected in doc_ids:
                    correct_top3 += 1
                    print(f"[PASS] Top-3 match for: '{query}'")
                else:
                    print(f"[FAIL] Missed '{query}'. Expected {expected}, got {doc_ids}")
                    
        if total_valid > 0:
            print(f"Recall@1: {correct_top1}/{total_valid} ({(correct_top1/total_valid)*100:.1f}%)")
            print(f"Recall@3: {correct_top3}/{total_valid} ({(correct_top3/total_valid)*100:.1f}%)")

if __name__ == "__main__":
    run_evaluation()
