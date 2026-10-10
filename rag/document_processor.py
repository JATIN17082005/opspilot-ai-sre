import os
import hashlib
from typing import List, Dict, Any

class DocumentChunk:
    def __init__(self, chunk_id: str, doc_id: str, source_path: str, title: str, heading: str, text: str):
        self.chunk_id = chunk_id
        self.doc_id = doc_id
        self.source_path = source_path
        self.title = title
        self.heading = heading
        self.text = text

def compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

class DocumentProcessor:
    def __init__(self, kb_dir: str = "knowledge_base"):
        self.kb_dir = kb_dir

    def process_all(self) -> List[DocumentChunk]:
        chunks = []
        if not os.path.exists(self.kb_dir):
            return chunks
            
        for filename in os.listdir(self.kb_dir):
            if filename.endswith(".md"):
                filepath = os.path.join(self.kb_dir, filename)
                chunks.extend(self._process_file(filepath))
        return chunks

    def _process_file(self, filepath: str) -> List[DocumentChunk]:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        doc_id = compute_hash(filepath)[:12]
        
        # Simple Markdown splitter by headings
        lines = content.split('\n')
        title = os.path.basename(filepath).replace('.md', '')
        
        chunks = []
        current_heading = "General"
        current_text = []
        
        for line in lines:
            if line.startswith("# "):
                title = line.replace("# ", "").strip()
            elif line.startswith("## "):
                # Save previous chunk
                if current_text:
                    text = "\n".join(current_text).strip()
                    if text:
                        chunk_id = compute_hash(doc_id + current_heading + text)[:12]
                        chunks.append(DocumentChunk(chunk_id, doc_id, filepath, title, current_heading, text))
                current_heading = line.replace("## ", "").strip()
                current_text = []
            else:
                current_text.append(line)
                
        # Save last chunk
        if current_text:
            text = "\n".join(current_text).strip()
            if text:
                chunk_id = compute_hash(doc_id + current_heading + text)[:12]
                chunks.append(DocumentChunk(chunk_id, doc_id, filepath, title, current_heading, text))
                
        return chunks
