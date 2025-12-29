# Plan: Build Full-Stack GraphRAG Pipeline with MongoDB, Neo4j & Ollama

You'll create a hybrid knowledge system combining vector search (MongoDB Atlas) with graph reasoning (Neo4j) using Ollama for embeddings and generation. The current workspace has basic LangChain + Ollama setup but lacks all database integrations, PDF processing, entity extraction, and hybrid retrieval logic.

## Steps

### 1. Install dependencies & configure connections

Add MongoDB driver, Neo4j driver, PDF parser (`pdf-parse`), text splitters (`langchain`), and environment variables. Create `.env` for MongoDB Atlas URI, Neo4j credentials, and Ollama endpoint.

### 2. Build PDF ingestion pipeline

Create module to convert PDFs to text, chunk into 300-800 token segments with metadata (`doc_id`, `chunk_id`, `source_title`), generate embeddings via Ollama `nomic-embed-text`, and store in MongoDB Atlas Vector Search collection.

### 3. Implement entity/relationship extraction

Use Ollama with structured prompts to extract entities (`Person`, `Company`, `Product`) and relationships (`CEO_OF`, `INVESTED_IN`) from chunks, then create Neo4j nodes and edges with provenance links (`source_doc`, `chunk_id`).

### 4. Create hybrid retrieval engine

Build query handler that performs MongoDB vector search for top-K chunks, extracts entities from results, traverses 1-2 hop Neo4j neighbors, retrieves connected chunks, and constructs graph-aware context for Ollama LLM.

### 5. Add answer generation with provenance

Implement prompt engineering that includes retrieved chunks + graph paths, generate answers with Ollama, and return citations mapping to source documents and graph reasoning paths.

### 6. Optional: Build React visualization UI

Create simple frontend for uploading PDFs, submitting queries, and displaying answers with interactive graph paths and source citations.

## Further Considerations

### 1. Sample Data Source

Do you have specific PDFs ready (OpenAI/Microsoft/Sam Altman docs), or should the plan include sourcing/downloading them first?

### 2. MongoDB Atlas Setup

Do you already have an Atlas cluster with Vector Search enabled, or need setup instructions included?

### 3. Neo4j Deployment

Should this use Neo4j Desktop, Aura cloud, or Docker container? Each affects connection configuration.

---

## Detailed Implementation Steps (from Original Request)

### STEP 0 — Prepare Interconnected Source Data

**Goal**: Ensure the data actually supports multi-hop reasoning.

**What you do**:
- Select 3–5 interconnected PDFs (e.g. OpenAI, Microsoft, Sam Altman)
- Convert to text (PDF → raw text)

**Output**:
- Raw text documents
- Document IDs (doc_id)

*If this step is weak, GraphRAG fails. Everything depends on shared entities.*

### STEP 1 — Chunk Documents for Dual Storage

**Goal**: Create chunks usable for both vectors and graph provenance.

**What you do**:
- Split text into chunks (300–800 tokens)
- Add metadata:
  - doc_id
  - chunk_id
  - source_title
  - page_number (if available)

**Output**:
- Structured chunks ready for embedding
- Each chunk traceable back to its document

### STEP 2 — Generate Embeddings with Ollama

**Goal**: Convert text chunks into numerical vectors.

**What you do**:
- Use Ollama embedding model (e.g. nomic-embed-text)
- Generate embedding per chunk

**Output**:
- `{ chunk_id, embedding[], metadata }`
- This is semantic memory, not reasoning.

### STEP 3 — Store Vectors in MongoDB Atlas Vector Search

**Goal**: Enable semantic retrieval of relevant text.

**What you do**:
- Create MongoDB collection (e.g. document_chunks)
- Create Atlas Vector Search index
- Insert:
  - embedding
  - chunk text
  - metadata

**Output**:
- MongoDB as your vector store
- Semantic search working

*At this point, you have normal RAG, nothing more.*

### STEP 4 — Extract Entities & Relationships with Ollama

**Goal**: Turn text into structured knowledge.

**What you do**:
- Prompt Ollama:
  - "Extract entities and relationships from this text"
  - Use controlled JSON schema
- Entity types: Person, Company, Product, Field
- Relationship types: CEO_OF, INVESTED_IN, WORKS_ON, PARTNERED_WITH

**Output**:
- Structured triples:
  - `(Sam Altman) -[CEO_OF]-> (OpenAI)`
  - `(Microsoft) -[INVESTED_IN]-> (OpenAI)`

*This is where GraphRAG begins.*

### STEP 5 — Store Entities & Relations in Neo4j

**Goal**: Build a queryable knowledge graph.

**What you do**:
- Create nodes:
  - `(:Person {name})`
  - `(:Company {name})`
- Create relationships:
  - `[:CEO_OF]`
  - `[:INVESTED_IN]`
- Store provenance:
  - source_doc
  - chunk_id

**Output**:
- Neo4j graph with traceable edges
- Now your system understands relationships, not just text.

### STEP 6 — Link Graph Nodes to Vector Chunks

**Goal**: Connect semantic text to structured facts.

**What you do**:
- For each chunk:
  - Link extracted entities to chunk_id
  - Store mapping:
    - Graph node ↔ MongoDB chunk

**Output**:
- Ability to move:
  - Text → Entity → Relationship → More Text
- This is hybrid retrieval.

### STEP 7 — Implement Hybrid Retrieval Logic

**Goal**: Retrieve both relevant text AND related entities.

**Query flow**:
1. User asks a question
2. MongoDB vector search retrieves top-K chunks
3. Extract entities from those chunks
4. Expand graph neighbors in Neo4j (1–2 hops)
5. Pull related chunks linked to those nodes

**Output**:
- Rich, connected context
- No hallucinated jumps

### STEP 8 — Construct Graph-Aware Prompt for Ollama

**Goal**: Force the LLM to reason, not guess.

**Prompt contains**:
- Retrieved text chunks
- Graph paths (human readable)
- Optional Cypher used

**Example**:
"Using ONLY the following facts and graph paths, answer the question…"

**Output**:
- Grounded answer
- Lower hallucination risk

### STEP 9 — Generate Answer + Provenance

**Goal**: Produce an auditable response.

**What Ollama returns**:
- Final answer
- Supporting entities
- Graph path explanation
- Source document citations

**Output**:
- Enterprise-grade answer
- Explainable reasoning

### STEP 10 — (Optional) Visualize Graph & Reasoning

**Goal**: Make reasoning inspectable (high recruiter value).

**What you do**:
- Simple React UI
- Show:
  - Answer
  - Graph path
  - Source citations
