import os
import json
import numpy as np
import requests
from typing import List, Tuple, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from rag.document_processor import DocumentChunk

class VectorIndex:
    def __init__(self, index_path: str = "data/vector_index.json", ollama_model: str = "nomic-embed-text"):
        self.index_path = index_path
        self.ollama_model = ollama_model
        self.ollama_url = "http://localhost:11434/api/embeddings"
        
        self.chunks: List[DocumentChunk] = []
        self.embeddings: np.ndarray = np.array([])
        self.tfidf_vectorizer = TfidfVectorizer(stop_words='english')
        self.tfidf_matrix = None
        
        # State
        self.is_embedded = False
        self.is_tfidf_fitted = False

    def build_index(self, chunks: List[DocumentChunk]):
        self.chunks = chunks
        if not chunks:
            self.is_embedded = False
            self.is_tfidf_fitted = False
            return
            
        # 1. Build TF-IDF (Fallback / Baseline)
        texts = [f"{c.title} {c.heading} {c.text}" for c in chunks]
        self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(texts)
        self.is_tfidf_fitted = True
        
        # 2. Build Dense Embeddings (Ollama)
        try:
            embeddings_list = []
            for text in texts:
                resp = requests.post(self.ollama_url, json={
                    "model": self.ollama_model,
                    "prompt": text
                }, timeout=5)
                
                if resp.status_code == 200:
                    emb = resp.json().get("embedding")
                    embeddings_list.append(emb)
                else:
                    raise Exception(f"Ollama error: {resp.status_code}")
                    
            self.embeddings = np.array(embeddings_list)
            # Normalize vectors for cosine similarity
            norms = np.linalg.norm(self.embeddings, axis=1, keepdims=True)
            # Handle zero vectors
            norms[norms == 0] = 1
            self.embeddings = self.embeddings / norms
            self.is_embedded = True
        except Exception as e:
            print(f"[Warning] Failed to generate embeddings via Ollama ({e}). Falling back to TF-IDF only.")
            self.is_embedded = False
            
        self._save()

    def _save(self):
        # We save chunks and tfidf vocab. 
        # For simplicity in this demo without external DBs, we'll serialize to JSON.
        data = {
            "model": self.ollama_model,
            "is_embedded": self.is_embedded,
            "chunks": [vars(c) for c in self.chunks],
            "embeddings": self.embeddings.tolist() if self.is_embedded else []
        }
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        tmp_path = self.index_path + ".tmp"
        with open(tmp_path, "w") as f:
            json.dump(data, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, self.index_path)
            
    def load(self) -> bool:
        if not os.path.exists(self.index_path):
            return False
            
        try:
            with open(self.index_path, "r") as f:
                data = json.load(f)
                
            self.chunks = [DocumentChunk(**c) for c in data["chunks"]]
            self.is_embedded = data["is_embedded"]
            if self.is_embedded:
                self.embeddings = np.array(data["embeddings"])
                
            if self.chunks:
                texts = [f"{c.title} {c.heading} {c.text}" for c in self.chunks]
                self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(texts)
                self.is_tfidf_fitted = True
                
            return True
        except Exception:
            return False

    def search(self, query: str, top_k: int = 3, use_tfidf: bool = False) -> List[Tuple[DocumentChunk, float]]:
        if not query.strip() or not self.chunks:
            return []
            
        if use_tfidf or not self.is_embedded:
            if not self.is_tfidf_fitted:
                return []
            q_vec = self.tfidf_vectorizer.transform([query])
            sims = cosine_similarity(q_vec, self.tfidf_matrix)[0]
        else:
            try:
                resp = requests.post(self.ollama_url, json={
                    "model": self.ollama_model,
                    "prompt": query
                }, timeout=5)
                if resp.status_code == 200:
                    q_emb = np.array(resp.json().get("embedding"))
                    q_norm = np.linalg.norm(q_emb)
                    if q_norm > 0:
                        q_emb = q_emb / q_norm
                    sims = np.dot(self.embeddings, q_emb)
                else:
                    # Fallback to TFIDF if Ollama is down during query
                    return self.search(query, top_k, use_tfidf=True)
            except Exception:
                # Fallback to TFIDF
                return self.search(query, top_k, use_tfidf=True)
                
        # Get top K
        top_indices = np.argsort(sims)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            score = float(sims[idx])
            if score > 0:
                results.append((self.chunks[idx], score))
                
        # Deterministic sorting (score desc, then chunk_id asc for ties)
        results.sort(key=lambda x: (-x[1], x[0].chunk_id))
        return results
