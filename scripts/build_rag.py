import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag.document_processor import DocumentProcessor
from rag.vector_index import VectorIndex

def main():
    print('Processing knowledge base...')
    processor = DocumentProcessor('knowledge_base')
    chunks = processor.process_all()
    print(f'Generated {len(chunks)} chunks.')
    
    print('Building vector index (this may take a minute if embedding)...')
    idx = VectorIndex('data/vector_index.json')
    idx.build_index(chunks)
    
    print(f'Index built. is_embedded: {idx.is_embedded}')
    if idx.is_embedded:
        print('Semantic Embeddings ARE ACTIVE.')
    else:
        print('Semantic Embeddings are NOT ACTIVE (fell back to TF-IDF).')

if __name__ == '__main__':
    main()
